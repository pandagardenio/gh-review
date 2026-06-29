import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { diffAnchorHref, diffAnchorId } from './anchor.js';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

describe('diffAnchorId', () => {
  it('matches GitHub’s diff-<sha256(path)> hex format', async () => {
    const path = 'src/components/Button.tsx';
    expect(await diffAnchorId(path)).toBe(`diff-${sha256Hex(path)}`);
  });

  it('is deterministic and path-specific', async () => {
    expect(await diffAnchorId('a.ts')).toBe(await diffAnchorId('a.ts'));
    expect(await diffAnchorId('a.ts')).not.toBe(await diffAnchorId('b.ts'));
  });

  it('produces a 64-hex-char digest', async () => {
    const id = await diffAnchorId('x');
    expect(id).toMatch(/^diff-[0-9a-f]{64}$/);
  });
});

describe('diffAnchorHref', () => {
  it('prefixes the id with #', async () => {
    expect(await diffAnchorHref('a.ts')).toBe(`#${await diffAnchorId('a.ts')}`);
  });
});
