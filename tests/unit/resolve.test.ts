import { describe, expect, it } from 'vitest';
import { mergeMocks, resolveScene } from '../../src/core/resolve.js';
import { sampleConfig } from './sample-config.js';

describe('scene resolution', () => {
  it('never inherits leftover mocks from a previous scene', () => {
    const config = sampleConfig();
    const busy = resolveScene(config, 'busy', {});
    const empty = resolveScene(config, 'empty', {});
    const busyOrders = busy.mocks.find((mock) => mock.path === '/api/orders');
    const emptyOrders = empty.mocks.find((mock) => mock.path === '/api/orders');
    expect(busyOrders && 'response' in busyOrders && 'json' in busyOrders.response && Array.isArray(busyOrders.response.json)).toBe(true);
    expect(emptyOrders && 'response' in emptyOrders && 'json' in emptyOrders.response).toBe(true);
    if (emptyOrders && 'response' in emptyOrders && 'json' in emptyOrders.response) {
      expect(emptyOrders.response.json).toEqual([]);
    }
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
    expect(merged[0] && 'response' in merged[0] && merged[0].response.status).toBe(500);
  });

  it('uses scene route, then defaults, then original', () => {
    const config = sampleConfig();
    expect(resolveScene(config, 'empty', {}, '/original').route).toBe('/dashboard');
    expect(resolveScene(config, 'payment-failed', {}).route).toBe('/checkout');
    delete config.defaults!.route;
    expect(resolveScene(config, 'empty', {}, '/original').route).toBe('/original');
  });
});
