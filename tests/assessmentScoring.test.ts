import assert from 'node:assert/strict';
import test from 'node:test';
import { gradeMultipleChoiceAnswer } from '../shared/assessmentScoring.js';

test('assessment grading awards unanswered choices zero and rejects invalid option indexes', () => {
  assert.equal(gradeMultipleChoiceAnswer(null, 1, 3, 2), 0);
  assert.equal(gradeMultipleChoiceAnswer(undefined, 1, 3, 2), 0);
  assert.equal(gradeMultipleChoiceAnswer(1, 1, 3, 2), 2);
  assert.equal(gradeMultipleChoiceAnswer(0, 1, 3, 2), 0);
  assert.equal(gradeMultipleChoiceAnswer(3, 1, 3, 2), null);
});
