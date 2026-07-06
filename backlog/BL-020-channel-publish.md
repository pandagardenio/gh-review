# BL-020 — Update channel auto-publish (static host + cache policy)

- **Milestone:** Tooling
- **Depends on:** BL-015, BL-017
- **Constitution:** Serves principle 5 (the channel's correctness rests entirely on its
  cache policy — automating the upload is the only way the policy is applied the same
  way every time). Strains none. **Note:** exists strictly within the validated CSP
  constraint — never wired to the github.com bookmarklet (MVP.md §5.2).

## Summary

Each release automatically uploads `dist/channel/` (the host-agnostic hashed bundle +
`manifest.json`, BL-015) to a static host with the validated per-file cache headers, so
publishing the channel is part of the release, not a hand-run checklist.

## Scope

- A deploy job chained onto the BL-017 release workflow that uploads the release's
  channel artifacts to the chosen static host, applying the policy pinned in
  `apps/extension/src/update-channel/channel.ts`:
  - `manifest.json` → `Cache-Control: no-store`,
  - `triage-<hash16>.js` → `Cache-Control: public, max-age=31536000, immutable`.
- Host choice + credentials parameterized as repo secrets (any of S3+CloudFront,
  Cloudflare R2/Pages, Netlify `_headers` works — pick one in the item's PR and record
  it in `apps/extension/README.md`).
- Order of writes: bundle first, manifest last — a reader must never see a manifest
  naming a bundle that is not yet uploaded.

## Out of scope — hard constraint (MVP.md §5.2, validated)

- **No github.com bookmarklet loader against this channel** — remote code is impossible
  under GitHub's CSP; the bookmarklet stays self-contained (BL-013, enforced by the
  `channel-isolation` rule).

## Acceptance

- After a release, `GET <channel>/manifest.json` returns the new version + `sha256` with
  `Cache-Control: no-store`, and the named bundle is served with the immutable policy —
  **no manual steps**.
- The loader contract holds end-to-end against the live host: `loadLatestBundle` picks
  up the publish on next load and the integrity check passes.

## Technical notes

- Known caveat (recorded in PR #21): no consumer exists yet — the extension updates via
  the Web Store; the channel serves a future non-GitHub host. Automating the publish
  keeps the channel honest and testable until that host lands; if the team prefers to
  defer spending on hosting, this is the one item of the four that can wait.
