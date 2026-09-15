import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateConfig } from '../../src/core/validate.js';
import { loadFixtureFile } from '../../src/core/fixtures.js';
import { prepareConfig } from '../../src/core/prepare.js';
import { sampleConfig } from './sample-config.js';
import { ScayvoError } from '../../src/core/errors.js';

describe('validateConfig', () => {
  it('accepts the canonical v0.1 config', () => {
    const config = validateConfig(sampleConfig());
    expect(config.initialScene).toBe('empty');
    expect(config.order).toHaveLength(6);
  });

  it('rejects mixed-case scene ids', () => {
    const copy = sampleConfig();
    (copy.scenes as Record<string, unknown>).Empty = copy.scenes.empty;
    copy.order.push('Empty');
    expect(() => validateConfig(copy)).toThrow(/kebab-case/);
  });

  it('rejects json and fixture together', () => {
    const input = sampleConfig();
    input.scenes.busy.mocks = [
      {
        method: 'GET',
        path: '/api/orders',
        response: { status: 200, json: [], fixture: './x.json' } as never,
      },
    ];
    expect(() => validateConfig(input)).toThrow(/mutually exclusive/);
  });

  it('rejects overlapping matchers', () => {
    const input = sampleConfig();
    input.defaults!.mocks = [
      { method: 'GET', path: '/api/orders', response: { status: 200, json: [] } },
      { method: 'GET', path: '/api/orders', query: { extra: '1' }, response: { status: 200, json: [] } },
    ];
    expect(() => validateConfig(input)).toThrow(/overlap/);
  });

  it('rejects unmanaged storage keys', () => {
    const input = sampleConfig();
    input.scenes.empty.storage = { local: { 'secret:token': 'nope' } };
    expect(() => validateConfig(input)).toThrow(/managedStorage/);
  });

  it('rejects absolute fixture paths', () => {
    const input = sampleConfig();
    input.scenes.busy.mocks = [
      {
        method: 'GET',
        path: '/api/orders',
        response: { status: 200, fixture: '/tmp/orders.json' },
      },
    ];
    expect(() => validateConfig(input)).toThrow(/relative/);
  });

  it('does not claim a route exists just because the path is well-formed', () => {
    const input = sampleConfig();
    input.scenes.empty.route = '/this-page-is-not-verified-at-validate-time';
    expect(() => validateConfig(input)).not.toThrow();
  });
});

describe('fixtures', () => {
  it('rejects symlink escape outside the project root', () => {
    const root = mkdtempSync(join(tmpdir(), 'scayvo-fx-'));
    const outside = mkdtempSync(join(tmpdir(), 'scayvo-out-'));
    try {
      writeFileSync(join(outside, 'secret.json'), '{"ok":false}');
      mkdirSync(join(root, 'fixtures'));
      symlinkSync(join(outside, 'secret.json'), join(root, 'fixtures', 'escape.json'));
      expect(() => loadFixtureFile(root, root, './fixtures/escape.json')).toThrow(ScayvoError);
      try {
        loadFixtureFile(root, root, './fixtures/escape.json');
      } catch (error) {
        expect((error as ScayvoError).code).toBe('FIXTURE_OUTSIDE_ROOT');
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('rejects missing fixtures before a scene can mutate', async () => {
    const root = mkdtempSync(join(tmpdir(), 'scayvo-miss-'));
    try {
      const input = sampleConfig();
      input.scenes.busy.mocks = [
        {
          method: 'GET',
          path: '/api/orders',
          response: { status: 200, fixture: './missing.json' },
        },
      ];
      await expect(
        prepareConfig({ input, projectRoot: root, configDir: root, configPath: join(root, 'scayvo.config.ts') }),
      ).rejects.toMatchObject({ code: 'FIXTURE_NOT_FOUND' });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
