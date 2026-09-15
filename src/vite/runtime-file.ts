import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chmod } from 'node:fs/promises';
import { RUNTIME_DIR, RUNTIME_FILE, type RuntimeFile } from '../core/protocol.js';

export async function writeRuntimeFile(projectRoot: string, runtime: RuntimeFile): Promise<string> {
  const dir = join(projectRoot, RUNTIME_DIR);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, RUNTIME_FILE);
  writeFileSync(path, `${JSON.stringify(runtime, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  try {
    await chmod(path, 0o600);
    await chmod(dir, 0o700);
  } catch {
    // Windows and some FS policies ignore chmod; the file is still local-only.
  }
  return path;
}
