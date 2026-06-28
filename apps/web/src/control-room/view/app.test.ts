import { describe, expect, it } from 'vitest';
import { FixtureSource } from '../fixture-source.js';
import { mountControlRoom } from './app.js';

function tabButton(root: HTMLElement, label: string): HTMLButtonElement {
  const btn = [...root.querySelectorAll('button.cr-tab')].find((b) => b.textContent === label);
  if (!(btn instanceof HTMLButtonElement)) throw new Error(`no "${label}" tab`);
  return btn;
}

describe('mountControlRoom', () => {
  it('renders the Observe pane from fixture data by default', async () => {
    const root = document.createElement('div');
    await mountControlRoom(root, new FixtureSource());

    expect(root.querySelector('.cr-header')?.textContent).toContain('demo fixture');
    // Observe cards include the success-rate metric.
    expect(root.textContent).toContain('success rate');
    expect(root.querySelector('.cr-pipeline')).not.toBeNull();
  });

  it('switches panes when a tab is clicked', async () => {
    const root = document.createElement('div');
    await mountControlRoom(root, new FixtureSource());

    tabButton(root, 'review').click();
    expect(root.textContent).toContain('Awaiting review');
    expect(root.textContent).toContain('Review on GitHub');

    tabButton(root, 'configure').click();
    expect(root.textContent).toContain('Approval gates');
    // The raw policy.yml is shown read-only.
    expect(root.querySelector('pre.cr-raw')?.textContent).toContain('maxConcurrency');
  });

  it('marks the active tab', async () => {
    const root = document.createElement('div');
    await mountControlRoom(root, new FixtureSource());
    expect(tabButton(root, 'observe').classList.contains('cr-tab--active')).toBe(true);

    tabButton(root, 'review').click();
    expect(tabButton(root, 'review').classList.contains('cr-tab--active')).toBe(true);
    expect(tabButton(root, 'observe').classList.contains('cr-tab--active')).toBe(false);
  });
});
