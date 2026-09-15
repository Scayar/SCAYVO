import { adapterMissingMessage, ScayvoError } from '../core/errors.js';
import { isSameOriginAbsolutePath } from '../core/paths.js';
import type { ConnectionLabel, UnhandledRequest } from '../core/protocol.js';
import {
  PROTOCOL_VERSION,
  TRANSITION_WATCHDOG_MS,
  type Adapter,
  type AppIntegration,
  type Command,
  type Json,
  type MountedApp,
  type ResolvedScene,
  type Result,
  type SceneContext,
} from '../core/types.js';
import { deckActionFromKey } from './keyboard.js';
import { hideOverlay, showDemoBadge, showOverlay } from './overlay.js';
import {
  readJournal,
  readOrCreateSessionId,
  writeJournal,
  type Journal,
} from './journal.js';
import { startNetwork } from './network.js';
import {
  applyStoragePatch,
  assertNoStorageConflict,
  captureBaselineStorage,
  createForeignStorageGuard,
  probeStorage,
  restoreBaselineStorage,
} from './storage.js';

export type SessionPayload = {
  enabled: boolean;
  protocol: 1;
  projectId: string;
  token: string;
  wsPath: string;
  workerPath: string;
  configHash: string;
  initialScene: string;
  order: string[];
  network: { scope: string[]; onUnhandled: 'block' };
  managedStorage: { local: string[]; session: string[] };
  scenes: Record<string, ResolvedScene>;
};

export type StartScayvoOptions = {
  integration: AppIntegration;
  adapters?: Record<string, Adapter>;
  hideDemoBadge?: boolean;
};

type EngineStatus = 'booting' | 'active' | 'applying' | 'resetting' | 'idle' | 'recovery-failed';

type Engine = {
  apply(sceneId: string, requestId?: string): Promise<Result>;
  reset(requestId?: string): Promise<Result>;
  getSceneId(): string | null;
};

declare global {
  interface Window {
    __SCAYVO__?: Engine;
  }
}

export async function startScayvo(options: StartScayvoOptions): Promise<Engine> {
  if (window.__SCAYVO__) return window.__SCAYVO__;
  const session = await loadSession();
  if (!session.enabled) {
    throw new ScayvoError('LOOPBACK_REQUIRED', 'SCAYVO is disabled in this Vite session.');
  }
  const engine = await createEngine(session, options);
  window.__SCAYVO__ = engine;
  return engine;
}

async function loadSession(): Promise<SessionPayload> {
  const mod = (await import('virtual:scayvo/session')) as {
    session?: SessionPayload;
    default?: SessionPayload;
    enabled?: boolean;
  };
  if (mod.session) return mod.session;
  if (mod.default && 'projectId' in mod.default) return mod.default;
  throw new ScayvoError('CONFIG_INVALID', 'virtual:scayvo/session is not available. Add scayvo() to vite.config.ts.');
}

async function createEngine(session: SessionPayload, options: StartScayvoOptions): Promise<Engine> {
  const adapters = options.adapters ?? {};
  const clientId = crypto.randomUUID();
  let revision = 0;
  let status: EngineStatus = 'booting';
  let currentSceneId: string | null = null;
  let mounted: MountedApp | null = null;
  let controller = new AbortController();
  let remoteMode = false;
  let hideBadge = Boolean(options.hideDemoBadge);
  let configChanged = false;
  const unhandled: UnhandledRequest[] = [];
  let lastDiagnostic: { code: string; message: string; path?: string; fix?: string } | undefined;
  const pending = new Map<string, (result: Result) => void>();

  probeStorage({ local: localStorage, session: sessionStorage });
  const sessionId = readOrCreateSessionId(session.projectId);
  const guard = createForeignStorageGuard(session.managedStorage);

  const journal = readJournal(session.projectId, sessionId);
  const needRecovery =
    Boolean(journal) &&
    (journal!.configHash !== session.configHash ||
      journal!.phase === 'applying' ||
      journal!.phase === 'resetting');

  let baseline = journal?.baseline;
  if (!baseline) {
    baseline = {
      route: location.pathname + location.search + location.hash,
      storage: captureBaselineStorage(session.managedStorage, {
        local: localStorage,
        session: sessionStorage,
      }),
      adapters: await captureAdapters(adapters),
    };
  }

  const persist = (phase: Journal['phase'], sceneId: string | null) => {
    writeJournal({
      v: 1,
      projectId: session.projectId,
      sessionId,
      configHash: session.configHash,
      phase,
      sceneId,
      revision,
      baseline: baseline!,
    });
  };

  persist('idle', journal?.phase === 'active' ? journal.sceneId : null);

  const getGeneration = () => ({ revision, signal: controller.signal });

  const network = await startNetwork({
    workerUrl: session.workerPath,
    scope: session.network.scope,
    getGeneration,
    onUnhandled: (entry) => {
      unhandled.push(entry);
      lastDiagnostic = {
        code: 'UNHANDLED_REQUEST',
        message: `Blocked ${entry.method} ${entry.path}. No matcher in the active scene.`,
      };
      emitState();
    },
  });

  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let messageQueue = Promise.resolve();
  let reconnect = true;

  const connectionLabel = (): ConnectionLabel => {
    if (status === 'recovery-failed') return 'recovery-failed';
    if (status === 'applying' || status === 'resetting') return 'applying';
    if (status === 'active') return 'active';
    if (socket && socket.readyState === WebSocket.OPEN) return 'connected';
    if (status === 'booting') return 'waiting';
    return 'reconnecting';
  };

  const emitState = (requestId?: string) => {
    const message = {
      protocol: PROTOCOL_VERSION,
      type: 'STATE' as const,
      requestId,
      revision,
      connection: connectionLabel(),
      sceneId: currentSceneId,
      route: location.pathname + location.search + location.hash,
      remoteMode,
      hideDemoBadge: hideBadge,
      unhandled: unhandled.slice(-20),
      diagnostic: lastDiagnostic,
      configHash: session.configHash,
      recovery: status === 'recovery-failed' || needRecovery,
    };
    socket?.readyState === WebSocket.OPEN && socket.send(JSON.stringify(message));
    const title = currentSceneId ? session.scenes[currentSceneId]?.title ?? null : null;
    showDemoBadge(Boolean(currentSceneId) && !hideBadge, title);
  };

  const sendResult = (result: Result) => {
    pending.get(result.requestId)?.(result);
    pending.delete(result.requestId);
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(result));
    emitState(result.requestId);
  };

  const connect = () => {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${protocol}://${location.host}${session.wsPath}`);
    socket.addEventListener('open', () => {
      socket?.send(
        JSON.stringify({
          protocol: PROTOCOL_VERSION,
          type: 'AUTH',
          token: session.token,
          role: 'app',
          clientId,
          projectId: session.projectId,
        }),
      );
    });
    socket.addEventListener('message', (event) => {
      const parsed = JSON.parse(String(event.data)) as Record<string, unknown>;
      if (parsed.type === 'ALREADY_CONNECTED') {
        lastDiagnostic = {
          code: 'ALREADY_CONNECTED',
          message: 'Another app tab is already connected. Close this tab.',
        };
        reconnect = false;
        socket?.close();
        return;
      }
      messageQueue = messageQueue.then(() => onSocketMessage(parsed)).catch(() => undefined);
    });
    socket.addEventListener('close', () => {
      emitState();
      if (!reconnect) return;
      if (reconnectTimer !== null) return;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, 800);
    });
  };

  const onSocketMessage = async (message: Record<string, unknown>) => {
    if (message.type === 'CONFIG_CHANGED') {
      configChanged = true;
      showOverlay(
        'config-changed',
        'Configuration changed',
        'Reset and reload the app to start a new session. The current scene stays mocked until then.',
      );
      lastDiagnostic = {
        code: 'CONFIG_CHANGED',
        message: 'Configuration changed. Reset and reload the app.',
      };
      emitState();
      return;
    }
    if (message.type === 'CONTROL') {
      if (message.action === 'remote') remoteMode = Boolean(message.value);
      if (message.action === 'badge') hideBadge = Boolean(message.value);
      emitState();
      return;
    }
    if (message.type === 'SCENE_APPLY' || message.type === 'RESET') {
      const command = message as Command;
      if (command.configHash && command.configHash !== session.configHash) {
        sendResult({
          protocol: 1,
          requestId: command.requestId,
          revision,
          type: 'COMMAND_FAILED',
          error: { code: 'CONFIG_CHANGED', message: 'App session is pinned to a previous config hash.' },
        });
        return;
      }
      if (command.type === 'RESET') await reset(command.requestId);
      else await apply(command.sceneId ?? session.initialScene, command.requestId);
    }
  };

  const preflight = (sceneId: string | null) => {
    if (status === 'applying' || status === 'resetting') {
      throw new ScayvoError('BUSY', 'A scene transition is already running.');
    }
    if (configChanged) {
      throw new ScayvoError('CONFIG_CHANGED', 'Configuration changed. Reset and reload the app.');
    }
    assertNoStorageConflict(guard);
    probeStorage({ local: localStorage, session: sessionStorage });
    if (sceneId) {
      const scene = session.scenes[sceneId];
      if (!scene) throw new ScayvoError('SCENE_NOT_FOUND', `Unknown scene "${sceneId}".`);
      for (const name of Object.keys(scene.custom)) {
        if (!adapters[name]) {
          throw new ScayvoError('ADAPTER_MISSING', adapterMissingMessage(name, sceneId), {
            path: `custom.${name}`,
          });
        }
      }
    }
  };

  const replaceRoute = (route: string | undefined) => {
    if (!route) return;
    if (!isSameOriginAbsolutePath(route)) {
      throw new ScayvoError('CONFIG_INVALID', `Refusing to navigate to ${route}`);
    }
    const url = new URL(route, location.origin);
    if (url.origin !== location.origin) {
      throw new ScayvoError('CONFIG_INVALID', `Refusing cross-origin route ${route}`);
    }
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const disposeCurrent = async () => {
    const previous = mounted;
    mounted = null;
    if (previous) await previous.dispose();
  };

  const mountWith = async (context: SceneContext) => {
    mounted = await options.integration.mount(context);
  };

  const applyAdapters = async (custom: Record<string, Json>, context: SceneContext) => {
    for (const [name, adapter] of Object.entries(adapters)) {
      if (context.signal.aborted) throw new ScayvoError('TRANSITION_TIMEOUT', 'Adapter aborted.');
      if (Object.prototype.hasOwnProperty.call(custom, name)) {
        await adapter.apply(custom[name], context);
      } else {
        await adapter.restore(baseline!.adapters[name] ?? null, context);
      }
    }
  };

  const restoreAllAdapters = async (context: SceneContext) => {
    for (const [name, adapter] of Object.entries(adapters)) {
      if (context.signal.aborted) throw new ScayvoError('TRANSITION_TIMEOUT', 'Adapter aborted.');
      await adapter.restore(baseline!.adapters[name] ?? null, context);
    }
  };

  const recover = async (error: unknown): Promise<void> => {
    try {
      controller.abort();
      if (mounted) {
        try {
          await mounted.dispose();
        } catch {
          // ignore dispose failures during recovery
        }
        mounted = null;
      }
      restoreBaselineStorage(baseline!.storage, session.managedStorage, {
        local: localStorage,
        session: sessionStorage,
      });
      const recoveryController = new AbortController();
      controller = recoveryController;
      const context: SceneContext = {
        sceneId: null,
        revision,
        signal: recoveryController.signal,
        custom: {},
      };
      await restoreAllAdapters(context);
      await network.stopInterception();
      replaceRoute(baseline!.route);
      await mountWith(context);
      status = 'idle';
      currentSceneId = null;
      persist('idle', null);
      hideOverlay();
    } catch (recoveryError) {
      status = 'recovery-failed';
      persist('idle', null);
      const message = recoveryError instanceof Error ? recoveryError.message : String(recoveryError);
      showOverlay(
        'recovery-failed',
        'Recovery failed',
        `${message} Network mocking stays on. Reload the app. Reset is not marked complete.`,
      );
      throw new ScayvoError('RECOVERY_FAILED', 'Recovery failed after a scene mutation error.', {
        cause: recoveryError ?? error,
      });
    }
  };

  const apply = async (sceneId: string, requestId: string = crypto.randomUUID()): Promise<Result> => {
    try {
      preflight(sceneId);
    } catch (error) {
      const result = toFailed(requestId, revision, error);
      sendResult(result);
      return result;
    }
    const scene = session.scenes[sceneId];
    revision += 1;
    const thisRevision = revision;
    persist('applying', sceneId);
    status = 'applying';
    showOverlay('applying', scene.title, 'Preparing a repeatable scene.');
    emitState(requestId);
    controller.abort();
    controller = new AbortController();
    const context: SceneContext = {
      sceneId,
      revision: thisRevision,
      signal: controller.signal,
      custom: scene.custom,
    };
    try {
      await withWatchdog(controller, async () => {
        await disposeCurrent();
        restoreBaselineStorage(baseline!.storage, session.managedStorage, {
          local: localStorage,
          session: sessionStorage,
        });
        await restoreAllAdapters(context);
        applyStoragePatch(scene.storage, baseline!.storage, session.managedStorage, {
          local: localStorage,
          session: sessionStorage,
        });
        await applyAdapters(scene.custom, context);
        await network.applyScene(scene, thisRevision);
        replaceRoute(scene.route);
        await mountWith(context);
        if (controller.signal.aborted) {
          throw new ScayvoError('TRANSITION_TIMEOUT', 'Scene apply exceeded 10 seconds.');
        }
      });
      status = 'active';
      currentSceneId = sceneId;
      persist('active', sceneId);
      hideOverlay();
      const result: Result = {
        protocol: 1,
        requestId,
        revision: thisRevision,
        type: 'SCENE_APPLIED',
      };
      sendResult(result);
      return result;
    } catch (error) {
      try {
        await recover(error);
        const result = toFailed(requestId, thisRevision, error);
        sendResult(result);
        return result;
      } catch (recoveryError) {
        const result = toFailed(requestId, thisRevision, recoveryError);
        sendResult(result);
        return result;
      }
    }
  };

  const reset = async (requestId: string = crypto.randomUUID()): Promise<Result> => {
    try {
      if (status === 'applying' || status === 'resetting') {
        throw new ScayvoError('BUSY', 'A scene transition is already running.');
      }
      assertNoStorageConflict(guard);
    } catch (error) {
      const result = toFailed(requestId, revision, error);
      sendResult(result);
      return result;
    }
    revision += 1;
    const thisRevision = revision;
    persist('resetting', null);
    status = 'resetting';
    showOverlay('applying', 'Reset', 'Restoring managed inputs and leaving demo mode.');
    emitState(requestId);
    controller.abort();
    controller = new AbortController();
    const context: SceneContext = {
      sceneId: null,
      revision: thisRevision,
      signal: controller.signal,
      custom: {},
    };
    try {
      await withWatchdog(controller, async () => {
        await disposeCurrent();
        restoreBaselineStorage(baseline!.storage, session.managedStorage, {
          local: localStorage,
          session: sessionStorage,
        });
        await restoreAllAdapters(context);
        await network.stopInterception();
        replaceRoute(baseline!.route);
        await mountWith(context);
      });
      status = 'idle';
      currentSceneId = null;
      persist('idle', null);
      hideOverlay();
      showDemoBadge(false, null);
      const result: Result = {
        protocol: 1,
        requestId,
        revision: thisRevision,
        type: 'RESET_COMPLETED',
      };
      sendResult(result);
      return result;
    } catch (error) {
      status = 'recovery-failed';
      showOverlay(
        'recovery-failed',
        'Recovery failed',
        error instanceof Error ? error.message : String(error),
      );
      const result = toFailed(requestId, thisRevision, new ScayvoError('RECOVERY_FAILED', 'Reset failed.'));
      sendResult(result);
      return result;
    }
  };

  window.addEventListener('keydown', (event) => {
    const action = deckActionFromKey(event, { remoteNumbers: remoteMode });
    if (!action) return;
    if (action.type === 'escape') {
      remoteMode = false;
      emitState();
      return;
    }
    if (!remoteMode) return;
    event.preventDefault();
    if (action.type === 'replay' && currentSceneId) void apply(currentSceneId);
    if (action.type === 'reset') void reset();
    if (action.type === 'next' || action.type === 'prev') {
      const index = currentSceneId ? session.order.indexOf(currentSceneId) : -1;
      const next = action.type === 'next' ? index + 1 : index - 1;
      if (next < 0 || next >= session.order.length) return;
      void apply(session.order[next]);
    }
    if (action.type === 'scene-index') {
      const id = session.order[action.index];
      if (id) void apply(id);
    }
  });

  connect();

  if (needRecovery && journal) {
    showOverlay(
      'recovery',
      'Restore managed inputs first',
      'The last session did not finish cleanly or the config hash changed. SCAYVO restored the baseline and will not apply a scene over an unknown baseline.',
    );
    restoreBaselineStorage(baseline.storage, session.managedStorage, {
      local: localStorage,
      session: sessionStorage,
    });
    const recoveryContext: SceneContext = {
      sceneId: null,
      revision,
      signal: controller.signal,
      custom: {},
    };
    await restoreAllAdapters(recoveryContext);
    await network.stopInterception();
    replaceRoute(baseline.route);
    await mountWith(recoveryContext);
    status = 'idle';
    currentSceneId = null;
    emitState();
  } else {
    const resumeId =
      journal?.phase === 'active' && journal.configHash === session.configHash
        ? journal.sceneId
        : session.initialScene;
    await apply(resumeId ?? session.initialScene);
  }

  const engine: Engine = {
    apply,
    reset,
    getSceneId: () => currentSceneId,
  };
  return engine;
}

async function captureAdapters(adapters: Record<string, Adapter>): Promise<Record<string, Json>> {
  const snapshot: Record<string, Json> = {};
  for (const [name, adapter] of Object.entries(adapters)) {
    snapshot[name] = await adapter.capture();
  }
  return snapshot;
}

function toFailed(requestId: string, revision: number, error: unknown): Result {
  if (error instanceof ScayvoError) {
    return {
      protocol: 1,
      requestId,
      revision,
      type: 'COMMAND_FAILED',
      error: { code: error.code, message: error.message, path: error.path, fix: error.fix },
    };
  }
  return {
    protocol: 1,
    requestId,
    revision,
    type: 'COMMAND_FAILED',
    error: {
      code: 'RECOVERY_FAILED',
      message: error instanceof Error ? error.message : String(error),
    },
  };
}

async function withWatchdog(controller: AbortController, work: () => Promise<void>): Promise<void> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => {
      controller.abort();
      reject(new ScayvoError('TRANSITION_TIMEOUT', 'Scene transition exceeded 10 seconds.'));
    }, TRANSITION_WATCHDOG_MS);
  });
  try {
    await Promise.race([work(), timeout]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}
