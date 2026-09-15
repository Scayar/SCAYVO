import { useEffect, useState, type ReactNode } from 'react';

export function usePath(): [string, (to: string) => void] {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  const navigate = (to: string) => {
    if (to === window.location.pathname) return;
    history.pushState({}, '', to);
    setPath(to);
  };
  return [path, navigate];
}

export function Link({ to, children }: { to: string; children: ReactNode }) {
  return (
    <a
      href={to}
      onClick={(event) => {
        event.preventDefault();
        history.pushState({}, '', to);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }}
    >
      {children}
    </a>
  );
}
