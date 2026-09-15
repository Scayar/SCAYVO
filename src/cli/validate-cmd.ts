import { EXIT } from './exit.js';
import { loadPrepared } from './config.js';

export async function runValidate(cwd: string, configArg?: string): Promise<void> {
  const prepared = await loadPrepared(cwd, configArg);
  console.log(`Valid. ${prepared.config.order.length} scenes. hash=${prepared.configHash.slice(0, 12)}`);
  process.exitCode = EXIT.ok;
}
