# @triage/bookmarklet

The self-contained **`javascript:` bookmarklet** entry shell (BL-013). It inlines
`@triage/engine` + `@triage/ui` into one IIFE — no remote code — because that is
the only thing github.com's CSP permits (a `javascript:` URL is CSP-exempt,
MVP.md §5.1).

## Build

```bash
pnpm --filter @triage/bookmarklet build
```

Outputs to `dist/`:

- `bookmarklet.js` — the self-contained IIFE bundle.
- `bookmarklet.txt` — the packed `javascript:` URL (drag into your bookmarks bar).
- `install.html` — a page with a draggable install link and the build version.

## Use

Open `dist/install.html`, drag the **Triage** link to your bookmarks bar, then
click it on any GitHub pull request. Enter a GitHub token when prompted.

> The token is stored in the page's `localStorage` and is readable by any script
> on github.com. Use a **fine-grained token with the least scope** (read +
> pull-request write) and revoke it when done. The extension (BL-014) removes
> this exposure by storing the token in `chrome.storage`.

The panel shows its build **version**; updating means re-installing the
bookmarklet. No CDN/manifest update channel is wired here — that is the
extension's channel (BL-015) and is forbidden on github.com.
