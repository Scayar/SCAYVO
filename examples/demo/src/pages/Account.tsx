import type { User } from '../api';

export function AccountPage({ user }: { user: User }) {
  return (
    <section className="stack">
      <h1>Account</h1>
      <dl className="account">
        <div>
          <dt>Name</dt>
          <dd>{user.name}</dd>
        </div>
        <div>
          <dt>Plan</dt>
          <dd data-plan={user.plan}>{user.plan}</dd>
        </div>
        <div>
          <dt>Member id</dt>
          <dd>{user.id}</dd>
        </div>
      </dl>
      {user.plan === 'premium' ? (
        <p className="ok">Premium unlocks batch LUT delivery and quiet invoices.</p>
      ) : (
        <p>Free plan is the default demo account. Switch to Premium account for the upgraded take.</p>
      )}
    </section>
  );
}
