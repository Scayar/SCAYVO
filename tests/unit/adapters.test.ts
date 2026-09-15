import { describe, expect, it } from 'vitest';
import { adapterMissingMessage } from '../../src/core/errors.js';

describe('adapter preflight messaging', () => {
  it('names the missing adapter and the registration file', () => {
    expect(adapterMissingMessage('user', 'payment-failed')).toContain('Adapter user is missing');
    expect(adapterMissingMessage('user', 'payment-failed')).toContain('src/scayvo.dev.ts');
  });
});
