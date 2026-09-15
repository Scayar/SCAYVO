import type { SceneContext } from 'scayvo';
import type { User } from './api';
import { AccountPage } from './pages/Account';
import { CheckoutPage } from './pages/Checkout';
import { DashboardPage } from './pages/Dashboard';
import { Link, usePath } from './router';

export function App({ context }: { context: SceneContext }) {
  const [path, navigate] = usePath();
  const user = (context.custom.user ?? { id: 'guest', name: 'Guest', plan: 'free' }) as User;
  const theme = localStorage.getItem('demo:theme') ?? 'dark';
  const onboarding = sessionStorage.getItem('demo:onboarding');

  let page = path;
  if (page === '/') page = '/dashboard';

  return (
    <div className={`app theme-${theme}`} data-page={page} data-scene={context.sceneId ?? 'normal'}>
      <header className="topbar">
        <div>
          <p className="eyebrow">Halo Supply</p>
          <strong>Film packs for working studios</strong>
        </div>
        <nav>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/checkout">Checkout</Link>
          <Link to="/account">Account</Link>
        </nav>
      </header>
      {onboarding !== 'complete' ? <aside className="banner">Finish onboarding to pin your demo workspace.</aside> : null}
      <main>
        {page === '/checkout' ? (
          <CheckoutPage signal={context.signal} />
        ) : page === '/account' ? (
          <AccountPage user={user} />
        ) : (
          <DashboardPage signal={context.signal} onShop={() => navigate('/checkout')} />
        )}
      </main>
    </div>
  );
}
