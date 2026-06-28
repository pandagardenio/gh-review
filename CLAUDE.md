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
- A **working bookmarklet prototype** exists as the behavioural reference for **M1**
  (categorized triage panel: `.diff`→API loading, path categorization, `package.json`
  dependency expansion, jump-to-file via native anchors). Treat it as the spec for M1
  output, not as code to preserve verbatim.
- Everything else (M2–M5 in MVP.md) is unbuilt.

## Your call: scaffolding

You own the project structure, build tooling, and conventions. Pick what fits; just keep
the **core review engine provider-agnostic and UI-agnostic** so the same code runs from
both the bookmarklet and the extension. A reasonable split is engine (parsing, loading,
categorization, diff model) / UI / thin per-target entry shells — but decide for yourself.

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
