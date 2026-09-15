import { useEffect, useState, type FormEvent } from 'react';
import { formatUsd, getCart, pay, type Cart } from '../api';

export function CheckoutPage({ signal }: { signal: AbortSignal }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const local = new AbortController();
    const onAbort = () => local.abort();
    signal.addEventListener('abort', onAbort);
    getCart(local.signal)
      .then(setCart)
      .catch(() => setCart({ items: [] }));
    return () => {
      signal.removeEventListener('abort', onAbort);
      local.abort();
    };
  }, [signal]);

  const total = cart?.items.reduce((sum, item) => sum + item.priceCents, 0) ?? 0;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPaid(false);
    setPending(true);
    try {
      await pay(signal);
      setPaid(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'payment_failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="stack">
      <h1>Checkout</h1>
      <p className="lede">The next Pay click uses the active scene. A declined scene does not show this toast until you submit.</p>
      <ul className="cart">
        {(cart?.items ?? []).map((item) => (
          <li key={item.id}>
            <span>{item.name ?? item.id}</span>
            <strong>{formatUsd(item.priceCents)}</strong>
          </li>
        ))}
      </ul>
      <form className="pay" onSubmit={onSubmit}>
        <label>
          Studio note
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="PO or cut number" />
        </label>
        <p className="total">Due {formatUsd(total)}</p>
        <button type="submit" data-action="pay" disabled={pending}>
          {pending ? 'Charging…' : 'Pay'}
        </button>
      </form>
      {error ? (
        <p className="error toast" data-pay-error={error}>
          Payment declined: {error}
        </p>
      ) : null}
      {paid ? <p className="ok" data-paid="true">Payment captured for this take.</p> : null}
    </section>
  );
}
