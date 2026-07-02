import { describe, expect, it } from 'vitest';
import * as ui from './index.js';

// Importing the barrel executes every re-export line, so a newly added export is
// never the lone uncovered "new line" that trips Sonar's new-code coverage gate.
describe('@triage/ui public API', () => {
  it('exports the DOM helper and view builders', () => {
    for (const name of [
      'el',
      'diffAnchorHref',
      'dependencyRows',
      'renderFileDiff',
      'lazyFileDiff',
      'createTriagePanel',
      'createReviewFlow',
      'createTestFileView',
      'createImplementationFocus',
      'createCommentableDiff',
    ]) {
      expect(ui[name as keyof typeof ui]).toBeDefined();
    }
  });
});
