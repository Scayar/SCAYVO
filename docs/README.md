# SCAYVO documentation

Open-source local scene controller for a running Vite + React SPA. MIT.

**Author:** [Scayar](https://github.com/Scayar) · [Scayar.com](https://Scayar.com) · [Telegram](https://t.me/im_scayar) · [Coffee](https://buymeacoffee.com/scayar)

**Read this in:** [English](../README.md) · [Nederlands](../README.nl.md) · [العربية](../README.ar.md)

| Guide | EN | NL | AR |
| --- | --- | --- | --- |
| Getting started | [getting-started.md](getting-started.md) | [getting-started.nl.md](getting-started.nl.md) | [getting-started.ar.md](getting-started.ar.md) |
| Limits | [limits.md](limits.md) | [limits.nl.md](limits.nl.md) | [limits.ar.md](limits.ar.md) |
| Integrations | [integrations.md](integrations.md) | [integrations.nl.md](integrations.nl.md) | [integrations.ar.md](integrations.ar.md) |
| GitHub About / topics | [github-presence.md](github-presence.md) | — | — |
| Tests | [../tests/RESULTS.md](../tests/RESULTS.md) | — | — |
| Halo Supply | [../examples/demo/README.md](../examples/demo/README.md) | — | — |
| License | [../LICENSE](../LICENSE) | MIT | MIT |
| Contributing | [../CONTRIBUTING.md](../CONTRIBUTING.md) | — | — |
| Security | [../SECURITY.md](../SECURITY.md) | — | — |

## Watch

| Asset | What it is |
| --- | --- |
| [walkthrough.gif](assets/walkthrough.gif) | Short loop of Director + Halo Supply |
| [walkthrough.mp4](assets/walkthrough.mp4) | Trimmed capture of Director + Halo Supply (~90s, light dashboard) |
| [banner.svg](assets/banner.svg) | README hero |
| [mark.svg](assets/mark.svg) | Square mark |
| [social-preview.svg](assets/social-preview.svg) | GitHub social card (export PNG 1280×640) |
| [social-preview.png](assets/social-preview.png) | Upload in Settings → General → Social preview |

## Screenshots

Director (navy / signal-blue dashboard):

- [director-desktop.png](assets/director-desktop.png) — Empty LIVE, cue sheet, transport
- [director-busy.png](assets/director-busy.png) — Growing business LIVE
- [director-diagnostics.png](assets/director-diagnostics.png) — last events, no secrets
- [director-film.png](assets/director-film.png) — film mode, `Esc` exits
- [director-tablet.png](assets/director-tablet.png) — stacked chrome under 900px
- [director-phone.png](assets/director-phone.png) — two-column metrics

Halo Supply:

- [halo-empty.png](assets/halo-empty.png) — 0 orders, $0.00
- [halo-busy.png](assets/halo-busy.png) — 3 orders, **$977.00**
- [halo-slow.png](assets/halo-slow.png) — skeleton while delayMs runs
- [halo-error.png](assets/halo-error.png) — HTTP 500 dashboard
- [halo-checkout.png](assets/halo-checkout.png) — payment form ready
- [halo-declined.png](assets/halo-declined.png) — toast **after** Pay
- [halo-premium.png](assets/halo-premium.png) — Talal / premium
- [halo-badge.png](assets/halo-badge.png) — `DEMO MODE` pill

## Run the example (copy-paste)

From the repository root, after `npm install` and `npm install --prefix examples/demo`:

```bash
npm run start --prefix examples/demo -- --host 127.0.0.1 --port 4173 --strictPort
```

App: http://127.0.0.1:4173/dashboard  
Director: http://127.0.0.1:4173/__scayvo/

Do **not** use `npm run demo -- --host …`. Nested npm scripts do not forward those flags to Vite.

Loopback only. Binding Vite to `0.0.0.0` disables `/__scayvo/`.

CLI from a second terminal (Vite already running):

```bash
cd examples/demo
npx scayvo list
npx scayvo run busy
```

## Palette

| Token | Hex |
| --- | --- |
| Navy | `#153a75` |
| Signal blue | `#2b63e3` |
| Sky | `#73b3ff` |
| Ice | `#eaf2ff` |
| Heat | `#e05645` |
| Paper | `#f3f6fb` |
| Ink | `#122033` |
