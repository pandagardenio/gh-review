# BL-013 — Bookmarklet packaging (self-contained)

- **Milestone:** M5 (delivery; can land any time after BL-001)
- **Depends on:** BL-001
- **Constitution:** Serves principle 6 (local-first, no backend) and principle 5 (the
  self-contained constraint is a validated environment fact, not a preference). Strains
  none.

## Summary

Ship the review engine as a **single self-contained bundle inlined in the `javascript:`
URL** — no remote loading (MVP.md §5.1).

## Scope

- Build target that inlines the full engine + UI into one `javascript:` bookmarklet.
- Token storage uses the **localStorage** implementation of the BL-001 interface, shipped
  with a **clear warning** about page-readability and minimal-scope guidance (MVP.md §7).
- Panel **displays its version**; updating means re-installing the bookmarklet (MVP.md
  §5.1).

## Out of scope

- Any remote/CDN loader on github.com — **impossible and forbidden** by CSP (MVP.md §5.2).
- `chrome.storage` token (that's the extension, BL-014).

## Acceptance

- The bookmarklet runs the full review flow on a real PR with **no remote fetch of code**.
- The displayed version matches the built bundle.
- Token-storage warning is visible where the token is entered.

## Technical notes

- The bookmarklet's `javascript:` execution is **CSP-exempt**, which is the only reason
  inlined code runs on github.com (MVP.md §5.1, §5.2). Do **not** wire the CDN/manifest
  channel (BL-015) to this target.
