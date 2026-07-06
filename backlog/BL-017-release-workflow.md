# BL-017 — Release workflow (tag → build → GitHub Release)

- **Milestone:** Tooling
- **Depends on:** BL-013, BL-014, BL-015
- **Constitution:** Serves principle 5 (robustness over cleverness — releases become
  reproducible, gated, and hands-off instead of artisanal) and principle 6 (everything
  ships as static, user-owned artifacts; no backend appears). Strains none.

## Summary

The release trigger surface: pushing a version tag builds every deliverable through the
full quality gate and publishes them as a GitHub Release. Deploys must be automatic per
release — this item provides the single event the per-surface deploy items (BL-018,
BL-019, BL-020) hook into, so "release" is one action: push a tag.

## Scope

- A `release.yml` workflow triggered by tags matching `v*`.
- Guard: the tag version must equal `apps/extension/public/manifest.json`'s `version`
  (the single version source since PR #21) — mismatch fails the release loudly before
  anything publishes.
- Run the full gate (lint, typecheck, test, build) — a release never skips CI.
- Attach to the GitHub Release:
  - the extension zip (`apps/extension/dist/` **without** `dist/channel/`),
  - `apps/bookmarklet/dist/install.html` and `bookmarklet.txt`,
  - the channel pair (`manifest.json` + `triage-<hash16>.js`).

## Out of scope

- Publishing to any external surface (Pages, Web Store, CDN) — those are BL-018/019/020,
  chained off this workflow.
- Changelog generation.

## Acceptance

- Pushing tag `vX.Y.Z` (matching the manifest version) produces a GitHub Release with all
  four artifact groups attached, with **no manual steps**.
- A tag that does not match `public/manifest.json` fails the workflow with a message
  naming both versions — it never publishes a half-versioned release.
- A red gate (lint/typecheck/test/build) aborts the release.

## Technical notes

- Version comparison reads `public/manifest.json` — do not reintroduce a second version
  source (the drift class removed in PR #21).
- Use `softprops/action-gh-release` or `gh release create` from the workflow; artifacts
  come from the same `pnpm build` the CI gate runs.
