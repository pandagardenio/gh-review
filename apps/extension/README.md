# @triage/extension

Chrome MV3 extension — a thin per-target entry shell over `@triage/engine` and
`@triage/ui`. It owns no review logic; it bundles the engine + UI and injects the
content script on PR pages.

## Status

- **BL-014 (done):** `src/content.ts` runs in the extension's isolated world and mounts
  the same review panel as the bookmarklet, with the token in `chrome.storage`
  (`ChromeStorageTokenStore`) instead of page-reachable `localStorage`.
- **BL-015 (done):** the build also publishes the CDN/manifest update channel to
  `dist/channel/` (see below).

## Load it

```sh
pnpm --filter @triage/extension build
# chrome://extensions → Developer mode → Load unpacked → apps/extension/dist
```

## Update channel (BL-015)

Every build emits, next to the unpacked extension:

```
dist/channel/
  manifest.json            # { schema, version, bundle } — names the latest build
  triage-<hash16>.js       # the bundle under (a prefix of) its SHA-256 content hash
```

The channel version is read from `public/manifest.json` — the one version Chrome
enforces (the panel header shows the same value via `chrome.runtime.getManifest()`).
The published bundle is the in-memory chunk, without the `sourceMappingURL` pointer
the local `dist/content.js` carries: sourcemaps are not part of the channel.

To publish, upload `dist/channel/` to a static host with the validated cache policy
(MVP.md §5.2, pinned as constants in `src/update-channel/channel.ts`):

- `manifest.json` → `Cache-Control: no-store` (never cached; a publish is seen on the
  next load),
- `triage-<hash16>.js` → `Cache-Control: public, max-age=31536000, immutable` (safe —
  the filename is its content hash).

`src/update-channel/loader.ts` is the thin consumer: it reads the manifest (bypassing
caches), then loads the hashed bundle it names.

**Hard constraint (validated — MVP.md §5.2):** this channel is for the extension, or a
future non-GitHub host whose CSP permits it. It is **never** wired to the github.com
bookmarklet — GitHub's CSP (`script-src github.githubassets.com`, no `unsafe-eval`,
`unsafe-inline`, `blob:`, or CDN) makes remote code impossible there, so the bookmarklet
stays self-contained (BL-013). The `channel-isolation` forbidden-pattern rule enforces
this at write time. Note MV3 also forbids remotely hosted code, so the installed
extension itself ships the bundle and updates via the Web Store; the channel is the
generic publish surface kept per MVP.md §5.2's resolution.
