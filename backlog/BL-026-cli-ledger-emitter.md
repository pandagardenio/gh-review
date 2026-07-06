# BL-026 — CLI scaffolding + ledger emitter

- **Milestone:** CR2 (Control Room — data sources)
- **Depends on:** BL-021 (session-ledger schema)
- **Constitution (Control Room):** Serves principle 2 (this installs the rich tier)
  and principle 3 (append-only writes to a dedicated ledger branch; GitHub stays the
  system of record). Serves principle 4 — records flow repo-to-repo via git, no
  collection service. **Touches principle 1**: session records name a repo and an
  agent identity, never a person; the emitter must not record user logins or emails.

## Summary

The CLI enters the monorepo: `apps/cli` (`@triage/cli`, bin `triage`) with its first
face, the **ledger emitter** — tiny subcommands that a repo's Claude Code hooks invoke
to append `SessionRecord`/`HookEventRecord` JSONL (BL-021 schema) to the repo's
`triage/ledger` branch. Plus `triage install-hooks`, which wires those subcommands into
a repo's `.claude/settings.json` hook config.

## Scope

- CLI scaffolding: node entry shell, engine-style build (bundled, node 22, global
  `fetch`), thin per the entry-shell testing rule — logic lives in `@triage/fleet`.
- `triage emit session-start|session-end|heartbeat|hook-event` — read context from
  args/stdin (Claude Code hook payload), append one JSONL line.
- **Never touch the working tree or current branch**: write to `triage/ledger` via git
  plumbing against a detached ref (or a hidden worktree), commit + push append-only;
  never force-push.
- **Offline/failure tolerance**: if the push fails, queue the record under `.git/` and
  flush on the next emit — an emitter error must never break the user's session
  (hooks exit 0 on emitter failure, loudly but non-blocking).
- `triage install-hooks`: adds SessionStart/Stop and PostToolUse(hook-block) entries;
  idempotent; prints what it changed.

## Out of scope (deferred)

- Reading the ledger (BL-027) and all cockpit subcommands (BL-028).
- Emitters for non-Claude-Code harnesses (the schema is harness-agnostic; adapters
  can come later).
- Ledger compaction/rotation — note the growth concern, solve when real.

## Acceptance

- `session-start` + `session-end` in a scratch repo produce two schema-valid JSONL
  lines on `triage/ledger`, and `git status` on the working branch is untouched.
- A push failure (simulated offline) queues locally, exits 0, and the next emit
  flushes the queue — no record lost, no session blocked.
- `install-hooks` twice yields the same config as once.
- Records contain agent identity (`claude-code`) and repo — a test asserts no login,
  email, or hostname fields.

## Technical notes

- Active-session detection (BL-027) relies on `heartbeat` — throttle to at most one
  per few minutes via a timestamp file, so PostToolUse traffic doesn't spam commits.
- Concurrent sessions on one repo will race on the ledger push; retry with
  fetch-and-reapply (append-only makes this a trivial rebase).
