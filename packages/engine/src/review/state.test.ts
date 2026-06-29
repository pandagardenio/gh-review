import { describe, expect, it } from 'vitest';
import type { FileCategory } from '../categorize/model.js';
import type { DiffFile } from '../diff/model.js';
import {
  createReviewState,
  isFileViewed,
  overallProgress,
  sectionProgress,
  setFilesViewed,
  setFileViewed,
} from './state.js';

const file = (path: string): DiffFile => ({
  path,
  change: 'modified',
  additions: 1,
  deletions: 0,
  isBinary: false,
  patch: '@@',
});

const category = (id: FileCategory['id'], label: string, paths: string[]): FileCategory => ({
  id,
  label,
  files: paths.map(file),
  fileCount: paths.length,
  additions: paths.length,
  deletions: 0,
});

describe('review state', () => {
  it('starts empty', () => {
    expect(createReviewState().viewedPaths).toEqual([]);
  });

  it('seeds from a restored value, deduped and sorted', () => {
    expect(createReviewState({ viewedPaths: ['b.ts', 'a.ts', 'b.ts'] }).viewedPaths).toEqual([
      'a.ts',
      'b.ts',
    ]);
  });

  it('marks a file viewed and unviewed immutably', () => {
    const s0 = createReviewState();
    const s1 = setFileViewed(s0, 'a.ts', true);
    expect(isFileViewed(s1, 'a.ts')).toBe(true);
    expect(isFileViewed(s0, 'a.ts')).toBe(false); // s0 unchanged
    const s2 = setFileViewed(s1, 'a.ts', false);
    expect(isFileViewed(s2, 'a.ts')).toBe(false);
  });

  it('marks a whole section viewed in one update', () => {
    const s = setFilesViewed(createReviewState(), ['a.ts', 'b.ts'], true);
    expect(s.viewedPaths).toEqual(['a.ts', 'b.ts']);
  });

  it('computes section progress', () => {
    const config = category('config', 'Config', ['tsconfig.json', 'biome.json', 'vite.config.ts']);
    const state = setFilesViewed(createReviewState(), ['tsconfig.json', 'biome.json'], true);
    expect(sectionProgress(config, state)).toEqual({
      id: 'config',
      label: 'Config',
      viewed: 2,
      total: 3,
    });
  });

  it('computes overall progress across sections', () => {
    const cats = [
      category('config', 'Config', ['tsconfig.json']),
      category('code', 'Code', ['a.ts', 'b.ts', 'c.ts']),
    ];
    const state = setFilesViewed(createReviewState(), ['tsconfig.json', 'a.ts'], true);
    expect(overallProgress(cats, state)).toEqual({ viewed: 2, total: 4 });
  });

  it('ignores stale viewed paths not present in the diff', () => {
    const cats = [category('code', 'Code', ['a.ts'])];
    const state = createReviewState({ viewedPaths: ['a.ts', 'deleted-elsewhere.ts'] });
    expect(overallProgress(cats, state)).toEqual({ viewed: 1, total: 1 });
  });
});
