import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RuntimeFile } from '../core/protocol.js';
import { RUNTIME_DIR, RUNTIME_FILE } from '../core/protocol.js';

export function readRuntime(cwd: string): RuntimeFile {
  const path = join(cwd, RUNTIME_DIR, RUNTIME_FILE);
  if (!existsSync(path)) {
    throw Object.assign(new Error('No SCAYVO runtime file. Start the app with `npx scayvo dev` first.'), {
      exitCode: 3,
    });
  }
  return JSON.parse(readFileSync(path, 'utf8')) as RuntimeFile;
}
