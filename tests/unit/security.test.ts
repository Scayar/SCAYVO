import { describe, expect, it } from 'vitest';
import { originAllowed, isWildcardBind, isLoopbackHostname } from '../../src/vite/security.js';

describe('control plane guards', () => {
  it('rejects wildcard binds and non-loopback hosts', () => {
    expect(isWildcardBind('0.0.0.0')).toBe(true);
    expect(isWildcardBind('127.0.0.1')).toBe(false);
    expect(isLoopbackHostname('example.com')).toBe(false);
    expect(originAllowed('http://example.com', '127.0.0.1:5173')).toBe(false);
    expect(originAllowed('http://127.0.0.1:5173', '127.0.0.1:5173')).toBe(true);
  });
});
