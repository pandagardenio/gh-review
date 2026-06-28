/**
 * GitHub native file anchor (BL-005 / MVP.md §6).
 *
 * GitHub anchors a file in the diff view at `#diff-<sha256(path)>` (hex). We jump
 * to a file by linking to that fragment — setting `location.hash` scrolls the
 * virtualized native view, so we never scrape its DOM. SHA-256 is computed with
 * Web Crypto (`crypto.subtle`), available in the page, the extension, and tests.
 */

/** Resolve the `diff-<sha256hex>` id GitHub uses to anchor `path` in its view. */
export async function diffAnchorId(path: string): Promise<string> {
  const bytes = new TextEncoder().encode(path);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return `diff-${hex}`;
}

/** The full `#diff-…` href for `path`. */
export async function diffAnchorHref(path: string): Promise<string> {
  return `#${await diffAnchorId(path)}`;
}
