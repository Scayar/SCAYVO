# Aan de slag

**Talen:** [English](getting-started.md) · [Nederlands](getting-started.nl.md) · [العربية](getting-started.ar.md)

SCAYVO is een **lokaal** ontwikkelhulpmiddel. Houd de Vite-server op loopback. Zet `/__scayvo/` niet op een gedeeld netwerk.

## Halo Supply op deze machine starten

Vanuit de **repo-root**:

```bash
npm install
npm run build
npm install --prefix examples/demo
npm run start --prefix examples/demo -- --host 127.0.0.1 --port 4173 --strictPort
```

Open daarna:

- App: http://127.0.0.1:4173/dashboard
- Director: http://127.0.0.1:4173/__scayvo/

`npm run demo` start hetzelfde Vite-proces maar **geeft `--host` / `--port` niet door**. Playwright en deze gids pinnen **4173**. Is die poort bezet, stop het andere proces; deel hem niet met Playwright (`reuseExistingServer` staat uit).

Scene toepassen via CLI (Vite draait al; vanuit `examples/demo` zodat de CLI `.scayvo/runtime.json` kan lezen):

```bash
cd examples/demo
npx scayvo list
npx scayvo run busy
npx scayvo run payment-failed
npx scayvo reset
```

`run` praat met de live sessie en stopt pas na `SCENE_APPLIED`. Het start Vite niet en opent geen browser. Er is geen `--base-url` — host en token komen uit `.scayvo/runtime.json`.

## 1. Pakket

Bouw deze repo en installeer de tarball met `npm pack`. Download geen ongerelateerd `scayvo`-pakket van de publieke registry als vervanging.

## 2. Config

`scayvo.config.ts` is vertrouwde lokale TypeScript die Node laadt. Scene-ids zijn lowercase kebab-case. `order` noemt elke scene één keer. `initialScene` moet in die lijst staan.

Fixtures zijn relatief ten opzichte van het configbestand, in Node gelezen, als JSON geverifieerd, daarna inline voor de browser. Absolute paden en symlink-escapes buiten de projectroot falen vóór elke scene-mutatie.

## 3. Drie applicatiewijzigingen

1. `scayvo()` in `vite.config.ts`
2. `src/scayvo.dev.ts` — adapters + `startScayvo({ integration })`
3. dynamische import achter `import.meta.env.DEV` in `main` zodat productie de sessie weglaat

Wacht tot de worker klaar is voordat je modules importeert die `fetch` aanroepen. MSW documenteert deze race; SCAYVO volgt hem.

## 4. Mount-contract

`mount(context)` moet resolven na de eerste bruikbare shell-commit, niet na elk netwerkverzoek. Daarom kan Slow API **Active** zijn terwijl het skeleton nog op het scherm staat.

`dispose()` moet fetches, timers en subscriptions afbreken en daarna de root unmounten.

## 5. Handshake

Director toont **Connected** nadat de app authenticeert, en **Active** pas na `SCENE_APPLIED`. CLI `run` wacht op dezelfde acknowledgement. Alleen een socket-connect is geen succes.

## 6. Voorbeeld-walkthrough

Gebruik `examples/demo` om Empty → Busy → Slow → Error → Pay (geweigerd) → Replay → Premium op te nemen. Omzet moet uit de drie fixture-rijen komen ($977.00), niet uit een hardcoded kopcijfer.
