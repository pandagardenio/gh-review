/**
 * MV3 content-script entry shell (BL-014).
 *
 * Runs in the extension's **isolated world** (not subject to the page CSP) and
 * injects the *same* review panel the bookmarklet mounts ({@link createReviewApp})
 * — the only difference is the token backend: `chrome.storage` instead of
 * `localStorage`, so the token stays out of page-reachable storage (MVP.md §5.3).
 * `api.github.com` calls succeed via the manifest's `host_permissions`.
 *
 * Thin by design: the engine/ui packages hold the tested logic.
 */

import { createReviewApp } from '@triage/ui';
import { ChromeStorageTokenStore } from './chrome-storage-token-store.js';
import { EXTENSION_VERSION } from './version.js';

const PANEL_ID = 'triage-extension-panel';

function main(): void {
  document.getElementById(PANEL_ID)?.remove();
  const app = createReviewApp({
    tokens: new ChromeStorageTokenStore(),
    version: EXTENSION_VERSION,
  });
  app.id = PANEL_ID;
  document.body.appendChild(app);
}

main();
