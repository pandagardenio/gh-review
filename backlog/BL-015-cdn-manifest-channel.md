# BL-015 — CDN + manifest update channel (extension only)

- **Milestone:** M5
- **Depends on:** BL-001, BL-014
- **Constitution:** Serves principle 5 (a disciplined, validated update mechanism) and
  principle 6. Strains none. **Note:** this exists strictly within the validated CSP
  constraint — it must never be wired to the github.com bookmarklet.

## Summary

The auto-update channel: a content-hashed bundle on a CDN, a never-cached `manifest.json`
pointing at the latest entry, and a thin loader that reads the manifest then loads the
hashed bundle (MVP.md §5.2).

## Scope

- Build emits a content-hashed bundle (from BL-001) plus a tiny `manifest.json` holding the
  latest entry.
- Cache strategy:
  - `manifest.json`: `Cache-Control: no-store`,
  - hashed bundle: `Cache-Control: public, max-age=31536000, immutable` (safe — filename
    is its hash).
- Loader (extension context only) reads the manifest, then loads the hashed bundle.

## Out of scope — hard constraint (MVP.md §5.2, validated)

- **Do NOT build a github.com bookmarklet loader against this.** GitHub's CSP is
  `script-src github.githubassets.com` with no `unsafe-eval`, `unsafe-inline`, `blob:`, or
  third-party CDN host. Remote code loading is **impossible** for the bookmarklet on
  github.com. The bookmarklet stays self-contained (BL-013).

## Acceptance

- Publishing a new build updates `manifest.json`; the loader picks up the new hashed bundle
  on next load; the immutable bundle is cached indefinitely and the manifest is never
  cached.
- This channel is reachable **only** from the extension (or a future non-GitHub host whose
  CSP permits it) — never from the github.com bookmarklet.

## Technical notes

- Retained per MVP.md §5.2 "Resolution": keep the build producing hashed bundles +
  manifest; just don't wire a github.com bookmarklet loader to them.
