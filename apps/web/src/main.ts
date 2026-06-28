import { engineSmoke } from '@triage/engine';

// Placeholder web app entry. Confirms the web target consumes the shared engine;
// the real UI is built later (MVP.md).
async function main(): Promise<void> {
  const app = document.querySelector('#app');
  if (!app) return;
  app.textContent = await engineSmoke();
}

void main();
