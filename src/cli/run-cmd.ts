import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import type { Result } from '../core/types.js';
import { EXIT, fail } from './exit.js';
import { readRuntime } from './runtime.js';

export async function runSceneCommand(
  cwd: string,
  type: 'SCENE_APPLY' | 'RESET',
  sceneId?: string,
): Promise<void> {
  const runtime = readRuntime(cwd);
  const requestId = randomUUID();
  const result = await sendAndWait(runtime, {
    protocol: 1,
    projectId: runtime.projectId,
    clientId: `cli-${requestId}`,
    requestId,
    configHash: '',
    type,
    sceneId,
  });
  if (result.type === 'COMMAND_FAILED') {
    const code = result.error?.code;
    if (code === 'NO_CLIENT') fail(`${code}: ${result.error?.message}`, EXIT.noClient);
    if (code === 'BUSY' || code === 'TRANSITION_TIMEOUT') {
      fail(`${code}: ${result.error?.message}`, EXIT.busy);
    }
    if (code === 'CONFIG_INVALID' || String(code).startsWith('FIXTURE_')) {
      fail(`${code}: ${result.error?.message}`, EXIT.config);
    }
    fail(`${code}: ${result.error?.message}`, EXIT.exec);
  }
  console.log(result.type);
  process.exitCode = EXIT.ok;
}

async function sendAndWait(
  runtime: ReturnType<typeof readRuntime>,
  command: Record<string, unknown>,
): Promise<Result> {
  const url = `ws://${runtime.host}:${runtime.port}${runtime.wsPath}`;
  const ws = new WebSocket(url, { origin: `http://${runtime.host}:${runtime.port}` });
  const timeout = 15_000;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.close();
      reject(Object.assign(new Error('Timed out waiting for acknowledgment.'), { exitCode: EXIT.busy }));
    }, timeout);
    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          protocol: 1,
          type: 'AUTH',
          token: runtime.token,
          role: 'cli',
          clientId: command.clientId,
          projectId: runtime.projectId,
        }),
      );
    });
    ws.on('message', (raw) => {
      const message = JSON.parse(String(raw)) as Record<string, unknown>;
      if (message.type === 'AUTH_FAILED' || message.type === 'ALREADY_CONNECTED') {
        clearTimeout(timer);
        ws.close();
        reject(Object.assign(new Error(String(message.message ?? message.type)), { exitCode: EXIT.noClient }));
        return;
      }
      if (message.type === 'AUTH_OK') {
        ws.send(JSON.stringify(command));
        return;
      }
      if (
        message.requestId === command.requestId &&
        (message.type === 'SCENE_APPLIED' ||
          message.type === 'RESET_COMPLETED' ||
          message.type === 'COMMAND_FAILED')
      ) {
        clearTimeout(timer);
        ws.close();
        resolve(message as unknown as Result);
      }
    });
    ws.on('error', (error) => {
      clearTimeout(timer);
      reject(Object.assign(error, { exitCode: EXIT.noClient }));
    });
  });
}
