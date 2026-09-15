export type OverlayKind = 'applying' | 'recovery' | 'recovery-failed' | 'config-changed' | hidden;

type hidden = null;

let host: HTMLDivElement | null = null;

export function showOverlay(kind: Exclude<OverlayKind, null>, message: string, detail?: string): void {
  ensureHost();
  host!.hidden = false;
  host!.dataset.kind = kind;
  host!.innerHTML = `
    <div class="scayvo-overlay-card" role="status" aria-live="polite">
      <p class="scayvo-overlay-kicker">${escapeHtml(label(kind))}</p>
      <p class="scayvo-overlay-title">${escapeHtml(message)}</p>
      ${detail ? `<p class="scayvo-overlay-detail">${escapeHtml(detail)}</p>` : ''}
    </div>
  `;
}

export function hideOverlay(): void {
  if (!host) return;
  host.hidden = true;
  host.innerHTML = '';
}

export function showDemoBadge(visible: boolean, sceneTitle: string | null): void {
  let badge = document.getElementById('scayvo-demo-badge');
  if (!visible || !sceneTitle) {
    badge?.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'scayvo-demo-badge';
    document.documentElement.appendChild(badge);
  }
  badge.textContent = 'DEMO MODE';
  badge.setAttribute('title', sceneTitle);
}

function label(kind: string): string {
  switch (kind) {
    case 'applying':
      return 'Applying';
    case 'recovery':
      return 'Recovery';
    case 'recovery-failed':
      return 'Recovery failed';
    case 'config-changed':
      return 'Configuration changed';
    default:
      return 'SCAYVO';
  }
}

function ensureHost(): void {
  if (host) return;
  host = document.createElement('div');
  host.id = 'scayvo-overlay';
  const style = document.createElement('style');
  style.textContent = `
    #scayvo-overlay { position: fixed; inset: 0; z-index: 2147483646; display: grid; place-items: start center; padding-top: 12vh; pointer-events: none; }
    #scayvo-overlay[hidden] { display: none; }
    #scayvo-overlay .scayvo-overlay-card { pointer-events: auto; min-width: 280px; max-width: 420px; background: #141821; color: #eef2f7; border: 1px solid #2a3344; border-radius: 16px; padding: 18px 20px; font-family: ui-sans-serif, system-ui, sans-serif; box-shadow: 0 18px 50px rgba(0,0,0,.35); }
    #scayvo-overlay .scayvo-overlay-kicker { margin: 0; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #7d8ba3; }
    #scayvo-overlay .scayvo-overlay-title { margin: 8px 0 0; font-size: 18px; font-weight: 650; }
    #scayvo-overlay .scayvo-overlay-detail { margin: 8px 0 0; font-size: 13px; color: #c3cad6; line-height: 1.45; }
    #scayvo-overlay[data-kind="applying"] .scayvo-overlay-kicker { color: #6ea8ff; }
    #scayvo-overlay[data-kind="recovery-failed"] .scayvo-overlay-kicker,
    #scayvo-overlay[data-kind="config-changed"] .scayvo-overlay-kicker { color: #f0a35b; }
    #scayvo-demo-badge { position: fixed; top: 12px; right: 12px; z-index: 2147483645; background: #0e1116; color: #d7e3ff; border: 1px solid #3b82f6; border-radius: 999px; padding: 4px 10px; font: 700 11px/1.2 ui-sans-serif, system-ui, sans-serif; letter-spacing: .08em; }
  `;
  document.documentElement.appendChild(style);
  document.documentElement.appendChild(host);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
