# Test results (v0.1)

Recorded 15 September 2026 against this repository. These are actual runs, not placeholders.

## Vitest (`npm test`)

25 passed in ~8s.

| File | What it covers |
| --- | --- |
| `tests/unit/validate.test.ts` | Schema, overlapping matchers, unmanaged keys, fixture path rules |
| `tests/unit/resolve.test.ts` | baseline/defaults/scene merge, no previous-scene inheritance |
| `tests/unit/matchers.test.ts` | Query equality + extra keys, `/api/` vs `/apiary` |
| `tests/unit/storage.test.ts` | Absent vs empty string, allowlist restore, `null` delete |
| `tests/unit/keyboard.test.ts` | Input/IME/modifier/repeat ignore |
| `tests/unit/security.test.ts` | Loopback and origin gates |
| `tests/unit/adapters.test.ts` | `ADAPTER_MISSING` copy |
| `tests/integration/production-bundle.test.ts` | `vite build` of the demo has no `/__scayvo`, worker, fixtures, or scene titles |
| `tests/integration/package-install.test.ts` | `npm pack` tarball into a clean Vite app; `init` / `validate` / `list` |

## Playwright (`npx playwright test`)

14 passed in ~22s against `examples/demo` on Chromium.

Covered: cold boot gating, A→B→A, slow→busy isolation, replay of payment-failed, reset of managed keys, refresh baseline, unhandled in-scope block, command burst, focus/remote, second app tab, unauthorized HTTP, Director disconnect, assets, p95 apply-to-shell < 1s over 30 switches.

## Not automated here

| Matrix item | Status |
| --- | --- |
| Adapter failure after mutation | Engine recovery path exists; no dedicated Playwright adapter that throws mid-apply |
| `WORKER_CONFLICT` | Startup check exists; not exercised against a foreign PWA worker |
| Config symlink escape | Unit-tested with a real symlink |
| Visual pixel snapshots | Intentionally omitted |

## Unsupported (specified as out of v0.1)

Global fake clock, SSR/Next.js, GraphQL, WebSockets, IndexedDB, cookies/HttpOnly, database seeding, PWA worker coexistence, capture, cloud, AI, billing, OS-global hotkeys.
