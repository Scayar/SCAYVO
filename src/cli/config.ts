import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ScayvoError } from '../core/errors.js';
import { prepareConfig } from '../core/prepare.js';
import { findConfigPath, loadConfigModule } from '../vite/load-config.js';
import { EXIT, fail } from './exit.js';

export async function loadPrepared(cwd: string, configArg?: string) {
  try {
    const configPath = findConfigPath(cwd, configArg);
    const input = await loadConfigModule(configPath);
    return await prepareConfig({
      input,
      projectRoot: cwd,
      configDir: dirname(configPath),
      configPath,
    });
  } catch (error) {
    if (error instanceof ScayvoError && (error.code === 'CONFIG_INVALID' || error.code.startsWith('FIXTURE_'))) {
      fail(`${error.code}: ${error.message}`, EXIT.config);
    }
    throw error;
  }
}

export function configUrl(configPath: string): string {
  return pathToFileURL(configPath).href;
}
