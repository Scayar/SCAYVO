import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('local npm pack install', () => {
  it('installs the tarball into a clean React + Vite app and validates init output', () => {
    const pack = execSync('npm pack --json --ignore-scripts', { encoding: 'utf8' });
    const jsonStart = pack.indexOf('[');
    const tarball = JSON.parse(pack.slice(jsonStart))[0].filename as string;
    const tarballPath = join(process.cwd(), tarball);
    expect(existsSync(tarballPath)).toBe(true);

    const dir = mkdtempSync(join(tmpdir(), 'scayvo-pack-'));
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify(
        {
          name: 'fresh-vite-app',
          private: true,
          type: 'module',
          dependencies: {
            react: '19.1.1',
            'react-dom': '19.1.1',
          },
          devDependencies: {
            vite: '7.1.5',
            '@vitejs/plugin-react': '5.0.2',
            typescript: '5.9.2',
            scayvo: `file:${tarballPath}`,
          },
        },
        null,
        2,
      ),
    );
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(
      join(dir, 'index.html'),
      '<div id="root"></div><script type="module" src="/src/main.ts"></script>',
    );
    writeFileSync(
      join(dir, 'src/main.ts'),
      `async function main() {
  if (import.meta.env.DEV) {
    const { startDemoDevelopment } = await import('./scayvo.dev');
    await startDemoDevelopment();
    return;
  }
  const { mountNormalApp } = await import('./bootstrap');
  await mountNormalApp();
}
void main();
`,
    );
    writeFileSync(
      join(dir, 'src/bootstrap.ts'),
      `export async function mountApp() {
  document.getElementById('root')!.textContent = 'ok';
  return { async dispose() {} };
}
export async function mountNormalApp() { return mountApp(); }
`,
    );
    writeFileSync(
      join(dir, 'vite.config.ts'),
      `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { scayvo } from 'scayvo/vite';
export default defineConfig({ plugins: [react(), scayvo()], server: { host: '127.0.0.1' } });
`,
    );
    execSync('npm install --no-fund --no-audit', { cwd: dir, stdio: 'pipe' });
    const initOut = execSync('npx scayvo init', { cwd: dir, encoding: 'utf8' });
    expect(initOut).toContain('Setup files created. Add these integration blocks.');
    const validateOut = execSync('npx scayvo validate', { cwd: dir, encoding: 'utf8' });
    expect(validateOut).toContain('Valid.');
    const listOut = execSync('npx scayvo list', { cwd: dir, encoding: 'utf8' });
    expect(listOut).toContain('empty');
    expect(listOut).toContain('busy');
  }, 120_000);
});
