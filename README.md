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
  extension/   @triage/extension — Chrome MV3 entry shell (bundles engine + ui).
  web/         @triage/web — web app placeholder (built later).
```

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
| Coverage | **Vitest v8** coverage (lcov per package) |

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
- The content-hashed bundle + `manifest.json` update channel for the extension
  is **BL-014 / BL-015**; the bookmarklet packaging is **BL-013**.
