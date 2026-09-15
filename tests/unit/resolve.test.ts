import { describe, expect, it } from 'vitest';
import { mergeMocks, resolveScene } from '../../src/core/resolve.js';
import type { Json, ResolvedMock } from '../../src/core/types.js';
import { sampleConfig } from './sample-config.js';

function jsonReply(mock: ResolvedMock | undefined): { status: number; json: Json } {
  if (!mock || !('response' in mock) || !mock.response || !('json' in mock.response)) {
    throw new Error('expected JSON mock reply');
  }
  return mock.response;
}

describe('scene resolution', () => {
  it('never inherits leftover mocks from a previous scene', () => {
    const config = sampleConfig();
    const busy = resolveScene(config, 'busy', {});
    const empty = resolveScene(config, 'empty', {});
    const busyOrders = busy.mocks.find((mock) => mock.path === '/api/orders');
    const emptyOrders = empty.mocks.find((mock) => mock.path === '/api/orders');
    expect(Array.isArray(jsonReply(busyOrders).json)).toBe(true);
    expect(jsonReply(emptyOrders).json).toEqual([]);
  });

  it('replaces custom user wholesale instead of deep-merging', () => {
    const config = sampleConfig();
    const premium = resolveScene(config, 'premium', {});
    expect(premium.custom.user).toEqual({ id: 'demo-talal', name: 'Talal', plan: 'premium' });
  });

  it('overrides a default matcher by identity and keeps others', () => {
    const merged = mergeMocks(
      [{ method: 'GET', path: '/api/orders', response: { status: 200, json: [] } }],
      [{ method: 'GET', path: '/api/orders', response: { status: 500, json: { error: 'x' } } }],
    );
    expect(merged).toHaveLength(1);
    const first = merged[0];
    if (!first || !('response' in first) || !first.response) throw new Error('expected JSON mock');
    expect(first.response.status).toBe(500);
  });

  it('uses scene route, then defaults, then original', () => {
    const config = sampleConfig();
    expect(resolveScene(config, 'empty', {}, '/original').route).toBe('/dashboard');
    expect(resolveScene(config, 'payment-failed', {}).route).toBe('/checkout');
    delete config.defaults!.route;
    expect(resolveScene(config, 'empty', {}, '/original').route).toBe('/original');
  });
});
