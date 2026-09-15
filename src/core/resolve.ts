import { assertNoResolvedOverlap } from './validate.js';
import { matcherIdentity, matcherKey } from './matchers.js';
import type { Config, Json, Mock, ResolvedMock, ResolvedScene, Scene } from './types.js';

export type FixtureJsonMap = Record<string, Json>;

export function resolveScene(
  config: Config,
  sceneId: string,
  fixtures: FixtureJsonMap,
  originalRoute?: string,
): ResolvedScene {
  const scene = config.scenes[sceneId];
  if (!scene) {
    throw new Error(`Unknown scene ${sceneId}`);
  }
  const defaults = config.defaults ?? {};
  const route = scene.route ?? defaults.route ?? originalRoute;
  const storage = {
    local: mergeStorage(defaults.storage?.local, scene.storage?.local),
    session: mergeStorage(defaults.storage?.session, scene.storage?.session),
  };
  const custom = mergeCustom(defaults.custom, scene.custom);
  const mocks = mergeMocks(defaults.mocks ?? [], scene.mocks ?? []).map((mock) =>
    materializeMock(mock, fixtures),
  );
  assertNoResolvedOverlap(sceneId, mocks);
  return {
    id: sceneId,
    title: scene.title,
    route,
    storage,
    mocks,
    custom,
  };
}

export function resolveAllScenes(
  config: Config,
  fixtures: FixtureJsonMap,
): Record<string, ResolvedScene> {
  const out: Record<string, ResolvedScene> = {};
  for (const id of config.order) {
    out[id] = resolveScene(config, id, fixtures);
  }
  return out;
}

function mergeStorage(
  defaults: Record<string, string | null> | undefined,
  scene: Record<string, string | null> | undefined,
): Record<string, string | null> {
  return { ...(defaults ?? {}), ...(scene ?? {}) };
}

function mergeCustom(
  defaults: Record<string, Json> | undefined,
  scene: Record<string, Json> | undefined,
): Record<string, Json> {
  return { ...(defaults ?? {}), ...(scene ?? {}) };
}

export function mergeMocks(defaults: Mock[], scene: Mock[]): Mock[] {
  const merged = defaults.map((mock) => ({ ...mock }));
  const indexByKey = new Map<string, number>();
  merged.forEach((mock, index) => {
    indexByKey.set(matcherKey(matcherIdentity(mock)), index);
  });
  for (const mock of scene) {
    const key = matcherKey(matcherIdentity(mock));
    const existing = indexByKey.get(key);
    if (existing === undefined) {
      indexByKey.set(key, merged.length);
      merged.push({ ...mock });
    } else {
      merged[existing] = { ...mock };
    }
  }
  return merged;
}

function materializeMock(mock: Mock, fixtures: FixtureJsonMap): ResolvedMock {
  if (mock.error === 'network') {
    return {
      method: mock.method,
      path: mock.path,
      query: mock.query,
      error: 'network',
      delayMs: mock.delayMs,
    };
  }
  const reply = mock.response;
  if ('fixture' in reply && reply.fixture) {
    const json = fixtures[reply.fixture];
    return {
      method: mock.method,
      path: mock.path,
      query: mock.query,
      delayMs: mock.delayMs,
      response: { status: reply.status, json },
    };
  }
  if ('json' in reply && reply.json !== undefined) {
    return {
      method: mock.method,
      path: mock.path,
      query: mock.query,
      delayMs: mock.delayMs,
      response: { status: reply.status, json: reply.json },
    };
  }
  return {
    method: mock.method,
    path: mock.path,
    query: mock.query,
    delayMs: mock.delayMs,
    response: { status: reply.status },
  };
}

export function collectFixtureRefs(config: Config): string[] {
  const refs = new Set<string>();
  const scenes: Array<Scene | Omit<Scene, 'title'>> = [
    ...(config.defaults ? [config.defaults] : []),
    ...Object.values(config.scenes),
  ];
  for (const scene of scenes) {
    for (const mock of scene.mocks ?? []) {
      if (mock.error === 'network') continue;
      const fixture = mock.response && 'fixture' in mock.response ? mock.response.fixture : undefined;
      if (fixture) refs.add(fixture);
    }
  }
  return [...refs];
}
