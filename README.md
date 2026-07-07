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

Each app releases on its **own** train (**BL-030** semver + **BL-031** per-component
trains). You never bump a version or craft a tag by hand — Release Please
(`.github/workflows/release-please.yml`) reads the conventional commits (`feat:` →
minor, `fix:` → patch, `!`/`BREAKING CHANGE` → major) and keeps a **separate rolling
release PR per app**, each bumping only that app's version source and changelog from the
commits that touched its paths:

| App | Version source | Tag family | Release mode |
|---|---|---|---|
| extension | `apps/extension/public/manifest.json` | `extension-vX.Y.Z` | **gated** — you merge the release PR |
| bookmarklet | `apps/bookmarklet/src/version.ts` | `bookmarklet-vX.Y.Z` | **auto** — release PR self-merges on green CI |
| action | `apps/action/package.json` | `action-vX.Y.Z` | **auto** |

Merging a component's release PR creates its tag, which fires exactly that component's
train in `.github/workflows/release.yml`:

- **`extension-v*`** → full gate + build → GitHub Release (extension zip + channel pair)
  → Chrome Web Store submission (**BL-019**) + update-channel publish (**BL-020**).
- **`bookmarklet-v*`** → gate + build → GitHub Release (`install.html` +
  `bookmarklet.txt`) → GitHub Pages deploy (**BL-018**).
- **`action-v*`** → gate + build → GitHub Release → moves the floating `action-vN` major
  alias that consumers pin with `uses: …/apps/action@action-vN`.

Each train re-verifies the tag against its component's version source, so a stray
hand-pushed tag still fails safely. `packages/engine` / `packages/ui` are unversioned
internal libs: a change touching only them rides the next extension/bookmarklet release
(no forced linking — see [`backlog/BL-031`](./backlog/BL-031-per-component-releases.md)).

**Why the extension is gated but the others are auto:** the extension's publish enters
the Chrome Web Store review queue (days; rejects uploads while one is pending), so its
cadence stays a human decision. The bookmarklet page and the action deploy instantly to
opt-in consumers, so their release PRs self-merge.

> **One-time bootstrap:**
> - `RELEASE_PLEASE_TOKEN` secret (PAT / GitHub App token, `contents: write`) so the
>   tags Release Please pushes trigger `release.yml` — GitHub suppresses workflow
>   triggers from the default `GITHUB_TOKEN`. Without it, re-push the tag to kick a train.
> - Enable **Allow auto-merge** in repo settings so the bookmarklet/action release PRs
>   self-merge; without it they simply wait for a human.
> - Chrome Web Store (**BL-019**): developer account + first manual listing + OAuth
>   credentials, then the `CWS_EXTENSION_ID` variable and `CWS_CLIENT_ID` /
>   `CWS_CLIENT_SECRET` / `CWS_REFRESH_TOKEN` secrets — until then the job skips cleanly.
> - Update channel (**BL-020**): the `CHANNEL_BUCKET` variable + `CHANNEL_ACCESS_KEY_ID`
>   / `CHANNEL_SECRET_ACCESS_KEY` secrets (full contract in
>   [`apps/extension/README.md`](./apps/extension/README.md)).
> - Pages self-enables on first run (`configure-pages` with `enablement: true`); if the
>   repo restricts that, set Pages → Source → GitHub Actions once.
