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
      display: grid; place-items: start center; padding-top: 11vh;
      pointer-events: none;
    }
    #scayvo-overlay[hidden] { display: none; }
    #scayvo-overlay .scayvo-overlay-card {
      pointer-events: auto;
      min-width: 280px; max-width: 440px;
      background: #0c0c0a; color: #efe6d0;
      border: 1px solid #2c2b24; border-left: 3px solid #d6ff32;
      border-radius: 0; padding: 18px 20px 16px;
      font-family: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
    }
    #scayvo-overlay .scayvo-overlay-kicker {
      margin: 0;
      font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
      font-size: 10px; letter-spacing: .18em; text-transform: uppercase;
      color: #d6ff32;
    }
    #scayvo-overlay .scayvo-overlay-title {
      margin: 8px 0 0;
      font-family: "Iowan Old Style", Palatino, "Palatino Linotype", Georgia, serif;
      font-size: 22px; font-weight: 400; font-style: italic; letter-spacing: -0.02em;
    }
    #scayvo-overlay .scayvo-overlay-detail {
      margin: 8px 0 0;
      font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
      font-size: 12px; color: #8c8878; line-height: 1.5;
    }
    #scayvo-overlay[data-kind="applying"] .scayvo-overlay-kicker { color: #d6ff32; }
    #scayvo-overlay[data-kind="recovery-failed"] .scayvo-overlay-kicker,
    #scayvo-overlay[data-kind="config-changed"] .scayvo-overlay-kicker { color: #ff471a; }
    #scayvo-overlay[data-kind="recovery-failed"] .scayvo-overlay-card,
    #scayvo-overlay[data-kind="config-changed"] .scayvo-overlay-card { border-left-color: #ff471a; }
    #scayvo-demo-badge {
      position: fixed; top: 10px; right: 10px; z-index: 2147483645;
      background: #0c0c0a; color: #d6ff32; border: 1px solid #d6ff32; border-radius: 0;
      padding: 6px 9px 5px;
      font: 500 10px/1 ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
      letter-spacing: .16em; text-transform: uppercase;
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
