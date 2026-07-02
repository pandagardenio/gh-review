import { InMemoryTokenStore } from '@triage/engine';
import { describe, expect, it, vi } from 'vitest';
import { createTokenEntry } from './token-entry.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createTokenEntry', () => {
  it('shows a visible localStorage warning where the token is entered', () => {
    const node = createTokenEntry({ tokens: new InMemoryTokenStore() });
    const warning = node.querySelector('.triage-token__warning')?.textContent ?? '';
    expect(warning).toMatch(/localStorage/i);
    expect(warning).toMatch(/scope/i);
    // The input hides the token.
    expect(node.querySelector('.triage-token__input')?.getAttribute('type')).toBe('password');
  });

  it('saves a trimmed token and notifies onSaved', async () => {
    const tokens = new InMemoryTokenStore();
    const onSaved = vi.fn();
    const node = createTokenEntry({ tokens, onSaved });
    (node.querySelector('.triage-token__input') as HTMLInputElement).value = '  ghp_tok  ';
    (node.querySelector('.triage-token__save') as HTMLButtonElement).click();
    await flush();
    expect(await tokens.get()).toBe('ghp_tok');
    expect(onSaved).toHaveBeenCalledWith('ghp_tok');
  });

  it('refuses an empty token', async () => {
    const tokens = new InMemoryTokenStore();
    const node = createTokenEntry({ tokens });
    (node.querySelector('.triage-token__save') as HTMLButtonElement).click();
    await flush();
    expect(await tokens.get()).toBeNull();
    expect(node.querySelector('.triage-token__status')?.textContent).toContain('Enter a token');
  });
});
