/** Path-boundary prefixes: `/api/` matches `/api/orders` but not `/apiary`. */
export function pathInScope(pathname: string, scope: string[]): boolean {
  return scope.some((prefix) => prefixMatches(pathname, prefix));
}

export function prefixMatches(pathname: string, prefix: string): boolean {
  if (prefix === '/') return true;
  if (pathname === prefix) return true;
  if (prefix.endsWith('/')) {
    return pathname.startsWith(prefix);
  }
  if (pathname.startsWith(`${prefix}/`)) return true;
  return false;
}

export function validateScopePrefix(prefix: string): string | null {
  if (!prefix.startsWith('/') || prefix.startsWith('//') || prefix.includes('\\')) {
    return 'network.scope entries must be same-origin path prefixes such as /api/';
  }
  if (prefix.includes('?') || prefix.includes('#') || prefix.includes('*')) {
    return 'network.scope does not accept query, hash, or wildcards';
  }
  return null;
}
