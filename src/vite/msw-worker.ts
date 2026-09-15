import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

export function resolveMswWorkerPath(): string {
  const candidates = [
    'msw/lib/mockServiceWorker.js',
    'msw/lib/mockServiceWorker.mjs',
    'msw/mockServiceWorker.js',
  ];
  for (const id of candidates) {
    try {
      return require.resolve(id);
    } catch {
      // continue
    }
  }
  try {
    const pkg = require.resolve('msw/package.json');
    const root = dirname(pkg);
    const fallback = join(root, 'lib', 'mockServiceWorker.js');
    if (existsSync(fallback)) return fallback;
  } catch {
    // continue
  }
  throw new Error('Unable to resolve msw mockServiceWorker.js. Pin msw@2.x as a dependency of scayvo.');
}
