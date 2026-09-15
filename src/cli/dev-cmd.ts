import { createServer, loadConfigFromFile, mergeConfig } from 'vite';
import { scayvo } from '../vite/plugin.js';
import { EXIT, fail } from './exit.js';

export async function runDev(cwd: string): Promise<void> {
  const loaded = await loadConfigFromFile({ command: 'serve', mode: 'development' }, undefined, cwd);
  const plugins = (loaded?.config.plugins ?? []).flat().filter(Boolean) as Array<{ name?: string }>;
  const scayvoCount = plugins.filter((plugin) => plugin?.name === 'scayvo').length;
  if (scayvoCount > 1) {
    fail('vite.config.ts registers scayvo() more than once. Keep a single plugin instance.', EXIT.exec);
  }
  const config = mergeConfig(loaded?.config ?? {}, {
    root: cwd,
    configFile: false,
    server: {
      ...(loaded?.config.server ?? {}),
      host: '127.0.0.1',
    },
    plugins: scayvoCount === 0 ? [scayvo()] : [],
  });
  if (scayvoCount === 0) {
    console.warn('vite.config.ts does not include scayvo(). Adding it for this process only.');
  }
  const server = await createServer(config);
  await server.listen();
  const urls = server.resolvedUrls;
  const app = urls?.local[0] ?? 'http://127.0.0.1:5173/';
  console.log(`App      ${app}`);
  console.log(`Director ${new URL('__scayvo/', app).href}`);
  console.log('Open these URLs yourself; SCAYVO does not auto-open a browser.');
}
