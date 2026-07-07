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

| Component | Tag family | Release mode | Train it triggers |
|---|---|---|---|
| `apps/extension` | `extension-vX.Y.Z` | **gated** (human merges the release PR) | extension zip + GitHub Release + `channel` + `webstore` jobs |
| `apps/bookmarklet` | `bookmarklet-vX.Y.Z` | **auto** (release PR auto-merges on green CI) | install page assets + `pages` job |
| `apps/action` | `action-vX.Y.Z` | **auto** | tag consumers reference in `uses:`; also move a floating `action-vX` major alias |
| `packages/engine`, `packages/ui` | — (none) | n/a | internal `workspace:*` libs; version-ride until published to a registry |
| `apps/web` | deferred | auto when it gets a train | gets a train when the Control Room deploys (BL-029) |

## Per-component release mode (decided)

The gate exists only where something external throttles or reviews the deploy:

- **Extension — gated.** Every publish enters the Web Store review queue (days;
  uploads while one is pending are rejected), so cadence stays a human decision.
- **Bookmarklet page — auto.** The deploy is instant and imposes nothing on anyone:
  users only update by manually re-installing from the page, so an always-fresh
  canonical page is pure win and a stale one pure loss.
- **Action — auto.** Consumers pin `@action-vN` and expect patches/minors to flow;
  a breaking change mints `action-v(N+1)`, which nobody gets without editing their
  workflow — opt-in by construction.
- Future npm libs and `apps/web` default to auto for the same reasons (version-pinned
  consumers / no external review).

Mechanism: one uniform machinery — Release Please opens a release PR per component;
for components marked auto, a small workflow step enables GitHub auto-merge on that
release PR, so the CI gate still decides and the human gate applies only where listed.

Shared-code decision (settled during implementation): **no forced linking.** A commit
touching only `packages/engine` or `packages/ui` opens no release PR by itself — it
ships with the next extension/bookmarklet change. The reason is mechanical: Release
Please attributes a commit to a component only by *that component's path*, and the one
plugin that crosses paths (`linked-versions`) forces every linked component to a single
shared version — which would destroy the independent versioning that is this item's
whole point. So engine/ui stay unversioned internal libs and ride the consuming app's
next release. To ship a pure-core fix immediately without an app change, cut the app's
release manually (a `Release-As: x.y.z` commit footer, or re-run Release Please after a
trivial app-scoped commit).

## Scope

- `release-please-config.json` + `.release-please-manifest.json` in manifest mode,
  `include-component-in-tag`, per-component changelogs.
- Restructure `release.yml` triggers by tag family (`extension-v*`, `bookmarklet-v*`,
  `action-v*`), moving each existing deploy job under its component's train; the
  version guard compares against the component's own version source.
- The auto-merge step for auto-mode components' release PRs (release mode table above).

## Out of scope

- npm publishing for `@triage/*` (would add `engine-v*` / `ui-v*` trains when wanted).
- Changing what any deploy job does — only *when each runs*.

## Acceptance

- A merged PR touching only `apps/bookmarklet` updates only the bookmarklet release
  PR, which auto-merges on green CI — tagging `bookmarklet-vX.Y.Z` and redeploying
  Pages without any human step and without creating a Web Store submission or channel
  publish.
- The extension's release PR never auto-merges — a Web Store submission always traces
  to a human merge.
- An extension release does not redeploy Pages unless bookmarklet paths also changed.
- `uses: pandagardenio/gh-review/apps/action@action-v1` resolves and tracks the latest
  `action-v1.*` release.
- Engine/ui-only changes surface in the linked components' release PRs (per the
  linking decision recorded in the config).
