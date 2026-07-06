# BL-030 — Automated semver releases (Release Please)

- **Milestone:** Tooling
- **Depends on:** BL-017
- **Constitution:** Serves principle 5 (the version is computed from the merged history,
  never hand-derived — removes the last error-prone manual step from the release path).
  Strains none.

## Summary

Automate the release *decision's paperwork* without automating away the decision:
Release Please watches `main`, computes the next semver from the conventional commits
merged since the last release (`feat:` → minor, `fix:` → patch, `feat!:`/`BREAKING
CHANGE` → major — the repo's `type: <emoji> subject` format parses cleanly), and
maintains a rolling **release PR** carrying the changelog and the version bump. Merging
that PR creates the `vX.Y.Z` tag — and the existing BL-017 release train takes over
unchanged. Releasing becomes one click.

## Why not release-on-every-merge

The train feeds the Chrome Web Store (BL-019), whose review queue takes days and
rejects uploads while a prior version is pending. Cadence therefore stays a human
decision (merge the release PR when ready); everything around it is automatic. If a
merge = release model is ever wanted, gate the `webstore` job behind a manual-approval
environment first.

## Scope

- `release-please` workflow on `push` to `main`, maintaining the release PR.
- The release PR bumps `apps/extension/public/manifest.json` (generic updater /
  `extra-files`), so BL-017's tag-vs-manifest guard keeps holding by construction.
- Tag created on release-PR merge matches the existing `v*` trigger — the BL-017
  workflow is not modified.
- No bot pushes to `main`: Release Please works through a PR, so branch protection and
  the autoreview keep applying.

## Out of scope

- Per-component versioning / tag families — that is BL-031.
- Publishing `@triage/*` packages to npm.

## Acceptance

- Merging a `feat:` PR to `main` updates the rolling release PR to a minor bump;
  a `fix:` updates it to a patch; the changelog lists the merged subjects.
- Merging the release PR creates tag `vX.Y.Z` equal to the bumped
  `public/manifest.json` version, and the BL-017 train runs to completion on it.
- No release happens without a human merging the release PR.

## Technical notes

- **Chrome version constraint:** MV3 versions are 1–4 dot-separated integers — no
  `-beta.1` pre-release suffixes. Do not enable prerelease versioning for anything the
  extension manifest consumes.
