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

Releasing is one click (**BL-030**, `.github/workflows/release-please.yml`). You never
bump the version or craft a tag by hand:

1. Merge feature/fix PRs to `main` as usual. Release Please reads the conventional
   commits (`feat:` → minor, `fix:` → patch, `!`/`BREAKING CHANGE` → major) and keeps a
   rolling **release PR** open that bumps `apps/extension/public/manifest.json` (the
   single version source) and accumulates the changelog.
2. When you want to ship, **merge the release PR**. That creates the `vX.Y.Z` tag, which
   triggers the release train below. Cadence stays a human decision — nothing releases
   until you merge that PR (the Web Store review queue, BL-019, punishes releasing on
   every merge).

> **One-time bootstrap:** set a `RELEASE_PLEASE_TOKEN` secret to a PAT (or GitHub App
> token) with `contents: write`, so the tag Release Please pushes actually triggers
> `release.yml` — GitHub suppresses workflow triggers from the default `GITHUB_TOKEN`.
> Without it the release PR and tag are still created, but you must re-push the tag to
> kick the train (`git push origin :vX.Y.Z && git push origin vX.Y.Z`).

The release train (**BL-017**, `.github/workflows/release.yml`) re-runs the full quality
gate — it re-verifies the tag matches `apps/extension/public/manifest.json`, so a stray
hand-pushed tag still fails safely — then publishes a GitHub Release with the
extension zip (channel excluded), the bookmarklet `install.html` + `bookmarklet.txt`,
and the update-channel pair. It then deploys the bookmarklet install page to GitHub
Pages (**BL-018**) — the canonical install URL always serves the latest release, and
re-installing from it is how the bookmarklet updates. It also submits the released
extension zip to the Chrome Web Store (**BL-019**) once the one-time bootstrap is done:
create the developer account and first listing manually, mint the OAuth credentials,
then set the `CWS_EXTENSION_ID` repo **variable** (the job's dormancy gate, same
pattern as Sonar's `SONAR_ORGANIZATION`) and the `CWS_CLIENT_ID` / `CWS_CLIENT_SECRET`
/ `CWS_REFRESH_TOKEN` secrets — until then the job skips cleanly. Finally it publishes
the update channel (**BL-020**) to any S3-compatible bucket with the validated cache
policy, bundle before manifest; gate it on with the `CHANNEL_BUCKET` variable +
`CHANNEL_ACCESS_KEY_ID` / `CHANNEL_SECRET_ACCESS_KEY` secrets (full contract in
[`apps/extension/README.md`](./apps/extension/README.md)).

The Pages job self-enables GitHub Pages on first run (`configure-pages` with
`enablement: true`); if the repo restricts that, set Pages → Source → GitHub Actions
once in the repo settings.
