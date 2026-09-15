/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyStoragePatch,
  captureBaselineStorage,
  restoreBaselineStorage,
} from '../../src/client/storage.js';

const managed = { local: ['demo:theme', 'demo:scratch'], session: ['demo:onboarding'] };

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('managed storage', () => {
  it('distinguishes absent keys from empty strings', () => {
    localStorage.setItem('demo:theme', '');
    const baseline = captureBaselineStorage(managed, { local: localStorage, session: sessionStorage });
    expect(baseline.local['demo:theme']).toEqual({ kind: 'value', value: '' });
    expect(baseline.local['demo:scratch']).toEqual({ kind: 'absent' });
  });

  it('restores absence and does not clear unrelated keys', () => {
    localStorage.setItem('other-app:token', 'keep-me');
    localStorage.setItem('demo:theme', 'dark');
    localStorage.setItem('demo:scratch', 'dirty');
    const baseline = {
      local: {
        'demo:theme': { kind: 'value' as const, value: 'light' },
        'demo:scratch': { kind: 'absent' as const },
      },
      session: { 'demo:onboarding': { kind: 'absent' as const } },
    };
    restoreBaselineStorage(baseline, managed, { local: localStorage, session: sessionStorage });
    expect(localStorage.getItem('demo:theme')).toBe('light');
    expect(localStorage.getItem('demo:scratch')).toBeNull();
    expect(localStorage.getItem('other-app:token')).toBe('keep-me');
  });

  it('applies null as a scene delete over baseline', () => {
    const baseline = captureBaselineStorage(managed, { local: localStorage, session: sessionStorage });
    applyStoragePatch(
      { local: { 'demo:theme': null }, session: {} },
      baseline,
      managed,
      { local: localStorage, session: sessionStorage },
    );
    expect(localStorage.getItem('demo:theme')).toBeNull();
  });
});
