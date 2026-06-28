import { engineSmoke } from '@triage/engine';
import { el } from '@triage/ui';

/**
 * Content-script entry shell (BL-001 smoke).
 *
 * Proves the per-target shell wires the engine and the CSP-safe UI together. The
 * real extension (content-script injection, manifest, token store backed by
 * `chrome.storage`) lands in BL-014; this only confirms the bundle runs.
 */
async function main(): Promise<void> {
  const status = await engineSmoke();
  // Built the CSP-safe way: createElement + textContent, no innerHTML.
  const badge = el('div', { text: status, attrs: { 'data-triage': 'smoke' } });
  document.body.appendChild(badge);
  console.info('[triage]', status);
}

void main();
