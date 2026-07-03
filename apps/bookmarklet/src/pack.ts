/**
 * Bookmarklet packaging (BL-013): wrap the self-contained IIFE bundle into a
 * single `javascript:` URL. Its execution is CSP-exempt — the only reason inlined
 * code runs on github.com (MVP.md §5.1). No remote/CDN loader is ever wired to
 * this target (that is the extension's channel, BL-015 — forbidden here).
 */

/** Wrap built IIFE `source` into a `javascript:` URL suitable for a bookmark. */
export function packBookmarklet(source: string): string {
  // Trailing `void 0` stops the bookmarklet from replacing the page with the
  // expression's return value; encode so the URL is a single safe token.
  return `javascript:${encodeURIComponent(`${source.trim()};void 0`)}`;
}

/** A self-contained install page: a draggable link plus the version shown. */
export function installPage(bookmarkletUrl: string, version: string): string {
  const safeUrl = bookmarkletUrl.replaceAll('"', '&quot;');
  return [
    '<!doctype html>',
    '<meta charset="utf-8">',
    `<title>Install Triage ${version}</title>`,
    '<main style="font-family:system-ui;max-width:40rem;margin:3rem auto;line-height:1.5">',
    `<h1>Triage <small>${version}</small></h1>`,
    '<p>Drag this link to your bookmarks bar, then click it on any GitHub pull request:</p>',
    `<p><a href="${safeUrl}">Triage ${version}</a></p>`,
    '<p>Self-contained — it loads no remote code. Updating means re-installing this link.</p>',
    '</main>',
  ].join('\n');
}
