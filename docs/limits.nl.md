# Grenzen (v0.1)

**Talen:** [English](limits.md) · [Nederlands](limits.nl.md) · [العربية](limits.ar.md)

SCAYVO is geen testplatform en geen productie-controlplane.

## State

Replay herstelt **beheerde** inputs: allowlisted `localStorage` / `sessionStorage`-keys, geregistreerde adapters, de scene-route, MSW-handlers en een nieuwe React-generatie. Het herstelt geen scroll, focus, history-stacks, heaps, IndexedDB, cookies, HttpOnly-auth of writes van een andere tab.

Reset zet die beheerde inputs terug naar de vastgelegde baseline en mount de app in normale modus. Als je echte dev-API down is, kan de app erren; dat is geen restore-fout.

## Netwerk

MSW is de interceptor. v0.1 levert geen handmatige `fetch`-patch. Geen GraphQL- of WebSocket-mocking. Externe SDK’s en server-side backends vallen buiten `network.scope`.

`delayMs` is geen timeout. Een hangend verzoek zonder einde valt buiten scope. Om een app-timeout te demonstreren, laat de app eerder afbreken dan de mock-delay.

Onbehandelde in-scope requests worden geblokkeerd. Ze staan in Director met method en pad.

## Workers

SCAYVO serveert de eigen worker vanuit de Vite-plugin, alleen in dev. Er gaat geen worker naar `public/` voor productie. Een vreemde Service Worker op dezelfde scope faalt bij start (`WORKER_CONFLICT`). SCAYVO unregistert geen workers die hij niet bezit. Samenleven met een PWA-worker is uitgesteld.

## Control plane

Tokens zijn willekeurig per `vite`-proces. Het zijn geen gebruikerscredentials. Ze mogen niet in URL’s of logs. Host en Origin worden gecontroleerd. CORS is niet wildcard. Staging en productie aanzetten is uitgesteld.

Als de laatste Director weggaat, **houdt** de app de huidige mocks. Geen fall-through naar het echte netwerk.

## Recovery

Het journal staat in `sessionStorage` onder een gereserveerde key. Alleen synthetische baseline-data. Quota-fout stopt vóór mutatie. Refresh met dezelfde config-hash past de scene opnieuw toe vanaf de oorspronkelijke baseline. Een hash-wijziging of onderbroken overgang toont Recovery en herstelt eerst de inputs. SCAYVO past geen nieuwe scene toe over een onbekende baseline.

## Eerlijkheid

`payment-failed` betekent dat het **volgende** betalingsverzoek geweigerd wordt. Het betekent niet dat de geweigerde toast al op het scherm staat. v0.1 klikt de DOM niet voor je.
