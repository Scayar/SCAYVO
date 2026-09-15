# Limits (v0.1)

SCAYVO is not a test platform and not a production control plane.

## State

Replay restores **managed** inputs: allowlisted `localStorage` / `sessionStorage` keys, registered adapters, the scene route, MSW handlers, and a new React generation. It does not restore scroll, focus, history stacks, heaps, IndexedDB, cookies, HttpOnly auth, or another tab’s writes.

Reset restores those managed inputs to the captured baseline and mounts the app in normal mode. If your real dev API is down, the app may error; that is not a restore failure.

## Network

MSW is the interceptor. v0.1 does not ship a hand-rolled `fetch` patch. There is no GraphQL or WebSocket mocking. External SDKs and server-side backends are outside `network.scope`.

`delayMs` is not a timeout. A hung request with no end is out of scope. To demo an app timeout, make the app abort sooner than the mock delay.

Unhandled in-scope requests are blocked. They are listed in Director with method and path.

## Workers

SCAYVO serves its own worker from the Vite plugin in dev only. It does not copy a worker into `public/` for production. A foreign Service Worker on the same scope fails startup (`WORKER_CONFLICT`). SCAYVO will not unregister workers it does not own. Coexistence with a PWA worker is deferred.

## Control plane

Tokens are random per `vite` process. They are not user credentials. They must not appear in URLs or logs. Host and Origin are checked. CORS is not wildcarded. Staging and production enabling is deferred.

If the last Director disconnects, the app **keeps** the current mocks. It does not fall through to the real network.

## Recovery

The journal lives in `sessionStorage` under a reserved key. It holds synthetic baseline data only. Quota failure aborts before mutation. Refresh with the same config hash reapplies the scene from the original baseline. A hash change or an interrupted transition shows Recovery and restores inputs first. SCAYVO will not apply a new scene over an unknown baseline.

## Honesty

`payment-failed` means the **next** payment request is declined. It does not mean the declined toast is already on screen. v0.1 does not click the DOM for you.
