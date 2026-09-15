import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const demoRoot = join(process.cwd(), 'examples/demo');

describe('production build isolation', () => {
  it('does not ship control routes, worker registration, or scene fixtures', () => {
    execSync('npm install --no-fund --no-audit', { cwd: demoRoot, stdio: 'pipe' });
    execSync('npx vite build', { cwd: demoRoot, stdio: 'pipe' });
    const dist = join(demoRoot, 'dist');
    expect(existsSync(dist)).toBe(true);
    const files = collect(dist).filter((file) => /\.(js|css|html|json)$/.test(file));
    const blob = files.map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(blob).not.toContain('/__scayvo');
    expect(blob).not.toContain('mockServiceWorker');
    expect(blob).not.toContain('virtual:scayvo/session');
    expect(blob).not.toContain('demo-1001');
    expect(blob).not.toContain('Growing business');
    expect(blob).not.toContain('scayvo/fixtures');
  });
});

function collect(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(path));
    else out.push(path);
  }
  return out;
}
