import { describe, expect, it } from 'vitest';
import * as engine from './index.js';

// The barrel is pure re-exports; importing it executes every `export … from` line
// so a new export never becomes the one uncovered "new line" that fails Sonar's
// new-code coverage gate. This also asserts the public surface stays wired up.
describe('@triage/engine public API', () => {
  it('exports the diff loading + model surface', () => {
    for (const name of ['loadPullRequestDiff', 'parseUnifiedDiff', 'parseHunks', 'DiffLoadError']) {
      expect(Object.hasOwn(engine, name)).toBe(true);
    }
  });

  it('exports categorization, deps, tests, and review helpers', () => {
    for (const name of [
      'categorize',
      'CATEGORY_RULES',
      'parseDependencyChanges',
      'parseTestCases',
      'implementationTarget',
      'createReviewState',
      'setFileViewed',
      'overallProgress',
      'createCommentDraft',
      'setComment',
      'saveDraft',
      'loadDraft',
      'resolveDraftOnOpen',
      'draftKey',
      'InMemoryDraftStorage',
      'InMemoryTokenStore',
    ]) {
      expect(Object.hasOwn(engine, name)).toBe(true);
    }
  });
});
