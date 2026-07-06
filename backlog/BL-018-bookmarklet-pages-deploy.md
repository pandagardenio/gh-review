# BL-018 — Bookmarklet install page auto-deploy (GitHub Pages)

- **Milestone:** Tooling
- **Depends on:** BL-013, BL-017
- **Constitution:** Serves principle 5 (a canonical, always-current install URL instead
  of hand-distributed files) and principle 6 (a static page; the bookmarklet stays
  self-contained and user-owned). Strains none.

## Summary

Each release automatically publishes the bookmarklet install page to GitHub Pages, so
there is one canonical URL that always serves the latest build. Updating the bookmarklet
means re-installing from that page (MVP.md §5.1) — the page being current is therefore
the bookmarklet's entire update story.

## Scope

- A Pages deploy job chained onto the BL-017 release workflow (`actions/deploy-pages`),
  publishing `apps/bookmarklet/dist/` (`install.html`, `bookmarklet.txt`).
- One-time repo setting: Pages source = GitHub Actions.

## Out of scope — hard constraint (MVP.md §5.2, validated)

- The page hosts the **self-contained** `javascript:` link only. Do **not** turn it into
  a remote loader for github.com — GitHub's CSP makes remote code impossible there; the
  update channel (BL-015/BL-020) is the extension's story, never the bookmarklet's.

## Acceptance

- After a release, the canonical Pages URL serves the new version's install page —
  version visible on the page — with **no manual steps**.
- The served page loads no remote code (view-source shows the inlined `javascript:` URL).

## Technical notes

- The install page is already fully self-contained (BL-013's `installPage()`); this item
  is pure delivery wiring.
