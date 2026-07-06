# Control Room Constitution

North star for the **Control Room** — the second product in this repo, a sibling of
Triage. Same discipline as [`CONSTITUTION.md`](./CONSTITUTION.md): every decision must
be justifiable against this file, it wins over convenience, and it stays under a page.

## What this is

A **cockpit for a fleet of repositories where coding agents write most of the code** —
built for the tech lead who must know whether the machinery works. Two surfaces over one
core: a CLI/TUI for the terminal and a web app (`apps/web`). Triage answers *"how do I
review this one agentic PR well?"*; the Control Room answers *"is the agent fleet
healthy, and where must a human step in?"*

## The problem we exist to solve

A team of 40 developers runs agents against dozens of repos. The signal a lead needs —
are sessions failing, is CI red for agent PRs, how much code is agent-authored, is a
project's harness helping or fighting — exists, but is scattered across commits, checks,
and terminals. Nobody can see the fleet.

## First principle — the test every decision must pass

> **Does this make the state of the agent fleet legible — without judging people, and
> without taking control?**

## Derived principles

1. **Measure machines and harnesses, never people.** No per-developer leaderboards, no
   reviewer speed stats, no human performance metrics. Aggregation keys are repo,
   harness, and agent identity — never a person. This is the hard line; crossing it
   turns the product into the thing both constitutions forswear.
2. **Tiered truth, never fabricated.** The baseline tier derives metrics from GitHub
   alone (commit trailers, branch prefixes, check runs) and works on any repo with zero
   setup. The rich tier (sessions, spend, harness friction) needs the ledger emitter
   installed in a repo's hooks. A missing tier renders as *unknown* — never estimated,
   interpolated, or silently blended into a score.
3. **GitHub is the system of record; we are read-mostly.** All state lives in GitHub:
   ledger branches, commits, checks, PRs. The cockpit writes nothing; the emitter
   appends only to its own ledger branch; policy edits travel as reviewed PRs.
4. **Local-first, no backend.** Reads happen client-side — browser or terminal — with
   the user's token. No server of ours, no telemetry collection service, no database.
5. **Observation is not control.** The cockpit never starts, stops, or steers an agent
   session, and never gates a pipeline. It informs the human, who acts through existing
   tools (Triage, GitHub, the terminal).

## Non-goals

- Not an agent orchestrator or job runner.
- Not a people-analytics or performance-review product.
- Not a metrics backend, APM, or observability platform.
- Not a replacement for CI dashboards — we read checks, we don't re-run them.

## Relation to Triage

Triage's constitution is untouched and still binds the review plugin; its non-goals
("not a multi-tool dashboard", "not a team-analytics product") describe *Triage*, not
this sibling. The two meet at one seam: the Control Room's Review pane surfaces PRs
awaiting a human and hands off into Triage. Shared engineering rules (CSP-safe DOM,
one-way dependencies, local-first token handling) apply to both.

## How to use this file

When proposing a Control Room change, state which principle it serves and which it
strains. Anything that strains principle 1 (people) or 5 (control) needs an explicit,
written justification — those two are where a cockpit quietly becomes a boss.
