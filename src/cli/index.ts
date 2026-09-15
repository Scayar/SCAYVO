import { runDev } from './dev-cmd.js';
import { EXIT, fail } from './exit.js';
import { failInit, runInit } from './init.js';
import { runList } from './list-cmd.js';
import { runSceneCommand } from './run-cmd.js';
import { runValidate } from './validate-cmd.js';

const args = process.argv.slice(2);
const command = args[0];
const cwd = process.cwd();

try {
  if (!command || command === '--help' || command === '-h') {
    printHelp();
    process.exit(EXIT.ok);
  }
  if (command === 'init') await runInit(cwd);
  else if (command === 'validate') await runValidate(cwd, flag(args, '--config'));
  else if (command === 'list') await runList(cwd, flag(args, '--config'));
  else if (command === 'dev') await runDev(cwd);
  else if (command === 'run') {
    const sceneId = args[1];
    if (!sceneId) fail('Usage: scayvo run <scene-id>', EXIT.exec);
    await runSceneCommand(cwd, 'SCENE_APPLY', sceneId);
  } else if (command === 'reset') await runSceneCommand(cwd, 'RESET');
  else fail(`Unknown command ${command}`, EXIT.exec);
} catch (error) {
  const err = error as { message?: string; exitCode?: number };
  if (command === 'init') failInit(error);
  fail(err.message ?? String(error), err.exitCode ?? EXIT.exec);
}

function flag(list: string[], name: string): string | undefined {
  const index = list.indexOf(name);
  if (index === -1) return undefined;
  return list[index + 1];
}

function printHelp(): void {
  console.log(`SCAYVO — local scene controller

Usage:
  npx scayvo init
  npx scayvo dev
  npx scayvo list
  npx scayvo run <scene-id>
  npx scayvo reset
  npx scayvo validate

Exit codes: 0 ok, 1 exec, 2 invalid config, 3 no connection/client, 4 busy/timeout
`);
}
