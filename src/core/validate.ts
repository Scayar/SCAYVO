import { ScayvoError } from './errors.js';
import { isSceneId } from './ids.js';
import { findOverlappingPair, matcherKey, matcherIdentity } from './matchers.js';
import { isSameOriginAbsolutePath } from './paths.js';
import { validateScopePrefix } from './scope.js';
import {
  CONFIG_VERSION,
  HTTP_METHODS,
  MAX_DELAY_MS,
  NO_BODY_STATUSES,
  type Config,
  type HttpMethod,
  type Json,
  type Mock,
  type MockReply,
  type Scene,
} from './types.js';

const TITLE_RE = /\S/;

export type ValidationIssue = {
  path: string;
  message: string;
};

export function validateConfig(input: unknown): Config {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) {
    throw new ScayvoError('CONFIG_INVALID', 'Config must be an object.', { path: '' });
  }
  if (input.version !== CONFIG_VERSION) {
    issues.push({ path: 'version', message: 'version must be 1' });
  }
  if (typeof input.initialScene !== 'string' || !isSceneId(input.initialScene)) {
    issues.push({
      path: 'initialScene',
      message: 'initialScene must be a lowercase kebab-case scene id',
    });
  }
  validateNetwork(input.network, issues);
  validateManagedStorage(input.managedStorage, issues);
  if (input.defaults !== undefined) {
    if (!isRecord(input.defaults)) {
      issues.push({ path: 'defaults', message: 'defaults must be an object without title' });
    } else {
      if ('title' in input.defaults) {
        issues.push({ path: 'defaults.title', message: 'defaults cannot include title' });
      }
      validateSceneBody(input.defaults as Omit<Scene, 'title'>, 'defaults', issues, input.managedStorage);
    }
  }
  if (!Array.isArray(input.order) || input.order.some((id) => typeof id !== 'string')) {
    issues.push({ path: 'order', message: 'order must be an array of scene ids' });
  }
  if (!isRecord(input.scenes)) {
    issues.push({ path: 'scenes', message: 'scenes must be an object of scene definitions' });
  }

  const scenes = isRecord(input.scenes) ? input.scenes : {};
  const order = Array.isArray(input.order) ? (input.order as string[]) : [];

  for (const [id, scene] of Object.entries(scenes)) {
    if (!isSceneId(id)) {
      issues.push({ path: `scenes.${id}`, message: 'scene ids must be lowercase kebab-case' });
    }
    if (!isRecord(scene)) {
      issues.push({ path: `scenes.${id}`, message: 'scene must be an object' });
      continue;
    }
    if (typeof scene.title !== 'string' || !TITLE_RE.test(scene.title)) {
      issues.push({ path: `scenes.${id}.title`, message: 'title is required' });
    }
    validateSceneBody(scene as Scene, `scenes.${id}`, issues, input.managedStorage);
  }

  if (issues.length === 0) {
    validateOrder(order, Object.keys(scenes), input.initialScene as string, issues);
  }

  if (issues.length > 0) {
    const first = issues[0];
    throw new ScayvoError(
      'CONFIG_INVALID',
      issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'),
      { path: first.path },
    );
  }

  return input as Config;
}

function validateOrder(
  order: string[],
  sceneIds: string[],
  initialScene: string,
  issues: ValidationIssue[],
): void {
  const seen = new Set<string>();
  for (let i = 0; i < order.length; i += 1) {
    const id = order[i];
    if (!isSceneId(id)) {
      issues.push({ path: `order.${i}`, message: 'order ids must be lowercase kebab-case' });
    }
    if (seen.has(id)) {
      issues.push({ path: `order.${i}`, message: `duplicate scene id "${id}"` });
    }
    seen.add(id);
    if (!sceneIds.includes(id)) {
      issues.push({ path: `order.${i}`, message: `order references missing scene "${id}"` });
    }
  }
  for (const id of sceneIds) {
    if (!seen.has(id)) {
      issues.push({ path: `scenes.${id}`, message: `scene "${id}" is missing from order` });
    }
  }
  if (!sceneIds.includes(initialScene) || !order.includes(initialScene)) {
    issues.push({ path: 'initialScene', message: 'initialScene must exist in scenes and order' });
  }
}

function validateNetwork(network: unknown, issues: ValidationIssue[]): void {
  if (!isRecord(network)) {
    issues.push({ path: 'network', message: 'network is required' });
    return;
  }
  if (network.onUnhandled !== 'block') {
    issues.push({ path: 'network.onUnhandled', message: 'onUnhandled must be "block" in v0.1' });
  }
  if (!Array.isArray(network.scope) || network.scope.length === 0) {
    issues.push({ path: 'network.scope', message: 'network.scope must be a non-empty array' });
    return;
  }
  network.scope.forEach((prefix, index) => {
    if (typeof prefix !== 'string') {
      issues.push({ path: `network.scope.${index}`, message: 'scope prefix must be a string' });
      return;
    }
    const error = validateScopePrefix(prefix);
    if (error) issues.push({ path: `network.scope.${index}`, message: error });
  });
}

function validateManagedStorage(managed: unknown, issues: ValidationIssue[]): void {
  if (!isRecord(managed)) {
    issues.push({ path: 'managedStorage', message: 'managedStorage is required' });
    return;
  }
  for (const area of ['local', 'session'] as const) {
    if (!Array.isArray(managed[area]) || managed[area].some((key) => typeof key !== 'string' || key.length === 0)) {
      issues.push({ path: `managedStorage.${area}`, message: `${area} must be an array of storage keys` });
    }
  }
}

function validateSceneBody(
  scene: Partial<Scene>,
  path: string,
  issues: ValidationIssue[],
  managed: unknown,
): void {
  if (scene.route !== undefined) {
    if (typeof scene.route !== 'string' || !isSameOriginAbsolutePath(scene.route)) {
      issues.push({
        path: `${path}.route`,
        message: 'route must be a same-origin absolute path such as /checkout',
      });
    }
  }
  if (scene.storage !== undefined) {
    if (!isRecord(scene.storage)) {
      issues.push({ path: `${path}.storage`, message: 'storage must be an object' });
    } else {
      validateStoragePatch(scene.storage.local, `${path}.storage.local`, 'local', managed, issues);
      validateStoragePatch(scene.storage.session, `${path}.storage.session`, 'session', managed, issues);
    }
  }
  if (scene.custom !== undefined) {
    if (!isRecord(scene.custom)) {
      issues.push({ path: `${path}.custom`, message: 'custom must be an object of adapter names' });
    } else {
      for (const [name, value] of Object.entries(scene.custom)) {
        if (!isJson(value)) {
          issues.push({
            path: `${path}.custom.${name}`,
            message: 'custom adapter values must be JSON-serializable',
          });
        }
      }
    }
  }
  if (scene.mocks !== undefined) {
    if (!Array.isArray(scene.mocks)) {
      issues.push({ path: `${path}.mocks`, message: 'mocks must be an array' });
    } else {
      const keys = new Set<string>();
      scene.mocks.forEach((mock, index) => {
        validateMock(mock, `${path}.mocks.${index}`, issues);
        if (isRecord(mock) && typeof mock.method === 'string' && typeof mock.path === 'string') {
          const key = matcherKey(matcherIdentity(mock as Mock));
          if (keys.has(key)) {
            issues.push({
              path: `${path}.mocks.${index}`,
              message: `duplicate matcher ${key}`,
            });
          }
          keys.add(key);
        }
      });
      const overlap = findOverlappingPair(scene.mocks as Mock[]);
      if (overlap) {
        issues.push({
          path: `${path}.mocks.${overlap[1]}`,
          message: `ambiguous overlap with mocks.${overlap[0]} for the same request`,
        });
      }
    }
  }
}

function validateStoragePatch(
  patch: unknown,
  path: string,
  area: 'local' | 'session',
  managed: unknown,
  issues: ValidationIssue[],
): void {
  if (patch === undefined) return;
  if (!isRecord(patch)) {
    issues.push({ path, message: 'storage patch must be an object' });
    return;
  }
  const allow = isRecord(managed) && Array.isArray(managed[area]) ? (managed[area] as string[]) : [];
  for (const [key, value] of Object.entries(patch)) {
    if (!allow.includes(key)) {
      issues.push({
        path: `${path}.${key}`,
        message: `storage key "${key}" is not in managedStorage.${area}`,
      });
    }
    if (value !== null && typeof value !== 'string') {
      issues.push({ path: `${path}.${key}`, message: 'storage values must be string or null' });
    }
  }
}

function validateMock(mock: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(mock)) {
    issues.push({ path, message: 'mock must be an object' });
    return;
  }
  if (!HTTP_METHODS.includes(mock.method as HttpMethod)) {
    issues.push({ path: `${path}.method`, message: 'unsupported HTTP method' });
  }
  if (typeof mock.path !== 'string' || !isSameOriginAbsolutePath(mock.path) || mock.path.includes('?') || mock.path.includes('#')) {
    issues.push({
      path: `${path}.path`,
      message: 'path must be a same-origin absolute pathname such as /api/orders',
    });
  }
  if (mock.path === '/api/' || (typeof mock.path === 'string' && mock.path.includes('*'))) {
    issues.push({ path: `${path}.path`, message: 'v0.1 matches path literally; wildcards are not supported' });
  }
  if (mock.query !== undefined) {
    if (!isRecord(mock.query) || Object.values(mock.query).some((v) => typeof v !== 'string')) {
      issues.push({ path: `${path}.query`, message: 'query must be a string-to-string map' });
    }
  }
  if (mock.delayMs !== undefined) {
    if (!Number.isInteger(mock.delayMs) || (mock.delayMs as number) < 0 || (mock.delayMs as number) > MAX_DELAY_MS) {
      issues.push({ path: `${path}.delayMs`, message: 'delayMs must be an integer from 0 to 30000' });
    }
  }
  const hasResponse = 'response' in mock && mock.response !== undefined;
  const hasError = 'error' in mock && mock.error !== undefined;
  if (hasResponse === hasError) {
    issues.push({ path, message: 'mock must have exactly one of response or error' });
  }
  if (hasError && mock.error !== 'network') {
    issues.push({ path: `${path}.error`, message: 'error must be "network" in v0.1' });
  }
  if (hasResponse) validateReply(mock.response, `${path}.response`, mock.method as string, issues);
}

function validateReply(reply: unknown, path: string, method: string, issues: ValidationIssue[]): void {
  if (!isRecord(reply)) {
    issues.push({ path, message: 'response must be an object' });
    return;
  }
  if (!Number.isInteger(reply.status) || (reply.status as number) < 200 || (reply.status as number) > 599) {
    issues.push({ path: `${path}.status`, message: 'status must be an integer from 200 to 599' });
  }
  const hasJson = 'json' in reply && reply.json !== undefined;
  const hasFixture = 'fixture' in reply && reply.fixture !== undefined;
  if (hasJson && hasFixture) {
    issues.push({ path, message: 'json and fixture are mutually exclusive' });
  }
  if (hasFixture && (typeof reply.fixture !== 'string' || reply.fixture.length === 0)) {
    issues.push({ path: `${path}.fixture`, message: 'fixture must be a relative path string' });
  }
  if (hasFixture && typeof reply.fixture === 'string') {
    if (isAbsolutePath(reply.fixture) || reply.fixture.startsWith('file:')) {
      issues.push({ path: `${path}.fixture`, message: 'fixture paths must be relative, not absolute' });
    }
  }
  if (hasJson && !isJson(reply.json)) {
    issues.push({ path: `${path}.json`, message: 'json must be JSON-serializable' });
  }
  const status = reply.status as number;
  const noBody = NO_BODY_STATUSES.has(status) || method === 'HEAD';
  if (noBody && (hasJson || hasFixture)) {
    issues.push({ path, message: '204, 205, 304, and HEAD responses cannot include a body' });
  }
}

export function isJson(value: unknown): value is Json {
  if (value === null) return true;
  const t = typeof value;
  if (t === 'string' || t === 'boolean') return true;
  if (t === 'number') return Number.isFinite(value as number);
  if (Array.isArray(value)) return value.every(isJson);
  if (t === 'object') {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      return false;
    }
    return Object.values(value as Record<string, unknown>).every(isJson);
  }
  return false;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAbsolutePath(value: string): boolean {
  if (value.startsWith('/') || value.startsWith('\\')) return true;
  if (/^[a-zA-Z]:[\\/]/.test(value)) return true;
  return false;
}

export function assertNoResolvedOverlap(sceneId: string, mocks: Mock[]): void {
  const overlap = findOverlappingPair(mocks);
  if (!overlap) return;
  throw new ScayvoError(
    'CONFIG_INVALID',
    `Scene ${sceneId} has overlapping matchers at indexes ${overlap[0]} and ${overlap[1]}.`,
    { path: `scenes.${sceneId}.mocks.${overlap[1]}` },
  );
}
