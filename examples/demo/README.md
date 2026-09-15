# Halo Supply

Private SCAYVO example. Not published. Digital film-pack storefront with three routes (`/dashboard`, `/checkout`, `/account`) and six fetch-driven scenes.

**Languages:** [English](../../README.md) · [Nederlands](../../README.nl.md) · [العربية](../../README.ar.md)

## Start (from the SCAYVO repo root)

```bash
npm install --prefix examples/demo
npm run start --prefix examples/demo -- --host 127.0.0.1 --port 4173 --strictPort
```

From this folder:

```bash
npm start -- --host 127.0.0.1 --port 4173 --strictPort
```

Do not pass Vite flags through `npm run demo` at the repo root — nested npm does not forward them.

| URL | Surface |
| --- | --- |
| http://127.0.0.1:4173/dashboard | Storefront |
| http://127.0.0.1:4173/__scayvo/ | Director |

## Scenes

`empty` → `busy` ($977.00 from three fixture orders) → `slow` (2800ms) → `api-error` → `payment-failed` (toast **after** Pay) → `premium`.

After **Reset**, `/api/*` may return Vite HTML until you apply a scene again. That is expected without a real backend.

## CLI (Vite already running)

```bash
npx scayvo list
npx scayvo run busy
npx scayvo run payment-failed
npx scayvo reset
```

Host and token come from `.scayvo/runtime.json`. There is no `--base-url` flag.

Production `npm run build` in this folder must not ship `/__scayvo/`, the worker, or fixtures.
