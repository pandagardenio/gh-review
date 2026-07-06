# Triage

An alternative GitHub pull-request review flow for the agentic era. See
[`CONSTITUTION.md`](./CONSTITUTION.md), [`MVP.md`](./MVP.md), and
[`CLAUDE.md`](./CLAUDE.md) for the product north star and the
[`backlog/`](./backlog/) for the work items.

## Monorepo layout

```
packages/
  engine/      @triage/engine — provider- & UI-agnostic core (diff model,
               loading, categorization, token-store contract). The same code
               runs from the bookmarklet and the extension.
  ui/          @triage/ui — CSP-safe DOM construction helpers
               (createElement + CSSOM + addEventListener; never innerHTML).
apps/
  action/      @triage/action — GitHub Action entry shell (Node CLI; bundles
               engine). Auto-approves PRs with no review-required changes,
               defers the rest to a human (BL-016; opt-in CI surface).
  extension/   @triage/extension — Chrome MV3 entry shell (bundles engine + ui).
  web/         @triage/web — web app placeholder (built later).
```

The [autoreview action](./apps/action/README.md) is a **separate, opt-in CI
surface** — the browser plugin never approves (Constitution principle 4); the
action's bounded carve-out is documented in `CONSTITUTION.md` and `MVP.md` §9.

Dependencies flow one way only: **apps → ui → engine**. The engine imports no UI
and no browser-extension API (enforced as BL-001 acceptance).

## Toolchain (BL-001 decisions)

| Concern | Choice |
| --- | --- |
| Package manager | **pnpm** workspaces |
| Task runner | **Turborepo** (`turbo.json`) |
| Bundler / dev | **Vite** (library mode for packages, app builds for apps) |
| Tests | **Vitest** (`node` env for engine, `jsdom` for ui) |
| Lint + format | **Biome** (`biome.json`) |
| Types | **TypeScript** project references, per-package `tsconfig` |
| Git hooks | **Husky** + **lint-staged** |
| Coverage + quality | **Vitest v8** coverage → **SonarCloud**, one project per package ([docs/sonarcloud.md](./docs/sonarcloud.md)) |
| Agent harness | `.claude/` hooks + rules (CSP/engine-isolation guards), `/pr` skill ([CLAUDE.md](./CLAUDE.md)) |

## Commands

```sh
pnpm install        # install the workspace
pnpm build          # turbo: build every package/app (engine emits .d.ts too)
pnpm test           # turbo: run all Vitest suites
pnpm test:coverage  # turbo: Vitest with v8 coverage (lcov per package, feeds Sonar)
pnpm typecheck      # turbo: tsc --noEmit per package
pnpm lint           # biome check (lint + format)
pnpm lint:fix       # biome check --write
pnpm dev            # turbo: watch builds
```

## Git hooks

- **pre-commit** — `lint-staged` runs Biome (`check --write`) on staged files.
- **pre-push** — runs Vitest only for packages affected since the upstream
  `main` (via `turbo run test --filter="...[<base>]"`), with a fallback base ref
  so the hook works before any remote exists.

## Build outputs

- Each package/app emits to its own `dist/`. The extension produces a single
  **self-contained** `dist/content.js` (engine + ui inlined — github.com's CSP
  forbids remote code).
- The extension build also publishes its update channel (**BL-015**) to
  `dist/channel/`: the bundle under its content-hash name plus a never-cached
  `manifest.json` naming it (cache policy in
  [`apps/extension/README.md`](./apps/extension/README.md)).
- The bookmarklet packaging (**BL-013**) emits `dist/bookmarklet.txt` (the
  self-contained `javascript:` URL) and `dist/install.html`.

## Releasing

Releases are fully automatic (**BL-017**, `.github/workflows/release.yml`): the only
manual action is tagging.

1. Bump `version` in `apps/extension/public/manifest.json` — the single version source
   — and land that on `main`.
2. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z` (the tag must match the
   manifest version; a mismatch fails the release before anything publishes).

The workflow re-runs the full quality gate, then publishes a GitHub Release with the
extension zip (channel excluded), the bookmarklet `install.html` + `bookmarklet.txt`,
and the update-channel pair. Per-surface deploys (Pages, Web Store, update channel —
BL-018/019/020) chain off this workflow as they land.
