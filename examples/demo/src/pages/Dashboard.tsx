import { useEffect, useState } from 'react';
import { formatUsd, getOrders, type Order } from '../api';

export function DashboardPage({ signal, onShop }: { signal: AbortSignal; onShop: () => void }) {
  const [state, setState] = useState<{ status: 'loading' | 'ok' | 'error'; orders: Order[]; error?: string }>({
    status: 'loading',
    orders: [],
  });

  useEffect(() => {
    let cancelled = false;
    const local = new AbortController();
    const onAbort = () => local.abort();
    signal.addEventListener('abort', onAbort);
    setState({ status: 'loading', orders: [] });
    getOrders(local.signal)
      .then((orders) => {
        if (!cancelled) setState({ status: 'ok', orders });
      })
      .catch((error: Error) => {
        if (!cancelled && error.name !== 'AbortError') {
          setState({ status: 'error', orders: [], error: error.message });
        }
      });
    return () => {
      cancelled = true;
      signal.removeEventListener('abort', onAbort);
      local.abort();
    };
  }, [signal]);

  const revenue = state.orders.reduce((sum, order) => sum + order.totalCents, 0);

  if (state.status === 'loading') {
    return (
      <section className="stack" data-loading="true">
        <h1>Studio dashboard</h1>
        <div className="skeleton-grid" aria-busy="true">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton wide" />
        </div>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section className="stack" data-error={state.error}>
        <h1>Studio dashboard</h1>
        <p className="error">Could not load orders ({state.error}).</p>
      </section>
    );
  }

  return (
    <section className="stack">
      <h1>Studio dashboard</h1>
      <div className="metrics">
        <article>
          <p>Open orders</p>
          <strong data-order-count={state.orders.length}>{state.orders.length}</strong>
        </article>
        <article>
          <p>Revenue in view</p>
          <strong data-revenue={revenue}>{formatUsd(revenue)}</strong>
        </article>
      </div>
      {state.orders.length === 0 ? (
        <div className="empty" data-empty="true">
          <h2>No orders yet</h2>
          <p>An empty shop is a valid demo. Switch scenes when you want the ledger full.</p>
          <button onClick={onShop}>Open checkout</button>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Studio</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {state.orders.map((order) => (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>{order.customer}</td>
                <td>{formatUsd(order.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
