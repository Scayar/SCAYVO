export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

export type StoragePatch = Record<string, string | null>;

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

export type MockReply =
  | { status: number; json: Json; fixture?: never }
  | { status: number; fixture: string; json?: never }
  | { status: number; json?: never; fixture?: never };

export type Mock = {
  method: HttpMethod;
  path: string;
  query?: Record<string, string>;
} & (
  | { response: MockReply; delayMs?: number; error?: never }
  | { error: 'network'; response?: never; delayMs?: number }
);

export type Scene = {
  title: string;
  route?: string;
  storage?: {
    local?: StoragePatch;
    session?: StoragePatch;
  };
  mocks?: Mock[];
  custom?: Record<string, Json>;
};

export type Config = {
  version: 1;
  initialScene: string;
  network: {
    scope: string[];
    onUnhandled: 'block';
  };
  managedStorage: {
    local: string[];
    session: string[];
  };
  defaults?: Omit<Scene, 'title'>;
  order: string[];
  scenes: Record<string, Scene>;
};

export type ResolvedMockReply =
  | { status: number; json: Json }
  | { status: number };

export type ResolvedMock = {
  method: HttpMethod;
  path: string;
  query?: Record<string, string>;
} & (
  | { response: ResolvedMockReply; delayMs?: number; error?: never }
  | { error: 'network'; response?: never; delayMs?: number }
);

export type ResolvedStorage = {
  local: StoragePatch;
  session: StoragePatch;
};

export type ResolvedScene = {
  id: string;
  title: string;
  route?: string;
  storage: ResolvedStorage;
  mocks: ResolvedMock[];
  custom: Record<string, Json>;
};

export type BaselineStorageValue = { kind: 'absent' } | { kind: 'value'; value: string };

export type BaselineStorage = {
  local: Record<string, BaselineStorageValue>;
  session: Record<string, BaselineStorageValue>;
};

export type SceneContext = {
  sceneId: string | null;
  revision: number;
  signal: AbortSignal;
  custom: Record<string, Json>;
};

export type MountedApp = {
  dispose(): Promise<void>;
};

export type AppIntegration = {
  mount(context: SceneContext): Promise<MountedApp>;
};

export type Adapter = {
  capture(): Json | Promise<Json>;
  apply(value: Json, context: SceneContext): Promise<void>;
  restore(snapshot: Json, context: SceneContext): Promise<void>;
};

export type CommandType = 'SCENE_APPLY' | 'RESET';

export type Command = {
  protocol: 1;
  projectId: string;
  clientId: string;
  requestId: string;
  configHash: string;
  type: CommandType;
  sceneId?: string;
};

export type ResultType = 'SCENE_APPLIED' | 'RESET_COMPLETED' | 'COMMAND_FAILED';

export type ResultError = {
  code: string;
  message: string;
  path?: string;
  fix?: string;
};

export type Result = {
  protocol: 1;
  requestId: string;
  revision: number;
  type: ResultType;
  error?: ResultError;
};

export const ERROR_CODES = [
  'CONFIG_INVALID',
  'FIXTURE_NOT_FOUND',
  'FIXTURE_INVALID_JSON',
  'FIXTURE_OUTSIDE_ROOT',
  'FIXTURE_TOO_LARGE',
  'NO_CLIENT',
  'PROTOCOL_MISMATCH',
  'ADAPTER_MISSING',
  'WORKER_CONFLICT',
  'UNHANDLED_REQUEST',
  'STORAGE_UNAVAILABLE',
  'STORAGE_CONFLICT',
  'TRANSITION_TIMEOUT',
  'RECOVERY_FAILED',
  'BUSY',
  'SCENE_NOT_FOUND',
  'ALREADY_CONNECTED',
  'UNAUTHORIZED',
  'CONFIG_CHANGED',
  'LOOPBACK_REQUIRED',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const SCENE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const HTTP_METHODS: readonly HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
];
export const MAX_DELAY_MS = 30_000;
export const MAX_FIXTURE_BYTES = 1 * 1024 * 1024;
export const MAX_RESOLVED_BYTES = 5 * 1024 * 1024;
export const TRANSITION_WATCHDOG_MS = 10_000;
export const PROTOCOL_VERSION = 1 as const;
export const CONFIG_VERSION = 1 as const;
export const NO_BODY_STATUSES = new Set([204, 205, 304]);
