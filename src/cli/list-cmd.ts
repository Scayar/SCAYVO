import { EXIT } from './exit.js';
import { loadPrepared } from './config.js';

export async function runList(cwd: string, configArg?: string): Promise<void> {
  const prepared = await loadPrepared(cwd, configArg);
  for (const [index, id] of prepared.config.order.entries()) {
    const hotkey = index < 9 ? String(index + 1) : '-';
    const scene = prepared.scenes[id];
    console.log(`${hotkey}  ${id.padEnd(18)}  ${scene.title}`);
  }
  process.exitCode = EXIT.ok;
}
