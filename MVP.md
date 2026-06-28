# MVP

Scope and requirements for the first shippable version of **Triage** (working name).
Read [`CONSTITUTION.md`](./CONSTITUTION.md) first — every item below is downstream of it.

This document is written to be handed to Claude Code. Where a feature has a sharp edge,
the acceptance criteria are the contract; the "Notes" are guidance, not gospel.

---

## 1. MVP goal

Prove that a reviewer can run a **complete, real review of an agentic PR** — explore it
by intent, focus only where it matters, comment, and submit an approval or change request
back to GitHub — and that the flow is faster and more accurate than GitHub's default for
machine-authored diffs.

If a reviewer still has to fall back to GitHub's native "Files changed" tab to finish a
review, the MVP has failed.

---

## 2. Scope

**In scope**

- The categorized triage panel (already prototyped).
- A real, sectioned review flow with our own diff rendering.
- A dedicated test-review sub-flow.
- Draft persistence and recovery via local storage.
- Materializing the finished review onto the PR (approve / request changes / comment).
- Two delivery channels: a self-contained bookmarklet and a Chrome (MV3) extension.

**Out of scope for MVP** (deliberately deferred)

- Providers other than GitHub (GitLab, Bitbucket, Azure DevOps).
- Syntax highlighting in our diff renderer (plain monospace is fine for v1).
- Symbol-level "go to the exact function under test" resolution.
- Settings UI, themes, AI summaries, server-side anything.
- Multi-file review comments / suggested changes (single-line comments only in v1).

---

## 3. The categorization model (foundation)

Files are bucketed by path, **first match wins, top to bottom**. This order *is* the
review order:

1. **Dependencies** — `package.json`, lockfiles, other manifests. `package.json` is
   expanded inline to show added / bumped / removed deps.
2. **Harness** — `CLAUDE.md`, `.claude/`, `.mcp.json`, `AGENTS.md`, cursor/copilot/
   windsurf/cline rules, etc.
3. **CI** — `.github/workflows`, `.github/actions`, CircleCI, GitLab CI, etc.
4. **Config** — tsconfig, eslint/prettier/biome, bundler/framework/test-runner config,
   `.storybook/`, Dockerfiles, env files.
5. **Tests** — `*.test.*`, `*.spec.*`, `*.stories.*`, `__tests__`, e2e, snapshots, fixtures.
6. **Docs** — `*.md(x)`, `docs/`, README/CHANGELOG/CONTRIBUTING.
7. **Code** — everything else; collapsed by default.

The rule list lives in one editable array. Treat it as product surface: adding/moving a
rule is a product decision measured against the constitution, not a throwaway tweak.

---

## 4. Features

### 4.1 Triage panel (exists — the entry point)

The categorized navigator already built: per-category sections with file counts and churn,
inline dependency changes for `package.json`, and jump-to-file via GitHub's native
`#diff-<sha256(path)>` anchors. This is the launcher for the review flow below.

**Acceptance:** opens on any PR, groups all changed files correctly, code collapsed by
default, clicking a file scrolls the native diff to it.

### 4.2 Real review flow (the core of the MVP)

> *As a user I want to review and explore each section independently — both as a block and
> as individual files — using the real code diff, in a flow that fully replaces GitHub's.*

This means **we render the diff ourselves** (GitHub's new diff view is virtualized, so we
cannot rely on its DOM; we already have the per-file `patch`). The review happens inside
Triage's surface, not GitHub's.

**Sectioned exploration**

- Each category from §3 is a review section.
- **Block level:** a section can be marked reviewed as a whole, and collapsed.
- **Individual level:** each file within a section has its own diff and its own
  "viewed" state.
- Progress is shown per section and overall (e.g. `Config 3/3 · Code 0/40`).

*Acceptance:* every changed file is reachable and reviewable inside Triage; marking a file
viewed updates section and overall progress; sections collapse/expand independently.

**Real diff rendering**

- Render a unified diff per file from its `patch` (hunks, added/removed/context lines,
  line numbers).
- Plain monospace is acceptable for MVP; no syntax highlighting required.
- Binary / patch-less files show a clear "no inline diff — open on GitHub" affordance.

*Acceptance:* the rendered diff matches GitHub's content for the file; hunks and line
numbers are correct; absent patches degrade gracefully.

**Inline comments**

- A reviewer can attach a comment to a specific line within the rendered diff.
- Comments are held in the local draft (see persistence) until the review is submitted.
- Single-line comments only in MVP.

*Acceptance:* a comment can be added, edited, and removed before submission, and is
correctly anchored to `path` + line + side (LEFT/RIGHT).

### 4.3 Tests sub-flow

> *For tests, I want to preview the test cases changed, added, and deleted, and be able to
> focus on the implementation.*

For each file in the **Tests** section:

- Parse test-case titles from the patch — `describe` / `context` / `it` / `test(` — and
  classify each as **added** (in `+` lines), **deleted** (in `-` lines), or **changed**
  (title stable, body touched).
- Show the list of cases with their status; clicking a case scrolls to it in the rendered
  diff.
- **Focus the implementation:** from a test file, offer a jump to the file under test using
  a sibling heuristic (`x.spec.ts`→`x.ts`, `__tests__/x.test.ts`→`../x.ts`). If that file
  is in the PR, jump to its Triage diff; otherwise open it on the PR's head branch.

*Acceptance:* added/deleted/changed cases are listed correctly for a representative spec;
clicking a case navigates to it; the implementation jump resolves to the sibling when one
exists.

*Notes:* parsing is heuristic (regex over patch lines), not a full AST. Good enough for
MVP; AST/symbol resolution is explicitly deferred.

### 4.4 Persistence — start, leave, recover

> *I want to start a review, leave, and recover the content later from localStorage.*

- The entire in-progress review is a single draft object persisted to local storage,
  keyed by `triage:review:{owner}/{repo}#{number}@{headSha}`.
- Draft contains: overall intent (none/approve/request-changes/comment), per-section and
  per-file viewed state, all draft comments, and `updatedAt`.
- On reopening the PR, the draft is restored automatically.
- If the PR's head SHA changed since the draft was saved, surface a non-destructive notice
  ("this PR has new commits since your draft") and let the reviewer keep or discard.

*Acceptance:* closing and reopening the tab restores viewed state and draft comments; a
head-SHA change is detected and surfaced without silently dropping work.

### 4.5 Materialization — the review lands on the PR

> *The review is materialized in the PR once it ends (approve or request changes).*

- "Finish review" submits the accumulated draft as **one** GitHub review via
  `POST /repos/{owner}/{repo}/pulls/{number}/reviews`, with `commit_id` = head SHA,
  `event` ∈ `APPROVE | REQUEST_CHANGES | COMMENT`, an optional `body`, and the draft
  `comments[]` (`path`, `line`, `side`, `body`).
- On success, the local draft is cleared and the panel reflects the submitted state.
- On failure (auth, conflict, validation), nothing is lost — the draft remains and the
  error is shown plainly.

*Acceptance:* submitting produces exactly one review on the PR carrying all comments and
the chosen event; a failed submission leaves the local draft intact.

---

## 5. Delivery

Two channels, one core. The review engine is identical; only loading and credential
storage differ.

### 5.1 Bookmarklet (self-contained) — MVP

- Ships as a **single self-contained bundle inlined in the `javascript:` URL.** No remote
  loading. The bookmarklet's own execution is exempt from the page CSP, which is why this
  works at all.
- Displays its version in the panel. Updating means re-installing the bookmarklet.

### 5.2 CDN + manifest versioning — as specified, with a hard constraint

The intended design: compiled, content-hashed bundle on a CDN; a tiny, never-cached
`manifest.json` holding the latest entry; a thin loader that reads the manifest then loads
the hashed bundle. Cache strategy: manifest `Cache-Control: no-store`; bundle
`Cache-Control: public, max-age=31536000, immutable` (safe because the filename is its hash).

**Constraint (validated):** this loader **cannot run on github.com.** GitHub's CSP is
`script-src github.githubassets.com` with no `unsafe-eval`, no `unsafe-inline`, no `blob:`,
and no third-party CDN host. Therefore a bookmarklet on github.com cannot inject a remote
`<script>`, cannot `eval`/`new Function()` fetched code, and cannot run a Blob script. Remote
code loading is impossible for the bookmarklet on the target site.

**Resolution:**

- The **bookmarklet** stays self-contained (§5.1). The CDN/manifest auto-update story does
  **not** apply to it on github.com — do not build it for that path.
- The CDN + manifest mechanism is retained as the **extension's** update channel and for
  any future non-GitHub host whose CSP permits it. Keep the build producing hashed bundles
  + manifest; just don't wire a github.com bookmarklet loader to them.

### 5.3 Chrome extension (MV3) — the real auto-updating channel

- Content script runs in the extension's **isolated world**, not subject to the page's CSP,
  so the full review engine loads cleanly and updates through the Web Store / the manifest
  channel above. (MV3 forbids remote code anyway, so the bundle ships with the extension.)
- Token stored in `chrome.storage` (isolated from page scripts) — fixes the bookmarklet's
  localStorage exposure (§6).
- `host_permissions` for `api.github.com` so API calls bypass the page's `connect-src`.

*Acceptance for delivery:* the same review flow runs identically when launched from the
bookmarklet and from the extension; the extension stores its token outside page-reachable
storage.

---

## 6. Decisions & constraints already validated

Captured so we don't re-derive or re-break them. These are facts about the environment,
checked against live GitHub.

- **Data source.** Use the same-origin `/{owner}/{repo}/pull/{n}.diff` as a tokenless fast
  path; on failure fall back to the REST API `/repos/{owner}/{repo}/pulls/{n}/files`.
- **`.diff` fails on private PRs.** It 302-redirects to a host outside GitHub's
  `connect-src` allowlist, so the browser blocks the redirect and `fetch` throws
  "Failed to fetch" — *not* a size problem. Always have the API fallback.
- **API is reachable from the page.** `api.github.com` is in GitHub's `connect-src`, and its
  CORS preflight allows the `Authorization` header from a `github.com` origin. It needs a
  token (the session cookie does not authenticate `api.github.com`).
- **Native jump anchors.** GitHub's per-file anchor is `#diff-<sha256(filepath)>` (hex).
  Compute with `crypto.subtle`; setting `location.hash` scrolls the native (virtualized)
  view to the file.
- **The diff view is virtualized.** Only on-screen rows exist in the DOM. Never scrape the
  diff DOM for the file list or content — use `.diff`/API.
- **CSP forbids remote code** on github.com (see §5.2). Bookmarklet must be self-contained.
- **Augment, not replace** (Constitution §3): comments and the final verdict go back to
  GitHub through the Reviews API; we never become the system of record.

---

## 7. Open questions / risks

- **Comment anchoring.** Line + side is the modern Reviews API shape; confirm behavior for
  comments on context lines and on the LEFT side of large hunks. Validate against a real PR
  early — this is the riskiest integration point.
- **PR updated mid-review.** Head SHA moves while a draft exists. MVP surfaces it (§4.4);
  decide later whether to offer a rebase/remap of viewed state and comments.
- **Token security in the bookmarklet.** localStorage on github.com is page-readable. MVP
  ships it with a clear warning and minimal-scope guidance; the extension is the real fix.
- **Large PRs.** Rendering hundreds of files' diffs ourselves needs lazy rendering per
  section/file so we don't recreate the perf problem GitHub just solved with virtualization.

---

## 8. Suggested milestones

1. **M1 — Engine + panel:** loader (`.diff` + API fallback), categorization, triage panel
   with dependency expansion. *(Largely done in the prototype.)*
2. **M2 — Render & explore:** our own unified-diff rendering; sectioned block/individual
   review with viewed state and progress.
3. **M3 — Tests sub-flow:** case parsing (added/deleted/changed) + implementation focus.
4. **M4 — Comment, persist, submit:** inline draft comments, localStorage draft + recovery,
   materialize as a single GitHub review.
5. **M5 — Extension:** MV3 packaging, isolated-world load, `chrome.storage` token, manifest
   update channel.
