import { canonicalJson, sha256Hex, utf8Bytes } from './hash.js';
import { collectFixtureRefs, resolveAllScenes, type FixtureJsonMap } from './resolve.js';
import { loadFixtureFile } from './fixtures.js';
import { validateConfig } from './validate.js';
import { MAX_RESOLVED_BYTES, type Config, type Json, type ResolvedScene } from './types.js';
import { ScayvoError } from './errors.js';

export type PreparedConfig = {
  config: Config;
  fixtures: FixtureJsonMap;
  scenes: Record<string, ResolvedScene>;
  configHash: string;
  projectRoot: string;
  configPath: string;
};

export async function prepareConfig(options: {
  input: unknown;
  projectRoot: string;
  configDir: string;
  configPath: string;
}): Promise<PreparedConfig> {
  const config = validateConfig(options.input);
  const fixtures: FixtureJsonMap = {};
  for (const ref of collectFixtureRefs(config)) {
    fixtures[ref] = loadFixtureFile(options.projectRoot, options.configDir, ref);
  }
  const scenes = resolveAllScenes(config, fixtures);
  const payload = { config, fixtures, scenes };
  const encoded = canonicalJson(payload);
  if (utf8Bytes(encoded) > MAX_RESOLVED_BYTES) {
    throw new ScayvoError(
      'FIXTURE_TOO_LARGE',
      'Resolved config exceeds 5 MiB after inlining fixtures.',
    );
  }
  const configHash = await sha256Hex(encoded);
  return {
    config,
    fixtures,
    scenes,
    configHash,
    projectRoot: options.projectRoot,
    configPath: options.configPath,
  };
}

export function publicSceneList(prepared: PreparedConfig): Array<{
  id: string;
  title: string;
  hotkey: string | null;
  route?: string;
}> {
  return prepared.config.order.map((id, index) => ({
    id,
    title: prepared.scenes[id].title,
    hotkey: index < 9 ? String(index + 1) : null,
    route: prepared.scenes[id].route,
  }));
}

export function directorSafeConfig(prepared: PreparedConfig): Json {
  return {
    version: prepared.config.version,
    initialScene: prepared.config.initialScene,
    order: prepared.config.order,
    hash: prepared.configHash,
    scenes: publicSceneList(prepared),
  };
}
