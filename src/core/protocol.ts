export const CONTROL_BASE = '/__scayvo';
export const WS_PATH = '/__scayvo/ws';
export const API_PATH = '/__scayvo/api';
export const WORKER_PATH = '/__scayvo/mockServiceWorker.js';
export const VIRTUAL_SESSION_ID = 'virtual:scayvo/session';
export const JOURNAL_KEY_PREFIX = 'scayvo:journal:';
export const MAX_MESSAGE_BYTES = 1_000_000;
export const AUTH_TIMEOUT_MS = 5_000;
export const RESULT_CACHE_LIMIT = 100;
export const RUNTIME_DIR = '.scayvo';
export const RUNTIME_FILE = 'runtime.json';

export type ClientRole = 'app' | 'director' | 'cli';

export type AuthMessage = {
  protocol: 1;
  type: 'AUTH';
  token: string;
  role: ClientRole;
  clientId: string;
  projectId: string;
};

export type StatusMessage = {
  protocol: 1;
  type: 'STATE';
  requestId?: string;
  revision: number;
  connection: ConnectionLabel;
  sceneId: string | null;
  route: string;
  remoteMode: boolean;
  filmMode?: boolean;
  hideDemoBadge?: boolean;
  unhandled: UnhandledRequest[];
  diagnostic?: { code: string; message: string; path?: string; fix?: string };
  configHash: string;
  recovery?: boolean;
};

export type ConnectionLabel =
  | 'waiting'
  | 'connected'
  | 'applying'
  | 'active'
  | 'reconnecting'
  | 'failed'
  | 'recovery-failed';

export type UnhandledRequest = {
  id: string;
  method: string;
  path: string;
  at: number;
};

export type ServerEvent =
  | { protocol: 1; type: 'AUTH_OK'; role: ClientRole; projectId: string; configHash: string }
  | { protocol: 1; type: 'AUTH_FAILED'; code: string; message: string }
  | { protocol: 1; type: 'ALREADY_CONNECTED'; message: string }
  | { protocol: 1; type: 'CONFIG_CHANGED'; configHash: string }
  | { protocol: 1; type: 'COMMAND_FORWARDED'; requestId: string }
  | StatusMessage
  | import('./types.js').Command
  | import('./types.js').Result;

export type RuntimeFile = {
  protocol: 1;
  projectId: string;
  token: string;
  host: string;
  port: number;
  pid: number;
  startedAt: string;
  wsPath: string;
  directorUrl: string;
  appUrl: string;
};
