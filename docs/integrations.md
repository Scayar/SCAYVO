# Integrations

**Languages:** [English](integrations.md) · [Nederlands](integrations.nl.md) · [العربية](integrations.ar.md)

## React + Vite SPA

Supported environment: local Chromium, `base: '/'`, REST over `fetch`.

Use `scayvo/react` if you want `createReactIntegration(target, render)` which `flushSync`s the first commit and unmount.

Otherwise implement `AppIntegration` yourself with the same rules:

- New `QueryClient` / store per generation, or an adapter that resets them
- Cancel in-flight queries and pass `AbortSignal` to `fetch`
- Do not keep auth or cache singletons outside `mount`/`dispose`

## Adapters

```ts
type Adapter = {
  capture(): Json | Promise<Json>
  apply(value: Json, context: SceneContext): Promise<void>
  restore(snapshot: Json, context: SceneContext): Promise<void>
}
```

Registration order is the apply order. Custom keys are adapter names. A scene that names an unregistered adapter fails preflight (`ADAPTER_MISSING`) and does not mutate the current scene.

`capture` runs before the first scene, after adapter-owned sources are ready. Values must be JSON. `apply` / `restore` must check `context.signal` before committing. Adapters that write to a real backend or send messages are not valid in v0.1.

TanStack Query, Zustand, and similar libraries are not auto-wired. A small adapter that disposes the old client and creates a new one is the intended extension, not a framework plugin.

## MSW

SCAYVO owns the session worker. Existing app workers in the same scope are a conflict. Do not call `worker.resetHandlers()` expecting passthrough; Reset stops SCAYVO interception after quiescence, restores inputs, then `mountNormal`.

## Config hash

The session pins a config hash at boot. Editing `scayvo.config.ts` while a demo is running shows **Configuration changed**. Reset and reload. Config HMR is deferred. React HMR is allowed only if the engine singleton on `window.__SCAYVO__` is preserved.
