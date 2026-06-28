# CLAUDE.md

Orientation for Claude Code working on **Triage** (working name): a browser plugin that
provides an alternative GitHub pull-request review flow for the agentic era.

## Read first

1. [`CONSTITUTION.md`](./CONSTITUTION.md) — the north star. It **wins** over convenience.
   Every change must pass its first principle: *reduce human escalation while preserving
   review accuracy where it matters.*
2. [`MVP.md`](./MVP.md) — scope, features, delivery, milestones, and the validated
   technical constraints (§6) and risks (§7).

Before scoping or building a feature, state which constitution principle it serves and
which (if any) it strains. Principles 2 (de-emphasize, never hide) and 4 (reviewer stays
accountable) need an explicit written justification if strained.

## Current state

- The product docs above exist and are authoritative.
- **BL-001 scaffolding is in place** (see [`README.md`](./README.md)): a pnpm + Turborepo
  monorepo with `packages/engine`, `packages/ui`, `apps/extension`, `apps/web`; Vite +
  Vitest + Biome; Husky hooks; GitHub Actions CI. The engine/ui/entry-shell split is the
  realized structure — keep to it.
- A **working bookmarklet prototype** exists as the behavioural reference for **M1**
  (categorized triage panel: `.diff`→API loading, path categorization, `package.json`
  dependency expansion, jump-to-file via native anchors). Treat it as the spec for M1
  output, not as code to preserve verbatim.
- Everything else (M2–M5 in MVP.md) is unbuilt.

## Repository layout & toolchain

Monorepo, dependencies flowing **one way: apps → ui → engine**. Full detail in
[`README.md`](./README.md).

```
packages/engine/   @triage/engine — provider- & UI-agnostic core (diff model, loading,
                   categorization, TokenStore contract). Runs from bookmarklet AND extension.
packages/ui/       @triage/ui — CSP-safe DOM helpers (createElement + CSSOM + addEventListener).
apps/extension/    @triage/extension — Chrome MV3 entry shell (bundles engine + ui).
apps/web/          @triage/web — web app placeholder (built later).
```

The **engine must stay provider- and UI-agnostic**: no imports of `@triage/ui` or app
code, no browser-extension APIs, no DOM. This is enforced two ways — the `engine-isolation`
forbidden-pattern rule (import ban) and the engine's `tsconfig` omitting the DOM/`chrome`
libs, so the compiler rejects any browser global.

## Working in this repo

All commands go through `pnpm` (Turborepo orchestrates per package):

```bash
pnpm build        # build every package/app (engine emits .d.ts)
pnpm test         # all Vitest suites
pnpm typecheck    # tsc --noEmit per package
pnpm lint         # biome check (lint + format)
pnpm lint:fix     # biome check --write
pnpm dev          # watch builds
```

- **Branching.** Never commit to `main` (`validate-commit.sh` blocks it). Cut a fresh
  `<type>/<slug>` branch from `main` before editing (`require-fresh-branch.sh` enforces it
  on the first edit). `<type>` ∈ {feat, fix, chore, refactor, test, docs}.
- **Commits + PR.** Conventional + emoji: `type: <emoji> description` (emoji from the
  gitignored `CLAUDE.local.md`; ask if absent). Always use the `gh` CLI; open PRs with the
  `/pr` skill, which watches CI and runs the self-review loop. Full rules:
  [`.claude/rules/git.md`](./.claude/rules/git.md).
- **Testing.** Vitest — `node` env for the engine, `jsdom` for the UI. Co-located
  `<name>.test.ts`, exercise the contract not the implementation. Full rules:
  [`.claude/rules/testing.md`](./.claude/rules/testing.md).
- **Session close.** On stop, `session-close.sh` runs lint + typecheck + affected tests and
  prompts for a PR. It **blocks** on failure (set `TRIAGE_SOFT=1` to downgrade to a warning,
  `TRIAGE_SKIP_CLOSE=1` to skip).

## Hard protections (hook-enforced)

Hooks block hard-rule violations at the point of action — **never work around a hook**;
read the message and fix the violation.

- Direct commits on `main`/`master` and `--no-verify` are blocked.
- Forbidden patterns ([`.claude/rules/forbidden-patterns.json`](./.claude/rules/forbidden-patterns.json))
  are blocked at Edit/Write time with the rule ID + fix. Current rules enforce the
  CSP-safe-DOM and engine-isolation constraints below, plus a 300-LOC file cap.

To change an enforced rule, edit `forbidden-patterns.json` — one file, cited by rule ID.

## Hard constraints (validated against live GitHub — do not relitigate)

These are environment facts, not preferences. Re-deriving or ignoring them reintroduces
bugs we already fixed. Full detail in MVP.md §6.

- **Never scrape the diff DOM.** GitHub's Files-changed view is virtualized; only on-screen
  rows exist. Get files/patches from `.diff` or the REST API.
- **Loading:** same-origin `/{owner}/{repo}/pull/{n}.diff` first (no token); on failure
  fall back to REST `/repos/{owner}/{repo}/pulls/{n}/files`. A `.diff` failure is a
  CSP-blocked cross-origin redirect (private PRs), **not** "PR too large" — keep the API
  fallback and never mislabel the error.
- **API needs a token.** `api.github.com` is CSP-allowed and CORS-allows `Authorization`,
  but the session cookie does not authenticate it. Token storage must be pluggable
  (localStorage for the bookmarklet; `chrome.storage` for the extension).
- **Navigation:** jump to a file with `#diff-<sha256(path)>` (compute via `crypto.subtle`);
  setting `location.hash` scrolls the native view.
- **No remote code on github.com.** CSP is `script-src github.githubassets.com` with no
  `unsafe-eval`, `unsafe-inline`, `blob:`, or CDN. The bookmarklet must be **self-contained**
  (its `javascript:` execution is CSP-exempt). The CDN/manifest update channel is for the
  **extension only** — do not build a github.com bookmarklet loader against it.
- **Injected UI must be CSP-safe:** build with `createElement` + `element.style` (CSSOM) +
  `addEventListener`. No `innerHTML` carrying inline `style="…"` or `on*` handlers.

## Working agreements

- **Augment, don't replace.** Comments and the final verdict go back to GitHub via the
  Reviews API (`POST …/pulls/{n}/reviews`). We are never the system of record.
- **Never auto-approve, auto-resolve, or judge code quality.** Triage organizes; the human
  decides.
- **Local-first.** No backend of our own. In-progress review state lives in browser storage,
  keyed by `{owner}/{repo}#{num}@{headSha}`; detect head-SHA changes, never silently drop a
  draft.
- **Dogfood the thesis.** Land work in small PRs scoped by category so the tool is reviewable
  with the tool.
- **Definition of done = the MVP acceptance criteria** for that feature. Validate the
  riskiest integration (comment line/side anchoring, MVP.md §7) against a real PR early.

## Keeping docs honest

If a decision changes a constraint or scope, update `MVP.md` (and this file) in the same
change. These documents are the project's memory; stale guidance here is worse than none.
