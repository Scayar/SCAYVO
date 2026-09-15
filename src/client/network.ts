import { http, HttpResponse, passthrough } from 'msw';
import { setupWorker, type SetupWorker } from 'msw/browser';
import { findMockForRequest } from '../core/matchers.js';
import { pathInScope } from '../core/scope.js';
import { ScayvoError } from '../core/errors.js';
import { NO_BODY_STATUSES, type ResolvedMock, type ResolvedScene } from '../core/types.js';
import type { UnhandledRequest } from '../core/protocol.js';

export type NetworkPlan = {
  revision: number;
  active: boolean;
  scope: string[];
  mocks: ResolvedMock[];
};

type MswController = {
  applyScene(scene: ResolvedScene, revision: number): Promise<void>;
  stopInterception(): Promise<void>;
  isRunning(): boolean;
};

export async function startNetwork(options: {
  workerUrl: string;
  scope: string[];
  onUnhandled: (entry: UnhandledRequest) => void;
  getGeneration: () => { revision: number; signal: AbortSignal };
}): Promise<MswController> {
  await assertNoForeignWorker(options.workerUrl);

  const plan: NetworkPlan = {
    revision: 0,
    active: true,
    scope: options.scope,
    mocks: [],
  };

  const handler = http.all('*', async ({ request }) => {
    const url = new URL(request.url);
    if (url.origin !== window.location.origin) return passthrough();
    if (!pathInScope(url.pathname, plan.scope)) return passthrough();
    if (!plan.active) return passthrough();

    const generation = options.getGeneration();
    const index = findMockForRequest(plan.mocks, request.method, url.pathname, url.searchParams);
    if (index === -1) {
      options.onUnhandled({
        id: crypto.randomUUID(),
        method: request.method,
        path: `${url.pathname}${url.search}`,
        at: Date.now(),
      });
      return HttpResponse.error();
    }

    const mock = plan.mocks[index];
    const delayMs = mock.delayMs ?? 0;
    if (delayMs > 0) {
      const aborted = await abortableDelay(delayMs, generation.signal);
      if (aborted || options.getGeneration().revision !== generation.revision) {
        return HttpResponse.error();
      }
    } else if (generation.signal.aborted || options.getGeneration().revision !== generation.revision) {
      return HttpResponse.error();
    }

    if (mock.error === 'network') {
      return HttpResponse.error();
    }

    const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
    const status = mock.response.status;
    const noBody = NO_BODY_STATUSES.has(status) || request.method === 'HEAD';
    if (noBody || !('json' in mock.response)) {
      return new HttpResponse(null, { status, headers });
    }
    return HttpResponse.json(mock.response.json, { status, headers });
  });

  const worker: SetupWorker = setupWorker(handler);
  await worker.start({
    quiet: true,
    onUnhandledRequest: 'bypass',
    serviceWorker: {
      url: options.workerUrl,
      options: { scope: '/' },
    },
  });

  let running = true;

  return {
    async applyScene(scene, revision) {
      plan.mocks = scene.mocks;
      plan.revision = revision;
      plan.active = true;
      if (!running) {
        await worker.start({
          quiet: true,
          onUnhandledRequest: 'bypass',
          serviceWorker: {
            url: options.workerUrl,
            options: { scope: '/' },
          },
        });
        running = true;
      }
    },
    async stopInterception() {
      plan.active = false;
      plan.mocks = [];
      if (running) {
        await quiesce();
        worker.stop();
        running = false;
      }
    },
    isRunning() {
      return running;
    },
  };
}

async function abortableDelay(ms: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return true;
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(false);
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      resolve(true);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function quiesce(): Promise<void> {
  await new Promise((r) => setTimeout(r, 20));
}

async function assertNoForeignWorker(ourUrl: string): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    throw new ScayvoError('WORKER_CONFLICT', 'This browser does not expose Service Workers.');
  }
  const ours = new URL(ourUrl, window.location.origin).href;
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    const script =
      registration.active?.scriptURL ??
      registration.waiting?.scriptURL ??
      registration.installing?.scriptURL ??
      '';
    if (!script) continue;
    if (script === ours) continue;
    const scopePath = new URL(registration.scope).pathname;
    if (scopePath === '/' || scopePath === '' || ourScopeOverlaps(scopePath)) {
      throw new ScayvoError(
        'WORKER_CONFLICT',
        `Another Service Worker is registered for ${registration.scope}. SCAYVO will not unregister it.`,
      );
    }
  }
}

function ourScopeOverlaps(scopePath: string): boolean {
  return scopePath === '/' || window.location.pathname.startsWith(scopePath);
}
