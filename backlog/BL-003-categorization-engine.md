# BL-003 — File categorization engine

- **Milestone:** M1
- **Depends on:** BL-001
- **Constitution:** Serves principle 1 (attention is scarce — triage by intent and risk,
  never by file order or diff size). This is the literal mechanism of the first principle.
  Strains none.

## Summary

Bucket changed files into categories by path, **first match wins, top to bottom**. The
order *is* the review order (MVP.md §3).

## Scope

- One editable, ordered rule array producing these buckets, in this order:
  1. **Dependencies** — `package.json`, lockfiles, other manifests.
  2. **Harness** — `CLAUDE.md`, `.claude/`, `.mcp.json`, `AGENTS.md`, cursor/copilot/
     windsurf/cline rules.
  3. **CI** — `.github/workflows`, `.github/actions`, CircleCI, GitLab CI, etc.
  4. **Config** — tsconfig, eslint/prettier/biome, bundler/framework/test-runner config,
     `.storybook/`, Dockerfiles, env files.
  5. **Tests** — `*.test.*`, `*.spec.*`, `*.stories.*`, `__tests__`, e2e, snapshots,
     fixtures.
  6. **Docs** — `*.md(x)`, `docs/`, README/CHANGELOG/CONTRIBUTING.
  7. **Code** — everything else.
- Pure function: `(files) -> orderedCategories[]`, each carrying its files and counts.

## Out of scope

- Rendering the sections (BL-005), dependency expansion (BL-004).

## Acceptance

- Every changed file lands in exactly one bucket; **first match wins** is observable
  (e.g. a `.github/workflows/*.test.yml`-style path resolves by the earlier rule).
- The rule list is a single array, editable in one place, documented as **product
  surface** — adding/moving a rule is a product decision measured against the constitution,
  not a throwaway tweak (MVP.md §3).
- Unit tests cover each category and at least one first-match-wins tie-break.

## Technical notes

- "Code collapsed by default" is a UI concern (BL-005); the engine only orders and groups.
