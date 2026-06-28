# BL-009 — Implementation focus (jump to file under test)

- **Milestone:** M3
- **Depends on:** BL-008
- **Constitution:** Serves principle 1 (move attention from the test to the implementation
  it exercises). Strains none.

## Summary

> *...and be able to focus on the implementation.*

From a test file, offer a jump to the file under test using a sibling heuristic (MVP.md
§4.3).

## Scope

- Resolve the sibling implementation path from a test path:
  - `x.spec.ts` → `x.ts`
  - `__tests__/x.test.ts` → `../x.ts`
  - (cover the common `.test.`/`.spec.` and `__tests__/` shapes).
- If the resolved file **is in the PR**, jump to its Triage diff (BL-007).
- If it is **not in the PR**, open it on the PR's head branch (native GitHub).

## Out of scope

- Symbol-level "go to the exact function under test" — explicitly deferred (MVP.md §2).

## Acceptance (MVP.md §4.3)

- The implementation jump resolves to the sibling when one exists.
- In-PR target opens the Triage diff; out-of-PR target opens on the head branch.

## Technical notes

- Heuristic resolution only; when no sibling is found, surface that plainly rather than
  guessing a wrong target (principle 5).
