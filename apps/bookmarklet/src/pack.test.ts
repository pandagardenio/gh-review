import { describe, expect, it } from 'vitest';
import { installPage, packBookmarklet } from './pack.js';

describe('packBookmarklet', () => {
  it('produces a javascript: URL that decodes back to the source', () => {
    const url = packBookmarklet('(function(){doThing()})()');
    expect(url.startsWith('javascript:')).toBe(true);
    const decoded = decodeURIComponent(url.slice('javascript:'.length));
    expect(decoded).toBe('(function(){doThing()})();void 0');
  });

  it('encodes characters that would break a URL', () => {
    const url = packBookmarklet('a=" "&b=<c>');
    expect(url).not.toContain(' ');
    expect(url).not.toContain('<');
    expect(decodeURIComponent(url.slice('javascript:'.length))).toBe('a=" "&b=<c>;void 0');
  });
});

describe('installPage', () => {
  it('embeds the version and the bookmarklet link', () => {
    const html = installPage('javascript:void%200', '1.2.3');
    expect(html).toContain('Triage 1.2.3');
    expect(html).toContain('href="javascript:void%200"');
    expect(html).toContain('no remote code');
  });

  it('escapes quotes in the URL so the href attribute stays intact', () => {
    const html = installPage('javascript:"x"', '0.0.0');
    expect(html).toContain('href="javascript:&quot;x&quot;"');
  });
});
