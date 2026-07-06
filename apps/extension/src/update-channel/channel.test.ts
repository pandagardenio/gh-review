import { describe, expect, it } from 'vitest';
import {
  BUNDLE_CACHE_CONTROL,
  createChannelManifest,
  hashedBundleName,
  MANIFEST_CACHE_CONTROL,
  parseChannelManifest,
  serializeChannelManifest,
} from './channel.js';

const HASH = 'ab34ef1290cd5678ab34ef1290cd5678ab34ef1290cd5678ab34ef1290cd5678';

describe('update channel manifest', () => {
  it('names the bundle by a prefix of its content hash', () => {
    expect(hashedBundleName(HASH)).toBe('triage-ab34ef1290cd5678.js');
  });

  it('lowercases the hash so the filename is stable across digest casings', () => {
    expect(hashedBundleName(HASH.toUpperCase())).toBe('triage-ab34ef1290cd5678.js');
  });

  it('rejects anything that is not a full SHA-256 digest', () => {
    expect(() => hashedBundleName('ab34ef')).toThrow(/SHA-256/);
    expect(() => hashedBundleName(`${HASH.slice(0, 63)}z`)).toThrow(/SHA-256/);
  });

  it('round-trips create → serialize → parse', () => {
    const manifest = createChannelManifest('1.2.3', HASH);
    expect(parseChannelManifest(serializeChannelManifest(manifest))).toEqual({
      schema: 1,
      version: '1.2.3',
      bundle: 'triage-ab34ef1290cd5678.js',
    });
  });

  it('rejects an empty version at publish time', () => {
    expect(() => createChannelManifest('  ', HASH)).toThrow(/version/);
  });

  it('parse names the defect: invalid JSON', () => {
    expect(() => parseChannelManifest('{nope')).toThrow(/not valid JSON/);
  });

  it('parse names the defect: non-object payloads', () => {
    expect(() => parseChannelManifest('null')).toThrow(/JSON object/);
    expect(() => parseChannelManifest('"triage.js"')).toThrow(/JSON object/);
  });

  it('parse names the defect: unsupported schema', () => {
    const text = JSON.stringify({ schema: 2, version: '1.0.0', bundle: 'triage-a.js' });
    expect(() => parseChannelManifest(text)).toThrow(/schema 2 is not supported/);
  });

  it('parse names the defect: missing version', () => {
    const text = JSON.stringify({ schema: 1, bundle: 'triage-a.js' });
    expect(() => parseChannelManifest(text)).toThrow(/missing a version/);
  });

  it('parse rejects bundle names that could escape the channel directory', () => {
    for (const bundle of ['../evil.js', 'a/b.js', 'https://evil.example/x.js', 'triage.css']) {
      const text = JSON.stringify({ schema: 1, version: '1.0.0', bundle });
      expect(() => parseChannelManifest(text)).toThrow(/plain \.js filename/);
    }
  });

  it('pins the validated cache policy (MVP.md §5.2)', () => {
    expect(MANIFEST_CACHE_CONTROL).toBe('no-store');
    expect(BUNDLE_CACHE_CONTROL).toBe('public, max-age=31536000, immutable');
  });
});
