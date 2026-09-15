# SCAYVO

Local scene controller for a running React + Vite app. Define the demo setup once, then switch and replay it with a keypress.

**Your next demo. One key away.**

Switch routes, mock APIs, and restore demo state without rebuilding the setup between takes.

v0.1 controls **declared sources and registered adapters**. It does not claim “any state,” databases, SSR, cookies, IndexedDB, or production traffic.

The npm name `scayvo` is a working title. This repository does not publish to npm. Install a local tarball after `npm pack`.

## What you get

- Scenes: title, order, route, allowlisted storage, REST mocks, custom adapter data
- Director at `/__scayvo/` on the same Vite dev server
- Keyboard remote (Director always; the app only after Remote mode)
- Repeatable React remount with abortable generations
- MSW in the browser, including JSON, fixtures, HTTP errors, delay, and network errors
- CLI: `init`, `dev`, `list`, `run`, `reset`, `validate`

Not in v0.1: global fake clock, Next.js/SSR, GraphQL, WebSockets, capture, cloud, AI, billing, visual scene editing.

## Install a local build

From this repository:

```bash
npm install
npm run build
npm pack
```

In a React + Vite app:

```bash
npm install -D /path/to/scayvo-0.1.0.tgz
npx scayvo init
```

`init` writes `scayvo.config.ts`, `src/scayvo.dev.ts`, and a sample fixture **only if they do not already exist**. It prints the two integration blocks. It does not rewrite unknown bootstrap files, and it does not claim the handshake succeeded.

Add the plugin:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { scayvo } from 'scayvo/vite';

export default defineConfig({
  plugins: [react(), scayvo()],
  server: { host: '127.0.0.1' },
});
```

Gate startup so production bundles never import the demo session:

```ts
// src/main.ts
async function main() {
  if (import.meta.env.DEV) {
    const { startDemoDevelopment } = await import('./scayvo.dev');
    await startDemoDevelopment();
    return;
  }
  const { mountNormalApp } = await import('./bootstrap');
  await mountNormalApp();
}

void main();
```

`src/scayvo.dev.ts` must register adapters named in `custom`, wait for SCAYVO (including the MSW worker), then import application code that can fetch.

```ts
import { startScayvo } from 'scayvo/client';

export async function startDemoDevelopment() {
  const { mountApp } = await import('./bootstrap');
  await startScayvo({
    adapters: { user: userAdapter },
    integration: {
      async mount(context) {
        return mountApp(context);
      },
    },
  });
}
```

Create stores, query clients, and other mutable singletons **inside `mount`** for each generation, or reset them through adapters. Remounting React does not reset module-level caches by itself. Pass `context.signal` into `fetch`.

Control endpoints exist only during `vite` dev serve, and only when the server is bound to loopback (`localhost`, `127.0.0.1`, `::1`). Binding `0.0.0.0` disables them.

## Run the example

```bash
npm install
npm run build
npm install --prefix examples/demo
npm run demo -- --host 127.0.0.1 --port 4173
```

Open:

- App: `http://127.0.0.1:4173/`
- Director: `http://127.0.0.1:4173/__scayvo/`

Halo Supply is a three-route storefront (dashboard, checkout, account). Six scenes are driven by `fetch` to `/api/*`, not by reading a scene id to pick hardcoded markup.

| Key | Scene | What you should see |
| --- | --- | --- |
| 1 | Empty dashboard | Zero orders, $0.00 |
| 2 | Growing business | 3 orders, $977.00 from the fixture |
| 3 | Slow API | Skeleton for ~4s, then the same 3 orders |
| 4 | Server error | Dashboard error from HTTP 500 |
| 5 | Payment declined | Checkout. Pay, then a declined toast |
| 6 | Premium account | Plan `premium` |

Replay (Space) on payment-failed clears the form and toast, then Pay fails again. Reset restores managed keys and the original route, then mounts without SCAYVO mocks.

## CLI

```bash
npx scayvo init
npx scayvo dev
npx scayvo list
npx scayvo run payment-failed
npx scayvo reset
npx scayvo validate
```

`run` talks to an already running dev server and exits only after the app acknowledgment. It does not start a backend or open a browser.

Exit codes: `0` ok, `1` exec, `2` invalid config, `3` no connection/client, `4` busy/timeout.

## Director keys

| Key | Action |
| --- | --- |
| 1–9 | Scene by `order` |
| ← → | Previous / next, no wrap |
| Space | Replay current scene |
| R | Reset |
| D | Film mode in Director |
| / | Focus scene search in Director |
| Escape | Exit film in Director; turn off Remote mode in the app |

Shortcuts ignore typing, IME, modifiers, and key repeat. Numbers and arrows in the **app** tab work only after Remote mode is enabled.

These are page-level listeners, not OS-global hotkeys.

## Network and storage

- Path matchers are literal (`/api/orders`). Extra query keys are allowed; declared keys use equality. Ambiguous overlaps fail `validate`.
- `network.scope` uses path boundaries: `/api/` does not match `/apiary`. Out-of-scope requests (assets, Vite HMR) pass through.
- In-scope requests without a matcher are blocked and listed in Director. HTTP errors from mocks are scene data, not engine failure.
- `delayMs` is 0–30000. It is not an application timeout.
- Storage patches apply only to `managedStorage` keys. `null` deletes a key for the scene. SCAYVO never calls `localStorage.clear()`.
- One app client per session. A second app tab is refused.

## Tests

```bash
npm run test          # unit + integration (vitest)
npx playwright install chromium
npm run test:e2e      # Playwright against examples/demo
```

See [docs/getting-started.md](docs/getting-started.md), [docs/limits.md](docs/limits.md), and [docs/integrations.md](docs/integrations.md).
