import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { EXIT, fail } from './exit.js';
import { CONFIG_TEMPLATE, DEV_TEMPLATE, FIXTURE_TEMPLATE, MAIN_HINT, VITE_HINT } from './templates.js';

export async function runInit(cwd: string): Promise<void> {
  const configPath = join(cwd, 'scayvo.config.ts');
  const devPath = join(cwd, 'src', 'scayvo.dev.ts');
  const fixturePath = join(cwd, 'scayvo', 'fixtures', 'orders.json');
  const created: string[] = [];

  if (!existsSync(configPath)) {
    writeFileSync(configPath, CONFIG_TEMPLATE);
    created.push('scayvo.config.ts');
  }
  if (!existsSync(devPath)) {
    mkdirSync(dirname(devPath), { recursive: true });
    writeFileSync(devPath, DEV_TEMPLATE);
    created.push('src/scayvo.dev.ts');
  }
  if (!existsSync(fixturePath)) {
    mkdirSync(dirname(fixturePath), { recursive: true });
    writeFileSync(fixturePath, FIXTURE_TEMPLATE);
    created.push('scayvo/fixtures/orders.json');
  }

  const gitignore = join(cwd, '.gitignore');
  if (existsSync(gitignore)) {
    const text = readFileSync(gitignore, 'utf8');
    if (!text.split(/\r?\n/).includes('.scayvo')) {
      appendFileSync(gitignore, '\n.scayvo\n');
      created.push('.gitignore (added .scayvo)');
    }
  }

  if (created.length === 0) {
    console.log('SCAYVO files already exist. Nothing was overwritten.');
  } else {
    console.log(`Created ${created.join(', ')}.`);
  }
  console.log('Setup files created. Add these integration blocks.');
  console.log(VITE_HINT);
  console.log(MAIN_HINT);
  console.log('Full Connected status appears only after the app client handshake.');
  process.exitCode = EXIT.ok;
}

export function failInit(error: unknown): never {
  fail(error instanceof Error ? error.message : String(error), EXIT.exec);
}
