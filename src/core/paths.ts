export function isSameOriginAbsolutePath(value: string): boolean {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return false;
  }
  if (value.includes('\\')) return false;
  try {
    const url = new URL(value, 'http://scayvo.invalid');
    if (url.origin !== 'http://scayvo.invalid') return false;
    if (url.pathname.startsWith('//')) return false;
    return true;
  } catch {
    return false;
  }
}

export function parseRoute(route: string): { pathname: string; search: string; hash: string } {
  const url = new URL(route, 'http://scayvo.invalid');
  return { pathname: url.pathname, search: url.search, hash: url.hash };
}

export function splitPathAndQuery(requestUrl: string): {
  pathname: string;
  searchParams: URLSearchParams;
} {
  const url = new URL(requestUrl, 'http://scayvo.invalid');
  return { pathname: url.pathname, searchParams: url.searchParams };
}

export function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}
