# Getting started

**Languages:** [English](getting-started.md) · [Nederlands](getting-started.nl.md) · [العربية](getting-started.ar.md) · [Project README](../README.md)

SCAYVO is a **local** development tool. Keep the Vite server on loopback. Do not expose `/__scayvo/` on a shared network.

## Run Halo Supply on this machine

From the **repository root**:

```bash
npm install
npm run build
npm install --prefix examples/demo
npm run start --prefix examples/demo -- --host 127.0.0.1 --port 4173 --strictPort
```

Then open:

- App: http://127.0.0.1:4173/dashboard
- Director: http://127.0.0.1:4173/__scayvo/

`npm run demo` starts the same Vite process but **does not forward** `--host` / `--port`. Playwright and this guide pin **4173**. If that port is taken, stop the other process; do not share it with Playwright (`reuseExistingServer` is off).

Scripted scene apply (Vite already running; run from `examples/demo` so the CLI can read `.scayvo/runtime.json`):

```bash
cd examples/demo
npx scayvo list
npx scayvo run busy
npx scayvo run payment-failed
npx scayvo reset
```

`run` talks to the live session and exits only after `SCENE_APPLIED`. It does not start Vite and does not open a browser. There is no `--base-url` flag — host and token come from `.scayvo/runtime.json`.

## 1. Package

Build this repo and install the tarball with `npm pack`. Do not download an unrelated `scayvo` package from the public registry as a substitute.

## 2. Config

`scayvo.config.ts` is trusted local TypeScript loaded by Node. Scene ids are lowercase kebab-case. `order` lists every scene once. `initialScene` must be in that list.

Fixtures are relative to the config file, read in Node, verified as JSON, then inlined for the browser. Absolute paths and symlink escapes outside the project root fail before any scene mutation.

## 3. Three application changes

1. `scayvo()` in `vite.config.ts`
2. `src/scayvo.dev.ts` — adapters + `startScayvo({ integration })`
3. `import.meta.env.DEV` dynamic import in `main` so production builds drop the session

Await worker readiness before importing modules that call `fetch`. MSW documents this race; SCAYVO follows it.

## 4. Mount contract

`mount(context)` should resolve after the first usable shell commit, not after every network request. That is why Slow API can be **Active** while the skeleton is still on screen.

`dispose()` must abort fetches, timers, and subscriptions, then unmount the root.

## 5. Handshake

Director shows **Connected** after the app authenticates, and **Active** only after `SCENE_APPLIED`. CLI `run` waits for the same acknowledgment. Socket connect alone is not success.

## 6. Example walkthrough

Use `examples/demo` to record Empty → Busy → Slow → Error → Pay (declined) → Replay → Premium. Revenue must come from the three fixture rows ($977.00), not a hardcoded headline number.
