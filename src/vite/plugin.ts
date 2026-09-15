import { randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer } from 'vite';
import { WebSocketServer, type WebSocket } from 'ws';
import { ScayvoError } from '../core/errors.js';
import { prepareConfig, directorSafeConfig, type PreparedConfig } from '../core/prepare.js';
import {
  API_PATH,
  AUTH_TIMEOUT_MS,
  CONTROL_BASE,
  MAX_MESSAGE_BYTES,
  RESULT_CACHE_LIMIT,
  VIRTUAL_SESSION_ID,
  WORKER_PATH,
  WS_PATH,
  type AuthMessage,
  type ClientRole,
  type ConnectionLabel,
  type RuntimeFile,
  type StatusMessage,
  type UnhandledRequest,
} from '../core/protocol.js';
import type { Command, Result } from '../core/types.js';
import { findConfigPath, loadConfigModule } from './load-config.js';
import { resolveMswWorkerPath } from './msw-worker.js';
import { writeRuntimeFile } from './runtime-file.js';
import {
  assertControlRequest,
  isWildcardBind,
  tokenFromHeaders,
} from './security.js';

export type ScayvoPluginOptions = {
  config?: string;
  projectId?: string;
};

type SocketRecord = {
  ws: WebSocket;
  role: ClientRole;
  clientId: string;
  authed: boolean;
};

type SessionState = {
  app: SocketRecord | null;
  directors: Set<SocketRecord>;
  clis: Set<SocketRecord>;
  lastResults: Map<string, Result>;
  lastStatus: StatusMessage | null;
  unhandled: UnhandledRequest[];
  prepared: PreparedConfig | null;
  token: string;
  projectId: string;
  enabled: boolean;
  configChanged: boolean;
  apiHits: number;
};

const VIRTUAL_RESOLVED = `\0${VIRTUAL_SESSION_ID}`;
const PROD_STUB_ID = '\0scayvo-prod-stub';

function isBuildOnlyImport(id: string): boolean {
  return (
    id === 'scayvo/client' ||
    id === 'scayvo/react' ||
    id === 'msw' ||
    id === 'msw/browser' ||
    id === VIRTUAL_SESSION_ID
  );
}

export function scayvo(options: ScayvoPluginOptions = {}): Plugin {
  const state: SessionState = {
    app: null,
    directors: new Set(),
    clis: new Set(),
    lastResults: new Map(),
    lastStatus: null,
    unhandled: [],
    prepared: null,
    token: randomBytes(32).toString('base64url'),
    projectId: options.projectId ?? 'scayvo-project',
    enabled: false,
    configChanged: false,
    apiHits: 0,
  };

  let configPath = '';
  let projectRoot = '';
  let command: 'build' | 'serve' = 'serve';
  let wss: WebSocketServer | undefined;
  const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

  return {
    name: 'scayvo',
    enforce: 'pre',
    config(_config, env) {
      command = env.command;
      return {
        optimizeDeps: {
          exclude: ['scayvo', 'scayvo/client', 'scayvo/react'],
        },
      };
    },
    configResolved(config) {
      projectRoot = config.root;
      try {
        configPath = findConfigPath(projectRoot, options.config);
      } catch {
        configPath = '';
      }
      if (!options.projectId) {
        state.projectId = inferProjectId(projectRoot);
      }
    },
    resolveId(id) {
      if (command === 'build' && isBuildOnlyImport(id)) {
        return id === VIRTUAL_SESSION_ID ? VIRTUAL_RESOLVED : PROD_STUB_ID;
      }
      if (id === VIRTUAL_SESSION_ID) return VIRTUAL_RESOLVED;
      return undefined;
    },
    async load(id) {
      if (id === PROD_STUB_ID) {
        return [
          'export async function startScayvo() {',
          '  throw new Error("SCAYVO client is omitted from production builds.");',
          '}',
          'export function createReactIntegration() {',
          '  throw new Error("SCAYVO React helpers are omitted from production builds.");',
          '}',
          'export function setupWorker() {',
          '  throw new Error("MSW is omitted from production builds.");',
          '}',
        ].join('\n');
      }
      if (id !== VIRTUAL_RESOLVED) return undefined;
      if (command === 'build' || !state.enabled || !state.prepared) {
        return `export const session = { enabled: false };\nexport default session;\n`;
      }
      return sessionModuleSource(state);
    },
    async configureServer(server) {
      const bindHost = server.config.server.host;
      if (isWildcardBind(bindHost)) {
        server.config.logger.warn(
          '[scayvo] Control endpoints disabled because the dev server is bound beyond loopback.',
        );
        state.enabled = false;
        return;
      }
      state.enabled = true;

      const workerFile = resolveMswWorkerPath();

      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const url = new URL(req.url, 'http://127.0.0.1');
        if (url.pathname.startsWith('/api/')) {
          state.apiHits += 1;
        }
        next();
      });

      server.middlewares.use(async (req, res, next) => {
        try {
          if (!state.enabled) return next();
          const host = req.headers.host ?? '';
          const url = new URL(req.url ?? '/', `http://${host}`);
          if (url.pathname === WORKER_PATH) {
            const gate = assertControlRequest({ host: req.headers.host, origin: originOf(req) });
            if (!gate.ok) return sendText(res, gate.status, gate.message);
            const body = readFileSync(workerFile);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.setHeader('Service-Worker-Allowed', '/');
            res.setHeader('Cache-Control', 'no-store');
            res.end(body);
            return;
          }
          if (url.pathname === WS_PATH) return next();
          if (url.pathname === `${API_PATH}/command` || url.pathname === `${API_PATH}/status` || url.pathname === `${API_PATH}/config` || url.pathname === `${API_PATH}/meta` || url.pathname === `${API_PATH}/diagnostics`) {
            await handleApi(req, res, url, state);
            return;
          }
          if (url.pathname === CONTROL_BASE || url.pathname.startsWith(`${CONTROL_BASE}/`)) {
            await handleDirector(req, res, url, state, pluginRoot);
            return;
          }
          next();
        } catch (error) {
          sendJson(res, 500, {
            error: { code: 'CONFIG_INVALID', message: error instanceof Error ? error.message : String(error) },
          });
        }
      });

      const boot = async () => {
        if (!configPath) {
          server.config.logger.warn('[scayvo] No scayvo.config.ts found. Control UI is idle until one exists.');
          return;
        }
        try {
          await reloadPrepared(server, configPath, projectRoot, state);
          watchConfig(server, configPath, projectRoot, state);
        } catch (error) {
          const message = formatError(error);
          server.config.logger.error(`[scayvo] ${message}`);
        }
      };
      await boot();

      const attach = () => {
        const httpServer = server.httpServer;
        if (!httpServer || wss) return;
        wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
        httpServer.on('upgrade', (req, socket, head) => {
          const host = req.headers.host ?? '';
          const url = new URL(req.url ?? '/', `http://${host}`);
          if (url.pathname !== WS_PATH) return;
          const gate = assertControlRequest({ host: req.headers.host, origin: originOf(req) });
          if (!gate.ok) {
            socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
            socket.destroy();
            return;
          }
          wss?.handleUpgrade(req, socket, head, (ws) => {
            wss?.emit('connection', ws, req);
          });
        });
        wss.on('connection', (ws) => attachSocket(ws, state));
      };

      if (server.httpServer) attach();
      queueMicrotask(attach);

      const onListen = async () => {
        const addr = server.httpServer?.address();
        const port = typeof addr === 'object' && addr ? addr.port : server.config.server.port ?? 5173;
        const host = '127.0.0.1';
        const runtime: RuntimeFile = {
          protocol: 1,
          projectId: state.projectId,
          token: state.token,
          host,
          port,
          pid: process.pid,
          startedAt: new Date().toISOString(),
          wsPath: WS_PATH,
          directorUrl: `http://${host}:${port}${CONTROL_BASE}/`,
          appUrl: `http://${host}:${port}/`,
        };
        await writeRuntimeFile(projectRoot, runtime);
        server.config.logger.info(`  [scayvo] Director http://${host}:${port}${CONTROL_BASE}/`);
        server.config.logger.info(`  [scayvo] App      http://${host}:${port}/`);
      };
      server.httpServer?.once('listening', () => {
        void onListen();
      });
      if (server.httpServer?.listening) void onListen();
    },
    closeBundle() {
      wss?.close();
    },
  };
}

function inferProjectId(projectRoot: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')) as { name?: string };
    if (pkg.name) return pkg.name.replace(/^@/, '').replace(/\//g, '-');
  } catch {
    // fall through
  }
  return 'scayvo-project';
}

async function reloadPrepared(
  server: ViteDevServer,
  configPath: string,
  projectRoot: string,
  state: SessionState,
): Promise<void> {
  const input = await loadConfigModule(configPath, server);
  const prepared = await prepareConfig({
    input,
    projectRoot,
    configDir: dirname(configPath),
    configPath,
  });
  const previous = state.prepared?.configHash;
  state.prepared = prepared;
  if (previous && previous !== prepared.configHash) {
    state.configChanged = true;
    broadcast(state, { protocol: 1, type: 'CONFIG_CHANGED', configHash: prepared.configHash });
  }
  const virtualMod =
    server.moduleGraph.getModuleById(VIRTUAL_RESOLVED) ??
    server.moduleGraph.getModuleById(VIRTUAL_SESSION_ID);
  if (virtualMod) server.moduleGraph.invalidateModule(virtualMod);
}

function watchConfig(
  server: ViteDevServer,
  configPath: string,
  projectRoot: string,
  state: SessionState,
): void {
  const files = new Set([configPath]);
  for (const scene of Object.values(state.prepared?.scenes ?? {})) {
    void scene;
  }
  if (state.prepared) {
    for (const ref of Object.keys(state.prepared.fixtures)) {
      files.add(join(dirname(configPath), ref));
    }
  }
  for (const file of files) {
    if (existsSync(file)) server.watcher.add(file);
  }
  server.watcher.on('change', (changed) => {
    if (![...files].some((file) => changed === file || changed.endsWith(file))) return;
    void reloadPrepared(server, configPath, projectRoot, state).catch((error) => {
      server.config.logger.error(`[scayvo] ${formatError(error)}`);
    });
  });
}

function sessionModuleSource(state: SessionState): string {
  const prepared = state.prepared!;
  const payload = {
    enabled: true,
    protocol: 1,
    projectId: state.projectId,
    token: state.token,
    wsPath: WS_PATH,
    workerPath: WORKER_PATH,
    configHash: prepared.configHash,
    initialScene: prepared.config.initialScene,
    order: prepared.config.order,
    network: prepared.config.network,
    managedStorage: prepared.config.managedStorage,
    scenes: prepared.scenes,
  };
  return `export const session = ${JSON.stringify(payload)};\nexport default session;\n`;
}

async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  state: SessionState,
): Promise<void> {
  const gate = assertControlRequest({ host: req.headers.host, origin: originOf(req) });
  if (!gate.ok) return sendText(res, gate.status, gate.message);
  if (url.pathname === `${API_PATH}/meta`) {
    if (!state.prepared) return sendJson(res, 400, { error: { code: 'CONFIG_INVALID', message: 'Config is not loaded.' } });
    return sendJson(res, 200, directorSafeConfig(state.prepared));
  }
  const token = tokenFromHeaders(req.headers as Record<string, string | string[] | undefined>);
  if (token !== state.token) return sendJson(res, 401, { error: { code: 'UNAUTHORIZED', message: 'Invalid token.' } });

  if (url.pathname === `${API_PATH}/status`) {
    return sendJson(res, 200, {
      connection: connectionLabel(state),
      appConnected: Boolean(state.app),
      configHash: state.prepared?.configHash ?? null,
      configChanged: state.configChanged,
      lastStatus: state.lastStatus,
      unhandled: state.unhandled.slice(-20),
    });
  }
  if (url.pathname === `${API_PATH}/config`) {
    if (!state.prepared) return sendJson(res, 400, { error: { code: 'CONFIG_INVALID', message: 'Config is not loaded.' } });
    return sendJson(res, 200, {
      hash: state.prepared.configHash,
      scenes: state.prepared.scenes,
      config: {
        initialScene: state.prepared.config.initialScene,
        order: state.prepared.config.order,
        network: state.prepared.config.network,
        managedStorage: state.prepared.config.managedStorage,
      },
    });
  }
  if (url.pathname === `${API_PATH}/diagnostics`) {
    return sendJson(res, 200, { apiHits: state.apiHits, unhandled: state.unhandled });
  }
  if (url.pathname === `${API_PATH}/command` && req.method === 'POST') {
    const body = await readJson(req);
    const command = body as Command;
    const result = await dispatchCommand(state, command);
    return sendJson(res, result.httpStatus, result.body);
  }
  sendJson(res, 404, { error: { code: 'UNAUTHORIZED', message: 'Unknown control route.' } });
}

async function handleDirector(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  state: SessionState,
  pluginRoot: string,
): Promise<void> {
  const gate = assertControlRequest({ host: req.headers.host, origin: originOf(req) });
  if (!gate.ok) return sendText(res, gate.status, gate.message);
  const directorDir = join(pluginRoot, 'dist', 'director');
  let relative = url.pathname.slice(CONTROL_BASE.length) || '/';
  if (relative === '/') relative = '/index.html';
  const filePath = join(directorDir, relative.replace(/^\//, ''));
  if (!filePath.startsWith(directorDir)) return sendText(res, 403, 'Forbidden');
  if (!existsSync(filePath)) {
    const index = join(directorDir, 'index.html');
    if (existsSync(index) && !relative.includes('.')) {
      return sendDirectorHtml(res, index, state);
    }
    return sendText(res, 404, 'Director assets are missing. Build scayvo first.');
  }
  if (filePath.endsWith('index.html')) return sendDirectorHtml(res, filePath, state);
  const body = readFileSync(filePath);
  res.statusCode = 200;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', contentType(filePath));
  res.end(body);
}

function sendDirectorHtml(res: ServerResponse, filePath: string, state: SessionState): void {
  let html = readFileSync(filePath, 'utf8');
  const bootstrap = `<script>window.__SCAYVO_DIRECTOR__=${JSON.stringify({
    protocol: 1,
    projectId: state.projectId,
    token: state.token,
    wsPath: WS_PATH,
    configHash: state.prepared?.configHash ?? null,
    scenes: state.prepared ? directorSafeConfig(state.prepared) : null,
  })};</script>`;
  if (html.includes('<!--SCAYVO_BOOTSTRAP-->')) {
    html = html.replace('<!--SCAYVO_BOOTSTRAP-->', bootstrap);
  } else {
    html = html.replace('</head>', `${bootstrap}</head>`);
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(html);
}

function attachSocket(ws: WebSocket, state: SessionState): void {
  let record: SocketRecord | null = null;
  const timer = setTimeout(() => {
    ws.close(4001, 'auth timeout');
  }, AUTH_TIMEOUT_MS);

  ws.on('message', (raw) => {
    if (Buffer.byteLength(raw.toString()) > MAX_MESSAGE_BYTES) {
      ws.close(1009, 'too large');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      ws.close(1003, 'invalid json');
      return;
    }
    if (!record) {
      clearTimeout(timer);
      const auth = parsed as AuthMessage;
      if (!isAuth(auth) || auth.token !== state.token || auth.projectId !== state.projectId) {
        send(ws, {
          protocol: 1,
          type: 'AUTH_FAILED',
          code: 'UNAUTHORIZED',
          message: 'Invalid token or project.',
        });
        ws.close(4003, 'unauthorized');
        return;
      }
      if (auth.role === 'app' && state.app) {
        send(ws, {
          protocol: 1,
          type: 'ALREADY_CONNECTED',
          message: 'Already connected. v0.1 supports one app client.',
        });
        ws.close(4009, 'already connected');
        return;
      }
      record = { ws, role: auth.role, clientId: auth.clientId, authed: true };
      if (auth.role === 'app') state.app = record;
      if (auth.role === 'director') state.directors.add(record);
      if (auth.role === 'cli') state.clis.add(record);
      send(ws, {
        protocol: 1,
        type: 'AUTH_OK',
        role: auth.role,
        projectId: state.projectId,
        configHash: state.prepared?.configHash ?? '',
      });
      if (auth.role !== 'app') {
        send(ws, statusFromState(state));
      }
      broadcastStatus(state);
      return;
    }
    void handleAuthedMessage(state, record, parsed);
  });

  ws.on('close', () => {
    clearTimeout(timer);
    if (!record) return;
    if (record.role === 'app' && state.app === record) state.app = null;
    state.directors.delete(record);
    state.clis.delete(record);
    broadcastStatus(state);
  });
}

async function handleAuthedMessage(state: SessionState, record: SocketRecord, parsed: unknown): Promise<void> {
  if (!isRecord(parsed) || parsed.protocol !== 1) {
    send(record.ws, {
      protocol: 1,
      type: 'AUTH_FAILED',
      code: 'PROTOCOL_MISMATCH',
      message: 'protocol must be 1',
    });
    return;
  }
  if (record.role === 'app' && parsed.type === 'STATE') {
    state.lastStatus = parsed as StatusMessage;
    if (Array.isArray((parsed as StatusMessage).unhandled)) {
      state.unhandled = (parsed as StatusMessage).unhandled;
    }
    broadcastToControllers(state, parsed);
    return;
  }
  if (record.role === 'app' && (parsed.type === 'SCENE_APPLIED' || parsed.type === 'RESET_COMPLETED' || parsed.type === 'COMMAND_FAILED')) {
    const result = parsed as Result;
    rememberResult(state, result);
    broadcastToControllers(state, result);
    return;
  }
  if ((record.role === 'director' || record.role === 'cli') && parsed.type === 'CONTROL') {
    if (state.app) send(state.app.ws, parsed);
    return;
  }
  if ((record.role === 'director' || record.role === 'cli') && (parsed.type === 'SCENE_APPLY' || parsed.type === 'RESET')) {
    const result = await dispatchCommand(state, parsed as Command);
    send(record.ws, result.body);
  }
}

async function dispatchCommand(
  state: SessionState,
  command: Command,
): Promise<{ httpStatus: number; body: Result | Record<string, unknown> }> {
  if (!command || command.protocol !== 1) {
    return {
      httpStatus: 400,
      body: failResult(command?.requestId ?? 'unknown', 'PROTOCOL_MISMATCH', 'protocol must be 1'),
    };
  }
  if (command.projectId !== state.projectId) {
    return {
      httpStatus: 403,
      body: failResult(command.requestId, 'UNAUTHORIZED', 'projectId does not match this session'),
    };
  }
  if (state.lastResults.has(command.requestId)) {
    return { httpStatus: 200, body: state.lastResults.get(command.requestId)! };
  }
  if (!state.app) {
    const result = failResult(command.requestId, 'NO_CLIENT', 'No app client is connected.');
    rememberResult(state, result);
    return { httpStatus: 409, body: result };
  }
  if (state.configChanged && command.configHash !== state.prepared?.configHash) {
    const result = failResult(command.requestId, 'CONFIG_CHANGED', 'Configuration changed. Reset and reload the app.');
    rememberResult(state, result);
    return { httpStatus: 409, body: result };
  }
  send(state.app.ws, command);
  return { httpStatus: 202, body: { protocol: 1, type: 'COMMAND_FORWARDED', requestId: command.requestId } };
}

function rememberResult(state: SessionState, result: Result): void {
  state.lastResults.set(result.requestId, result);
  if (state.lastResults.size > RESULT_CACHE_LIMIT) {
    const first = state.lastResults.keys().next().value;
    if (first) state.lastResults.delete(first);
  }
}

function failResult(requestId: string, code: string, message: string): Result {
  return {
    protocol: 1,
    requestId,
    revision: 0,
    type: 'COMMAND_FAILED',
    error: { code, message },
  };
}

function connectionLabel(state: SessionState): ConnectionLabel {
  if (state.lastStatus?.connection === 'recovery-failed') return 'recovery-failed';
  if (state.lastStatus?.connection === 'applying') return 'applying';
  if (state.app && state.lastStatus?.connection === 'active') return 'active';
  if (state.app) return 'connected';
  return 'waiting';
}

function statusFromState(state: SessionState): StatusMessage {
  return (
    state.lastStatus ?? {
      protocol: 1,
      type: 'STATE',
      revision: 0,
      connection: connectionLabel(state),
      sceneId: null,
      route: '/',
      remoteMode: false,
      unhandled: [],
      configHash: state.prepared?.configHash ?? '',
    }
  );
}

function broadcastStatus(state: SessionState): void {
  broadcastToControllers(state, statusFromState(state));
}

function broadcastToControllers(state: SessionState, message: unknown): void {
  for (const record of [...state.directors, ...state.clis]) {
    send(record.ws, message);
  }
}

function broadcast(state: SessionState, message: unknown): void {
  if (state.app) send(state.app.ws, message);
  broadcastToControllers(state, message);
}

function send(ws: WebSocket, message: unknown): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
}

function isAuth(value: unknown): value is AuthMessage {
  return (
    isRecord(value) &&
    value.protocol === 1 &&
    value.type === 'AUTH' &&
    typeof value.token === 'string' &&
    typeof value.role === 'string' &&
    typeof value.clientId === 'string' &&
    typeof value.projectId === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function originOf(req: IncomingMessage): string | undefined {
  const origin = req.headers.origin;
  return Array.isArray(origin) ? origin[0] : origin;
}

function sendText(res: ServerResponse, status: number, body: string): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(`${JSON.stringify(body)}\n`);
}

function contentType(filePath: string): string {
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.map')) return 'application/json';
  return 'application/octet-stream';
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > MAX_MESSAGE_BYTES) throw new Error('payload too large');
    chunks.push(buf);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function formatError(error: unknown): string {
  if (error instanceof ScayvoError) return `${error.code}: ${error.message}`;
  if (error instanceof Error) return error.message;
  return String(error);
}
