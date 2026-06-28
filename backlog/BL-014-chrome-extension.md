# BL-014 — Chrome MV3 extension

- **Milestone:** M5
- **Depends on:** BL-001
- **Constitution:** Serves principle 6 (user-owned credentials, no backend) and principle 5
  (the extension is the real fix for the bookmarklet's token exposure). Strains none.

## Summary

Package the same review engine as a Chrome MV3 extension whose content script runs in the
**isolated world**, with the token stored outside page-reachable storage (MVP.md §5.3).

## Scope

- MV3 packaging; content script loads the full engine in the extension's isolated world
  (not subject to the page CSP).
- Token stored in **`chrome.storage`** via the BL-001 storage interface — isolated from
  page scripts (fixes the bookmarklet's localStorage exposure).
- `host_permissions` for `api.github.com` so API calls bypass the page's `connect-src`.
- The bundle ships with the extension (MV3 forbids remote code).

## Out of scope

- The manifest/CDN update channel wiring (BL-015).
- Any engine/feature behavior change — the flow must be **identical** to the bookmarklet.

## Acceptance (MVP.md §5.3)

- The **same** review flow runs identically when launched from the extension and the
  bookmarklet.
- The extension stores its token **outside page-reachable storage** (`chrome.storage`).
- API calls to `api.github.com` succeed via `host_permissions`.

## Technical notes

- Engine code must already be UI/host-agnostic (BL-001) so only the entry shell and storage
  impl differ from the bookmarklet.
