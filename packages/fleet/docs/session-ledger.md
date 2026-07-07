# Session-ledger schema (v1)

The rich tier's wire format: how a repo's coding-agent activity is recorded so the
Control Room can read sessions, spend, and hook-friction without a backend of our own.

This is the contract between the **emitter** (BL-026, which appends) and the **ledger
source** (BL-027, which reads). It is versioned from day one; the parser
([`../src/ledger/schema.ts`](../src/ledger/schema.ts)) tolerates unknown fields so a
newer emitter never breaks an older reader.

## Where it lives

An append-only, newline-delimited JSON (JSONL) file on a dedicated
**`triage/ledger`** branch of the repo being measured — never on a working branch, and
never in the working tree. GitHub is the system of record
(CONTROL-ROOM-CONSTITUTION.md principle 3); the emitter only ever appends.

A repo **without** this branch is baseline-tier: the source reports `sessions: null`
(unknown / not instrumented), never `[]` (CONTROL-ROOM-CONSTITUTION.md principle 2).

## Line format

Each line is a JSON object with two envelope fields plus the record's own fields:

| Field  | Type              | Meaning                                        |
| ------ | ----------------- | ---------------------------------------------- |
| `v`    | number            | Schema version. This document describes `v: 1`. |
| `type` | `session` \| `hook` | Which record kind the rest of the line carries. |

### `type: "session"` — a `SessionRecord` snapshot

Sessions are recorded as **append-only snapshots that share an `id`**: one at start,
zero or more at each heartbeat, one at end. The reader folds a session's lines to the
**latest** snapshot per `id` (BL-027). Fields: `id`, `repo`, `agent`, `status`
(`running` | `success` | `failure` | `escalated`), `startedAt`, `endedAt`,
`heartbeatAt`, `stage`, `branch`, `pr`, `failureReason`, and a nested `usage`
(`tokensIn`, `tokensOut`, `wallSeconds`, `toolCalls`).

The only identity a record carries is `agent` — the harness/agent name, e.g.
`claude-code`. **No login, email, or hostname of a person is ever written**
(CONTROL-ROOM-CONSTITUTION.md principle 1).

### `type: "hook"` — a `HookEventRecord`

One hook firing. Fields: `id`, `sessionId`, `repo`, `hook` (e.g. `PreToolUse`, `Stop`),
`ruleId` (the forbidden-pattern / rule id, or `null`), `outcome`
(`allow` | `block` | `warn`), `at`.

## Deriving active sessions (BL-027)

A session is **active** when its latest snapshot is `running` and its `heartbeatAt` is
within the freshness window (default ~10 min). `running` with a heartbeat older than the
window is **stale** — a likely crash — and is rendered distinctly from both active and
ended, so an "N active" count never silently includes ghosts. The freshness window and
the emitter's heartbeat throttle (BL-026) are coupled: change them together.

## Compatibility & robustness

- **Unknown fields are ignored** — a newer emitter can add fields without breaking
  older readers.
- **Malformed lines throw `LedgerParseError`**; the reader skips-and-counts them
  (BL-027) rather than failing a whole repo on one bad record.
- A **future `v`** still parses for all `v: 1` fields; a breaking change bumps `v` and
  is documented here alongside the migration.
