export type OverlayKind = 'applying' | 'recovery' | 'recovery-failed' | 'config-changed' | hidden;

type hidden = null;

let host: HTMLDivElement | null = null;
let stylesInjected = false;

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
  ensureStyles();
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

function ensureStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.setAttribute('data-scayvo-ui', 'true');
  style.textContent = `
    #scayvo-overlay {
      position: fixed; inset: 0; z-index: 2147483646;
      display: grid; place-items: start center; padding-top: 10vh;
      pointer-events: none;
    }
    #scayvo-overlay[hidden] { display: none; }
    #scayvo-overlay .scayvo-overlay-card {
      pointer-events: auto;
      min-width: min(280px, calc(100vw - 32px)); max-width: 440px;
      background: #fff; color: #14233f;
      border-radius: 22px; padding: 18px 20px 16px;
      font-family: "Plus Jakarta Sans", "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
      box-shadow: 0 18px 40px rgba(21, 58, 117, .18);
    }
    #scayvo-overlay .scayvo-overlay-kicker {
      margin: 0; font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
      font-weight: 700; color: #2b63e3;
    }
    #scayvo-overlay .scayvo-overlay-title {
      margin: 8px 0 0; font-size: 20px; font-weight: 700; letter-spacing: -0.03em;
    }
    #scayvo-overlay .scayvo-overlay-detail {
      margin: 8px 0 0; font-size: 13px; color: #6d7d98; line-height: 1.5;
    }
    #scayvo-overlay[data-kind="recovery-failed"] .scayvo-overlay-kicker,
    #scayvo-overlay[data-kind="config-changed"] .scayvo-overlay-kicker { color: #e05645; }
    #scayvo-demo-badge {
      position: fixed; top: 12px; right: 12px; z-index: 2147483645;
      background: #153a75; color: #fff; border-radius: 999px;
      padding: 7px 12px 6px;
      font: 700 11px/1 "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
      letter-spacing: .08em; text-transform: uppercase;
      box-shadow: 0 8px 18px rgba(21, 58, 117, .28);
    }
  `;
  document.documentElement.appendChild(style);
}

function ensureHost(): void {
  ensureStyles();
  if (host) return;
  host = document.createElement('div');
  host.id = 'scayvo-overlay';
  document.documentElement.appendChild(host);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
