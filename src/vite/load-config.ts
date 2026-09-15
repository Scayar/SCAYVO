import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';
import type { ViteDevServer } from 'vite';

export const CONFIG_CANDIDATES = [
  'scayvo.config.ts',
  'scayvo.config.mts',
  'scayvo.config.js',
  'scayvo.config.mjs',
];

export function findConfigPath(cwd: string, explicit?: string): string {
  if (explicit) {
    const resolved = isAbsolute(explicit) ? explicit : resolve(cwd, explicit);
    if (!existsSync(resolved)) {
      throw new Error(`SCAYVO config not found: ${resolved}`);
    }
    return resolved;
  }
  for (const name of CONFIG_CANDIDATES) {
    const candidate = join(cwd, name);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    `No SCAYVO config found in ${cwd}. Run \`npx scayvo init\` or pass --config.`,
  );
}

export async function loadConfigModule(
  configPath: string,
  server?: ViteDevServer,
): Promise<unknown> {
  if (server) {
    const url = pathToFileURL(configPath).href;
    const mod = await server.ssrLoadModule(url);
    return unwrap(mod);
  }
  const jiti = createJiti(import.meta.url, { moduleCache: false, fsCache: false });
  const mod = await jiti.import(configPath);
  return unwrap(mod);
}

function unwrap(mod: unknown): unknown {
  if (mod && typeof mod === 'object' && 'default' in mod) {
    return (mod as { default: unknown }).default;
  }
  return mod;
}

export function projectRootFromConfig(configPath: string, cwd: string): string {
  return cwd || dirname(configPath);
}
