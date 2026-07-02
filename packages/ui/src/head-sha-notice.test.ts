import { describe, expect, it, vi } from 'vitest';
import { createHeadShaNotice } from './head-sha-notice.js';

describe('createHeadShaNotice', () => {
  it('shows short SHAs and a non-destructive message', () => {
    const node = createHeadShaNotice('abcdef1234', '9876543210', {
      onKeep: vi.fn(),
      onDiscard: vi.fn(),
    });
    const text = node.querySelector('.triage-headsha-notice__text')?.textContent ?? '';
    expect(text).toContain('abcdef1'); // short saved
    expect(text).toContain('9876543'); // short current
    expect(text).toContain('kept'); // reassures work is not dropped
  });

  it('wires keep and discard actions', () => {
    const onKeep = vi.fn();
    const onDiscard = vi.fn();
    const node = createHeadShaNotice('a', 'b', { onKeep, onDiscard });
    (node.querySelector('.triage-headsha-notice__keep') as HTMLButtonElement).click();
    (node.querySelector('.triage-headsha-notice__discard') as HTMLButtonElement).click();
    expect(onKeep).toHaveBeenCalledOnce();
    expect(onDiscard).toHaveBeenCalledOnce();
  });
});
