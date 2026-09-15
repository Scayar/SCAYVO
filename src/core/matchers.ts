import type { HttpMethod, Mock } from './types.js';

export type MatcherIdentity = {
  method: HttpMethod;
  path: string;
  query: Record<string, string>;
};

export function matcherIdentity(mock: Pick<Mock, 'method' | 'path' | 'query'>): MatcherIdentity {
  const query = sortQuery(mock.query ?? {});
  return { method: mock.method, path: mock.path, query };
}

export function matcherKey(identity: MatcherIdentity): string {
  return `${identity.method} ${identity.path}?${stableQueryString(identity.query)}`;
}

export function sortQuery(query: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(query).sort()) {
    out[key] = query[key];
  }
  return out;
}

export function stableQueryString(query: Record<string, string>): string {
  return Object.entries(sortQuery(query))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

export function querySatisfies(
  request: URLSearchParams,
  required: Record<string, string> | undefined,
): boolean {
  if (!required) return true;
  for (const [key, value] of Object.entries(required)) {
    if (request.get(key) !== value) return false;
  }
  return true;
}

export function queriesCompatible(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  for (const key of Object.keys(a)) {
    if (key in b && a[key] !== b[key]) return false;
  }
  return true;
}

export function findOverlappingPair(
  mocks: Array<Pick<Mock, 'method' | 'path' | 'query'>>,
): [number, number] | null {
  for (let i = 0; i < mocks.length; i += 1) {
    for (let j = i + 1; j < mocks.length; j += 1) {
      if (mocksOverlap(mocks[i], mocks[j])) return [i, j];
    }
  }
  return null;
}

export function mocksOverlap(
  a: Pick<Mock, 'method' | 'path' | 'query'>,
  b: Pick<Mock, 'method' | 'path' | 'query'>,
): boolean {
  if (a.method !== b.method) return false;
  if (a.path !== b.path) return false;
  return queriesCompatible(a.query ?? {}, b.query ?? {});
}

export function findMockForRequest(
  mocks: Array<Pick<Mock, 'method' | 'path' | 'query'>>,
  method: string,
  path: string,
  searchParams: URLSearchParams,
): number {
  const upper = method.toUpperCase();
  let found = -1;
  for (let i = 0; i < mocks.length; i += 1) {
    const mock = mocks[i];
    if (mock.method !== upper) continue;
    if (mock.path !== path) continue;
    if (!querySatisfies(searchParams, mock.query)) continue;
    if (found !== -1) return found;
    found = i;
  }
  return found;
}
