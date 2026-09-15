export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0:0:0:0:0:0:0:1';
}

export function hostHeaderHostname(hostHeader: string | undefined): string | null {
  if (!hostHeader) return null;
  const trimmed = hostHeader.trim();
  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']');
    if (end === -1) return null;
    return trimmed.slice(1, end);
  }
  const colon = trimmed.lastIndexOf(':');
  if (colon > -1 && /^\d+$/.test(trimmed.slice(colon + 1))) {
    return trimmed.slice(0, colon);
  }
  return trimmed;
}

export function isWildcardBind(host: string | boolean | undefined): boolean {
  if (host === true) return true;
  if (typeof host !== 'string') return false;
  const h = host.replace(/^\[|\]$/g, '');
  return h === '0.0.0.0' || h === '::' || h === '*';
}

export function originAllowed(origin: string | undefined, hostHeader: string | undefined): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (!isLoopbackHostname(url.hostname)) return false;
    const requestHost = hostHeaderHostname(hostHeader);
    if (!requestHost) return false;
    if (!isLoopbackHostname(requestHost)) return false;
    return url.hostname === requestHost || bothLoopback(url.hostname, requestHost);
  } catch {
    return false;
  }
}

function bothLoopback(a: string, b: string): boolean {
  return isLoopbackHostname(a) && isLoopbackHostname(b);
}

export function assertControlRequest(headers: {
  host?: string;
  origin?: string;
}): { ok: true } | { ok: false; status: number; message: string } {
  const hostname = hostHeaderHostname(headers.host);
  if (!hostname || !isLoopbackHostname(hostname)) {
    return { ok: false, status: 403, message: 'SCAYVO control is limited to loopback hosts.' };
  }
  if (headers.origin && !originAllowed(headers.origin, headers.host)) {
    return { ok: false, status: 403, message: 'Origin is not allowed.' };
  }
  return { ok: true };
}

export function tokenFromHeaders(headers: Record<string, string | string[] | undefined>): string | null {
  const direct = headerValue(headers['x-scayvo-token']);
  if (direct) return direct;
  const auth = headerValue(headers.authorization);
  if (auth?.startsWith('Bearer ')) return auth.slice('Bearer '.length).trim();
  return null;
}

function headerValue(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] : value;
}
