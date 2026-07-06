# Constitution

This document is the product's north star. Every decision — feature, scope, design,
or technical — must be justifiable against it. When something here conflicts with a
convenient implementation, this file wins. Keep it short; if it grows past a page,
we are putting policy where it doesn't belong.

> **Working name:** Triage. (Placeholder — rename freely; it changes nothing here.)

## What this is

Triage is a browser plugin that provides an alternative pull-request **review flow built
for the agentic era** — where most of the change in a PR was written by an agent, not a
person. It runs on top of GitHub; it is not a new platform.

## The problem we exist to solve

In an agentic workflow, code is produced faster than humans can read it. Writing changes
is no longer the bottleneck — **human escalation** is: deciding what a person must
actually look at, and reviewing those things accurately.

GitHub's review UI treats every file as equally worth attention and orders them
alphabetically. That is the wrong default when a machine wrote the diff: it buries the
few high-risk, intent-bearing changes — the harness, configuration, CI, dependencies,
and tests — under a large volume of low-risk generated code.

## First principle — the test every decision must pass

> **Does this reduce human escalation while preserving review accuracy where it matters?**

Both halves are required, and neither alone is sufficient:

- **Reducing escalation alone is failure.** A tool that speeds up review by nudging
  people toward rubber-stamping is worse than no tool.
- **Accuracy everywhere is also failure.** Asking a human to read every line of
  machine-authored code is the exact problem we are trying to remove.

The product's single job is to **move human attention toward where risk and intent
concentrate, and away from where they don't — without ever hiding the difference.**

## Derived principles

1. **Attention is the scarce resource.** Spend it on changes that carry intent or risk
   (dependencies, harness, config, CI, tests), not on generated leaf code. Triage by
   intent and risk — never by file order or diff size.
2. **De-emphasize, never hide.** Nothing is ever removed from review, only reordered or
   collapsed. The reviewer can always reach everything. We change the default, not the
   ceiling.
3. **Augment, don't replace.** Live inside GitHub's trust primitives — comments,
   approvals, requested changes. We add a lens. We never become a parallel source of
   truth a team must trust *instead of* GitHub.
4. **The reviewer stays accountable.** The tool never approves, never auto-resolves,
   never judges whether code is correct on the human's behalf. It organizes; the person
   decides.
5. **Robustness over cleverness — this touches production review.** Degrade gracefully
   and never silently mislead. A confident-but-wrong output during review is the worst
   failure mode we have. (We have already been bitten once: a "large PR" error that was
   really a CSP-blocked fetch.)
6. **Local-first and user-owned.** In-progress review state and credentials belong to the
   reviewer's browser, not a server. The product works with no backend of our own.

## Non-goals

- Not a CI gate, a merge bot, or anything that blocks the pipeline.
- Not an AI that decides whether code is good or correct.
- Not a replacement for GitHub, and not a multi-tool dashboard.
- Not a reviewer-metrics or team-analytics product.

These non-goals bind **Triage, the review plugin**. The repo also hosts a sibling
product — the **Control Room**, a fleet cockpit for coding agents — governed by its own
[`CONTROL-ROOM-CONSTITUTION.md`](./CONTROL-ROOM-CONSTITUTION.md), whose hard line
("measure machines and harnesses, never people") is what keeps it from becoming the
dashboard/analytics product forsworn above. Nothing in this file is weakened by it.

## A note on the autoreview action (a bounded carve-out)

The repo also ships an **opt-in GitHub Action** (BL-016) that auto-approves a pull
request when nothing review-required changed. Taken literally this strains
**principle 4** ("the tool never approves") and the non-goal "not a CI gate." We
allow it under tight limits, and only as a *separate surface* — the browser plugin
itself still never approves:

- **It approves only the null case.** Approval fires solely when a PR touches *no*
  intent/risk-bearing category (dependencies, harness, CI, config, tests). Anything
  that carries intent or risk still routes to a human — the action never judges
  whether code is *correct*, only whether anything a human must see is present.
- **It is opt-in and reversible.** A team enables it; `mode: never` disables
  auto-approval entirely. The relevance line and policy are configurable.
- **It augments, never replaces (principle 3).** It speaks through GitHub's own
  review primitives. "Human review required" is a neutral comment, never a block;
  the *absence* of an approval is what holds the PR — enforced by branch protection,
  not by us.
- **It never silently misleads (principle 5).** It states its reasoning, is
  idempotent, and dismisses its own stale approval the moment a PR gains
  review-required changes.

This is the line: automating the *null case* is fair game; deciding *correctness*
on a human's behalf is not, and never will be.

## How to use this file

When proposing a change, state which principle it serves and which (if any) it strains.
A change that strains principle 2 or 4 needs an explicit, written justification — those
two are where this product quietly turns into something we said it would never be.
