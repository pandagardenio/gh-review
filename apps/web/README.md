# @triage/web — Control Room

A web cockpit for a [dark-factory](https://github.com/luisgrandegg/dark-factory) repo
— the *third thing* that sits between the factory (which manufactures work and
escalations) and Triage (which resolves the review escalation). Three panes, mapping
three verbs:

| Pane          | Verb      | Source of truth                                   |
| ------------- | --------- | ------------------------------------------------- |
| **Observe**   | Observe   | the `factory/ledger` branch — runs, spend, throughput, per-station health, failure clusters |
| **Configure** | Configure | `.factory/policy.yml` — budgets, concurrency, approval gates (read-only; edits go as a PR) |
| **Review**    | Review    | open PRs the factory won't seal — the hand-off into Triage |

It is **local-first with no backend of our own**: GitHub is the system of record, read
client-side with the user's token (the same model Triage uses). The control room never
writes — editing policy is a reviewed PR, landing a review happens in Triage.

## Data source

The cockpit reads a `FactorySource` (`src/control-room/source.ts`), not GitHub directly:

- **`FixtureSource`** — baked sample data; the default, so the app renders with zero
  config (and the views are testable headlessly).
- **`GitHubSource`** — a live repo's ledger / issues / PRs / policy over the REST API.

Point it at a repo with a URL param plus a token in `localStorage`:

```js
localStorage.setItem('control-room:token', 'ghp_…'); // a token with repo read scope
location.search = '?repo=owner/repo';                // optionally &tab=configure|review
```

## Commands

```sh
pnpm --filter @triage/web dev      # vite dev server
pnpm --filter @triage/web build    # static SPA into dist/
pnpm --filter @triage/web test     # vitest (jsdom)
```

## Status

v0 prototype (see the pivot discussion). Observe is the most complete pane; Configure is
read-only; Review deep-links out to GitHub/Triage rather than embedding the pane yet.
Extractable to its own repo when it graduates from a prototype.
