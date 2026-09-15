import { describe, expect, it } from 'vitest';
import { findMockForRequest, findOverlappingPair, mocksOverlap } from '../../src/core/matchers.js';
import { pathInScope } from '../../src/core/scope.js';

describe('network matchers and scope', () => {
  it('allows extra query keys and requires declared equality', () => {
    const mocks = [{ method: 'GET' as const, path: '/api/orders', query: { view: 'open' } }];
    const hit = new URLSearchParams('view=open&extra=1');
    const miss = new URLSearchParams('view=closed&extra=1');
    expect(findMockForRequest(mocks, 'GET', '/api/orders', hit)).toBe(0);
    expect(findMockForRequest(mocks, 'GET', '/api/orders', miss)).toBe(-1);
  });

  it('treats compatible query constraints as overlapping', () => {
    expect(
      mocksOverlap(
        { method: 'GET', path: '/api/orders' },
        { method: 'GET', path: '/api/orders', query: { id: '1' } },
      ),
    ).toBe(true);
    expect(
      findOverlappingPair([
        { method: 'GET', path: '/api/orders', query: { a: '1' } },
        { method: 'GET', path: '/api/orders', query: { b: '2' } },
      ]),
    ).toEqual([0, 1]);
  });

  it('keeps /api/ from matching /apiary', () => {
    expect(pathInScope('/api/orders', ['/api/'])).toBe(true);
    expect(pathInScope('/apiary', ['/api/'])).toBe(false);
    expect(pathInScope('/api', ['/api/'])).toBe(false);
  });
});
