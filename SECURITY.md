# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x (this repository) | Yes |

SCAYVO is a **local development** tool. Control routes exist only during `vite` serve on loopback (`127.0.0.1`, `localhost`, `::1`). Binding the server to `0.0.0.0` must disable `/__scayvo/`.

## What to report

- Control routes, worker, or fixtures leaking into a production build
- Auth / Origin checks that can be bypassed on loopback
- Path traversal or symlink escape when loading fixtures
- Anything that would make SCAYVO unregister a Service Worker it does not own
- Secret tokens appearing in URLs, logs, or the Director UI

Misconfiguration (exposing `/__scayvo/` on a LAN) is still worth a report if the product failed to refuse a non-loopback host.

## What not to report as a vulnerability

- After **Reset**, `/api/*` returning Vite HTML when there is no real backend (expected)
- The public npm package named `scayvo` — that is a different project; this repo does not publish to npm

## How to report

Use GitHub private vulnerability reporting:

**https://github.com/Scayar/SCAYVO/security/advisories/new**

You can also email **[Scayar.exe@gmail.com](mailto:Scayar.exe@gmail.com)** with the same details. Do not CC public lists.

Please include:

- SCAYVO version / commit
- Vite host and whether it was loopback
- Steps to reproduce
- Impact (who can trigger it, and from where)

Do **not** open a public issue for vulnerabilities.

We will acknowledge the report and work on a fix before any public disclosure.
