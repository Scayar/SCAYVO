# Integraties

**Talen:** [English](integrations.md) · [Nederlands](integrations.nl.md) · [العربية](integrations.ar.md)

## React + Vite SPA

Ondersteunde omgeving: lokale Chromium, `base: '/'`, REST over `fetch`.

Gebruik `scayvo/react` als je `createReactIntegration(target, render)` wilt, die de eerste commit `flushSync`t en unmount.

Implementeer anders zelf `AppIntegration` met dezelfde regels:

- Nieuwe `QueryClient` / store per generatie, of een adapter die ze reset
- Annuleer in-flight queries en geef `AbortSignal` door aan `fetch`
- Houd geen auth- of cache-singletons buiten `mount`/`dispose`

## Adapters

```ts
type Adapter = {
  capture(): Json | Promise<Json>
  apply(value: Json, context: SceneContext): Promise<void>
  restore(snapshot: Json, context: SceneContext): Promise<void>
}
```

Registratievolgorde is de apply-volgorde. Custom keys zijn adapter-namen. Een scene die een ongeregistreerde adapter noemt faalt in preflight (`ADAPTER_MISSING`) en muteert de huidige scene niet.

`capture` draait vóór de eerste scene, nadat adapter-owned bronnen klaar zijn. Waarden moeten JSON zijn. `apply` / `restore` moeten `context.signal` checken vóór commit. Adapters die naar een echte backend schrijven of berichten sturen zijn ongeldig in v0.1.

TanStack Query, Zustand en vergelijkbare libraries zijn niet auto-wired. Een kleine adapter die de oude client disposed en een nieuwe maakt is de bedoelde uitbreiding, geen framework-plugin.

## MSW

SCAYVO bezit de sessie-worker. Bestaande app-workers in dezelfde scope zijn een conflict. Roep niet `worker.resetHandlers()` aan in de verwachting van passthrough; Reset stopt SCAYVO-interceptie na rust, herstelt inputs, daarna `mountNormal`.

## Config-hash

De sessie pint een config-hash bij boot. `scayvo.config.ts` bewerken terwijl een demo draait toont **Configuration changed**. Reset en herlaad. Config-HMR is uitgesteld. React-HMR mag alleen als de engine-singleton op `window.__SCAYVO__` behouden blijft.
