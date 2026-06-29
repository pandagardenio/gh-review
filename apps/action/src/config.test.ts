import { describe, expect, it } from 'vitest';
import { type FileReader, resolvePolicy } from './config.js';

const noFiles: FileReader = () => null;

describe('resolvePolicy', () => {
  it('defaults to mode auto with no config or inputs', () => {
    expect(resolvePolicy({}, noFiles)).toEqual({ mode: 'auto' });
  });

  it('reads a JSON config file', () => {
    const reader: FileReader = () => JSON.stringify({ mode: 'threshold', maxFiles: 5 });
    expect(resolvePolicy({ TRIAGE_CONFIG_FILE: 'cfg.json' }, reader)).toEqual({
      mode: 'threshold',
      maxFiles: 5,
    });
  });

  it('ignores a config file that does not exist', () => {
    expect(resolvePolicy({ TRIAGE_CONFIG_FILE: 'missing.json' }, noFiles)).toEqual({
      mode: 'auto',
    });
  });

  it('lets the mode input override the config file', () => {
    const reader: FileReader = () => JSON.stringify({ mode: 'auto' });
    expect(resolvePolicy({ TRIAGE_CONFIG_FILE: 'cfg.json', TRIAGE_MODE: 'never' }, reader)).toEqual(
      {
        mode: 'never',
      },
    );
  });

  it('builds a threshold policy from inputs', () => {
    expect(resolvePolicy({ TRIAGE_MODE: 'threshold', TRIAGE_MAX_FILES: '12' }, noFiles)).toEqual({
      mode: 'threshold',
      maxFiles: 12,
    });
  });

  it('treats a blank mode input as unset', () => {
    expect(resolvePolicy({ TRIAGE_MODE: '   ' }, noFiles)).toEqual({ mode: 'auto' });
  });

  it('throws on malformed JSON', () => {
    const reader: FileReader = () => '{ not json';
    expect(() => resolvePolicy({ TRIAGE_CONFIG_FILE: 'cfg.json' }, reader)).toThrow(
      /not valid JSON/,
    );
  });
});
