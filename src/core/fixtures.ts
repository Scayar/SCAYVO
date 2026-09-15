import { realpathSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { ScayvoError } from './errors.js';
import { utf8Bytes } from './hash.js';
import { MAX_FIXTURE_BYTES, type Json } from './types.js';

export function loadFixtureFile(projectRoot: string, configDir: string, fixturePath: string): Json {
  if (isAbsolute(fixturePath) || fixturePath.startsWith('file:')) {
    throw new ScayvoError('FIXTURE_OUTSIDE_ROOT', `Fixture path must be relative: ${fixturePath}`, {
      path: fixturePath,
    });
  }
  const rawTarget = join(configDir, fixturePath);
  let realRoot: string;
  let realTarget: string;
  try {
    realRoot = realpathSync(projectRoot);
  } catch (error) {
    throw new ScayvoError('CONFIG_INVALID', 'Project root is not readable.', { cause: error });
  }
  try {
    realTarget = realpathSync(rawTarget);
  } catch {
    throw new ScayvoError('FIXTURE_NOT_FOUND', `Fixture not found: ${fixturePath}`, {
      path: fixturePath,
    });
  }
  const rel = relative(realRoot, realTarget);
  if (rel.startsWith('..') || isAbsolute(rel) || rel.split(sep).includes('..')) {
    throw new ScayvoError(
      'FIXTURE_OUTSIDE_ROOT',
      `Fixture resolves outside the project root: ${fixturePath}`,
      { path: fixturePath },
    );
  }
  let size = 0;
  try {
    size = statSync(realTarget).size;
  } catch (error) {
    throw new ScayvoError('FIXTURE_NOT_FOUND', `Fixture not readable: ${fixturePath}`, {
      path: fixturePath,
      cause: error,
    });
  }
  if (size > MAX_FIXTURE_BYTES) {
    throw new ScayvoError(
      'FIXTURE_TOO_LARGE',
      `Fixture ${fixturePath} exceeds 1 MiB (${size} bytes).`,
      { path: fixturePath },
    );
  }
  const text = readFileSync(realTarget, 'utf8');
  if (utf8Bytes(text) > MAX_FIXTURE_BYTES) {
    throw new ScayvoError('FIXTURE_TOO_LARGE', `Fixture ${fixturePath} exceeds 1 MiB.`, {
      path: fixturePath,
    });
  }
  try {
    return JSON.parse(text) as Json;
  } catch (error) {
    throw new ScayvoError('FIXTURE_INVALID_JSON', `Fixture is not valid JSON: ${fixturePath}`, {
      path: fixturePath,
      cause: error,
    });
  }
}
