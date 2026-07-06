# BL-019 — Chrome Web Store auto-publish

- **Milestone:** Tooling
- **Depends on:** BL-014, BL-017
- **Constitution:** Serves principle 5 (the extension's real update channel — the Web
  Store — is fed automatically and consistently on every release, MVP.md §5.3). Strains
  none.

## Summary

Each release automatically uploads the extension zip to the Chrome Web Store and submits
it for review. Installed users then receive the update through Chrome's own mechanism —
the store is the extension's production update path (MV3 forbids remote code, so the
bundle always ships inside the extension).

## Scope

- A publish job chained onto the BL-017 release workflow: upload the release's extension
  zip via the Chrome Web Store API and submit for review.
- Credentials as repo secrets: `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`,
  `CWS_EXTENSION_ID`.
- Surface the store's response in the workflow output — a rejected or throttled upload
  must fail the job visibly, never silently.

## Out of scope

- The one-time manual bootstrap: creating the developer account ($5 fee), the first
  listing (privacy declarations for the `storage` permission and `github.com` /
  `api.github.com` host permissions), and minting the OAuth credentials. Document these
  as prerequisites in the item's PR.
- Store listing content (screenshots, description) beyond what the first submission set.

## Acceptance

- After a release, the new version appears in the Web Store dashboard as submitted for
  review, with **no manual steps** beyond the one-time bootstrap.
- Upload/submission failures fail the workflow with the store's reason in the log.
- The uploaded zip's manifest version equals the release tag (guaranteed upstream by
  BL-017's tag guard).

## Technical notes

- The zip must exclude `dist/channel/` (BL-015's publish surface is not part of the
  extension package).
- Web Store review latency is external and unbounded — the job's contract ends at
  "submitted", not "live".
