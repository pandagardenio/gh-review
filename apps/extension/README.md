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

Every build runs a second, channel-only publish build (`vite.channel.config.ts`) that
emits, next to the unpacked extension:

```
dist/channel/
  manifest.json            # { schema, version, bundle, sha256 } — names the latest build
  triage-<hash16>.js       # the channel entry under (a prefix of) its SHA-256 hash
```

The published bundle is **not** the content script: it is the host-agnostic
`src/channel-entry.ts` (engine + UI, no `chrome.*`), exposing `globalThis.Triage`
(`version` + `mount({ tokens })`) so a consuming host supplies its own `TokenStore`
and attaches the panel itself. The channel version is read from
`public/manifest.json` — the one version Chrome enforces (the panel header shows the
same value via `chrome.runtime.getManifest()`). Sourcemaps are not part of the channel.

To publish, upload `dist/channel/` to a static host with the validated cache policy
(MVP.md §5.2, pinned as constants in `src/update-channel/channel.ts`):

- `manifest.json` → `Cache-Control: no-store` (never cached; a publish is seen on the
  next load),
- `triage-<hash16>.js` → `Cache-Control: public, max-age=31536000, immutable` (safe —
  the filename is its content hash).

Publishing is automatic per release (**BL-020**, the `channel` job in
`.github/workflows/release.yml`): the released channel pair is uploaded — bundle
first, manifest last, so a reader never sees a manifest naming a missing bundle —
to the recorded host choice: **any S3-compatible bucket** (AWS S3, Cloudflare R2,
MinIO). Configure repo variables `CHANNEL_BUCKET` (the dormancy gate — the job skips
until it is set), optional `CHANNEL_PREFIX` (default `triage`), `CHANNEL_REGION`,
`CHANNEL_ENDPOINT_URL` (required for non-AWS hosts), optional `CHANNEL_PUBLIC_URL`
(enables the post-publish live header check), and secrets `CHANNEL_ACCESS_KEY_ID` /
`CHANNEL_SECRET_ACCESS_KEY`. The bucket/CDN must serve the objects' stored
`Cache-Control` headers (S3, R2, and CloudFront do by default).

`src/update-channel/loader.ts` is the thin consumer: it reads the manifest (bypassing
caches), loads the hashed bundle it names, and verifies the bytes against the
manifest's full `sha256` before returning them (the manifest itself is unsigned —
TLS is that layer).

**Hard constraint (validated — MVP.md §5.2):** this channel is for the extension, or a
future non-GitHub host whose CSP permits it. It is **never** wired to the github.com
bookmarklet — GitHub's CSP (`script-src github.githubassets.com`, no `unsafe-eval`,
`unsafe-inline`, `blob:`, or CDN) makes remote code impossible there, so the bookmarklet
stays self-contained (BL-013). The `channel-isolation` forbidden-pattern rule guards the
import path at write time (any import of the channel modules from the bookmarklet app is
blocked); the constraint itself lives in MVP.md §5.2. Note MV3 also forbids remotely
hosted code, so the installed extension itself ships its bundle and updates via the Web
Store; the channel serves a future permitting host, per MVP.md §5.2's resolution.
