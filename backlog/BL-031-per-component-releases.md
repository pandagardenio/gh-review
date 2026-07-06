# BL-031 — Per-component release trains (independent tags per app)

- **Milestone:** Tooling
- **Depends on:** BL-030
- **Constitution:** Serves principle 5 (each surface releases on its own evidence —
  a bookmarklet-only change no longer implies a Web Store submission). Strains none.

## Summary

Split the single `v*` release train into independent per-component trains using
Release Please's monorepo (manifest) mode: each app gets its own semver line and tag
family, bumped only by commits touching its paths. Different surfaces genuinely have
different release semantics — the extension answers to store review, the bookmarklet
page is instant, the GitHub Action is consumed *by tag*.

## Component / tag design

| Component | Tag family | Train it triggers |
|---|---|---|
| `apps/extension` | `extension-vX.Y.Z` | extension zip + GitHub Release + `channel` + `webstore` jobs |
| `apps/bookmarklet` | `bookmarklet-vX.Y.Z` | install page assets + `pages` job |
| `apps/action` | `action-vX.Y.Z` | tag consumers reference in `uses:`; also move a floating `action-vX` major alias |
| `packages/engine`, `packages/ui` | — (none) | internal `workspace:*` libs; version-ride until published to a registry |
| `apps/web` | deferred | gets a train when the Control Room deploys (BL-029) |

A shared-code caveat: a commit touching only `packages/engine` bumps **nothing** by
default — decide per Release Please config whether engine/ui paths should be linked
into the extension + bookmarklet components (recommended: yes, so a core fix reaches
both surfaces' next release PR).

## Scope

- `release-please-config.json` + `.release-please-manifest.json` in manifest mode,
  `include-component-in-tag`, per-component changelogs.
- Restructure `release.yml` triggers by tag family (`extension-v*`, `bookmarklet-v*`,
  `action-v*`), moving each existing deploy job under its component's train; the
  version guard compares against the component's own version source.

## Out of scope

- npm publishing for `@triage/*` (would add `engine-v*` / `ui-v*` trains when wanted).
- Changing what any deploy job does — only *when each runs*.

## Acceptance

- A merged PR touching only `apps/bookmarklet` updates only the bookmarklet release
  PR; merging it tags `bookmarklet-vX.Y.Z` and redeploys Pages without creating a Web
  Store submission or channel publish.
- An extension release does not redeploy Pages unless bookmarklet paths also changed.
- `uses: pandagardenio/gh-review/apps/action@action-v1` resolves and tracks the latest
  `action-v1.*` release.
- Engine/ui-only changes surface in the linked components' release PRs (per the
  linking decision recorded in the config).
