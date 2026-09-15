# Contributing

SCAYVO is MIT-licensed. Thank you for taking the time to contribute.

**Languages:** [English](README.md) · [Nederlands](README.nl.md) · [العربية](README.ar.md)

## What this project is

A **loopback-only** scene controller for a running React + Vite SPA. Director lives on the same Vite server at `/__scayvo/`. It controls **declared sources and registered adapters only**.

This repository is **not** published to the public npm registry. Do not `npm install scayvo` from npm. Pack a local tarball (`npm pack`).

## Before you start

- Node.js **≥ 20.11**
- Stay on loopback (`127.0.0.1`). Binding Vite to `0.0.0.0` disables control routes
- Do not expose `/__scayvo/` on a shared network

```bash
git clone https://github.com/Scayar/SCAYVO.git
cd SCAYVO
npm install
npm run build
npm install --prefix examples/demo
```

## Checks that must stay green

```bash
npm run typecheck
npm run test
npx playwright test
```

Playwright starts its own server on **4173**. Stop anything else on that port first. Nested `npm run demo -- --host` does not forward flags to Vite.

## Support

- Website: [Scayar.com](https://Scayar.com)
- Email: [Scayar.exe@gmail.com](mailto:Scayar.exe@gmail.com)
- Telegram: [@im_scayar](https://t.me/im_scayar)
- Coffee: [buymeacoffee.com/scayar](https://buymeacoffee.com/scayar)

## How to send a change

1. Open an issue first if the change is large (new scene kinds, network surface, or security).
2. Keep the public contract: no `localStorage.clear()`, no full page reload, production builds must not ship `/__scayvo/`, the worker, or fixtures.
3. `payment-failed` means the **next** Pay request fails. The declined toast must not appear until submit.
4. Halo Supply revenue comes from the fixture (**$977.00**), not a hardcoded headline.
5. Open a pull request with what you changed, how you tested it, and any scene ids involved.

## Code of conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Security

See [SECURITY.md](SECURITY.md). Do not file public issues for vulnerabilities.
