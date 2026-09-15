export type Order = {
  id: string;
  customer: string;
  totalCents: number;
};

export type Cart = {
  items: Array<{ id: string; name?: string; priceCents: number }>;
};

export type User = {
  id: string;
  name: string;
  plan: string;
};

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export async function getOrders(signal: AbortSignal): Promise<Order[]> {
  const response = await fetch('/api/orders', { signal, cache: 'no-store' });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<Order[]>;
}

export async function getCart(signal: AbortSignal): Promise<Cart> {
  const response = await fetch('/api/cart', { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<Cart>;
}

export async function pay(signal: AbortSignal): Promise<{ id: string; paid: boolean }> {
  const response = await fetch('/api/payment', {
    method: 'POST',
    signal,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'demo-card' }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<{ id: string; paid: boolean }>;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}
