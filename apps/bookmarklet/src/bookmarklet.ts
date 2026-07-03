/**
 * Bookmarklet entry shell (BL-013).
 *
 * A thin per-target shell: it injects the shared review panel
 * ({@link createReviewApp}) on a GitHub PR page, backed by the **localStorage**
 * token store. Everything is bundled self-contained (no remote code — CSP-exempt
 * only because it runs from a `javascript:` URL, MVP.md §5.1). The extension
 * (BL-014) mounts the *same* panel with a `chrome.storage` token store instead.
 *
 * Kept intentionally thin (the engine/ui packages hold the tested logic).
 */

import { createReviewApp, LocalStorageTokenStore } from '@triage/ui';
import { BOOKMARKLET_VERSION } from './version.js';

const PANEL_ID = 'triage-bookmarklet-panel';

function main(): void {
  document.getElementById(PANEL_ID)?.remove();
  const app = createReviewApp({
    tokens: new LocalStorageTokenStore(),
    version: BOOKMARKLET_VERSION,
  });
  app.id = PANEL_ID;
  document.body.appendChild(app);
}

main();
