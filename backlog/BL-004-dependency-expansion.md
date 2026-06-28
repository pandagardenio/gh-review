# BL-004 — `package.json` dependency expansion

- **Milestone:** M1
- **Depends on:** BL-002, BL-003
- **Constitution:** Serves principle 1 (dependencies carry intent/risk — surface what
  changed without making the reviewer read a raw JSON diff). Strains none.

## Summary

For `package.json` files in the **Dependencies** section, parse the patch and show the
semantic change inline: **added / bumped / removed** dependencies.

## Scope

- From a `package.json` patch, compute per-dependency deltas across `dependencies`,
  `devDependencies`, `peerDependencies`, `optionalDependencies`:
  - **added** (new key), **removed** (deleted key), **bumped** (version changed: old → new).
- Expose this as engine data; render inline within the Dependencies section (BL-005).

## Out of scope

- Lockfile expansion and non-npm manifests — buckets exist (BL-003), but inline expansion
  is `package.json`-only for MVP (MVP.md §3.1, §4.1).
- Vulnerability/freshness judgments — we organize, we don't judge (Constitution §4).

## Acceptance

- For a `package.json` with mixed changes, added/bumped/removed are listed correctly with
  old→new versions for bumps.
- A `package.json` change that touches non-dependency fields only (e.g. `scripts`) renders
  gracefully (no phantom dependency rows).

## Technical notes

- Parse from the **patch**, not by re-fetching file contents, to stay within the loaded
  diff model (BL-002).
