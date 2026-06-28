# @triage/extension

Chrome MV3 extension — a thin per-target entry shell over `@triage/engine` and
`@triage/ui`. It owns no review logic; it bundles the engine + UI and injects the
content script on PR pages.

## Status (BL-001)

Harness only. `src/content.ts` is a smoke shell that proves the bundle wires the
engine and CSP-safe UI together. Vite emits a self-contained `dist/content.js`
(no remote code — CSP forbids it on github.com), and `public/manifest.json` is
copied in.

Full packaging — `chrome.storage`-backed token store, content-hashed bundle, the
CDN/manifest update channel — lands in **BL-014 / BL-015**.

## Load it

```sh
pnpm --filter @triage/extension build
# chrome://extensions → Developer mode → Load unpacked → apps/extension/dist
```
