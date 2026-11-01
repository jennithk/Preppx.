import assert from 'node:assert/strict';
import test from 'node:test';
import { getCourseNodeLabel, hasValidParentType, isValidCourseNodeTree, orderCourseNodes, type CourseNodeSummary } from '../shared/courseNodes.js';
import { isSupportedSubject, SUPPORTED_SUBJECTS } from '../shared/subjects.js';

const courseId = 'course-1';
const sequence: CourseNodeSummary[] = [
  { id: 'subject', course_id: courseId, parent_id: null, node_type: 'subject', title: 'Coding' },
  { id: 'unit', course_id: courseId, parent_id: 'subject', node_type: 'unit', title: 'Fundamentals' },
  { id: 'topic', course_id: courseId, parent_id: 'unit', node_type: 'topic', title: 'Variables' },
  { id: 'lesson', course_id: courseId, parent_id: 'topic', node_type: 'lesson', title: 'Data types' },
];

test('PREPPX subjects are restricted to the supported catalog', () => {
  assert.deepEqual(SUPPORTED_SUBJECTS, ['Coding', 'Aptitude', 'Logical Reasoning']);
  assert.equal(isSupportedSubject('Aptitude'), true);
  assert.equal(isSupportedSubject('coding'), false);
  assert.equal(isSupportedSubject('Other'), false);
});

test('course nodes accept the intended subject-unit-topic-lesson hierarchy', () => {
  assert.equal(isValidCourseNodeTree(sequence), true);
  assert.equal(hasValidParentType('unit', 'subject'), true);
  assert.equal(hasValidParentType('topic', 'unit'), true);
  assert.equal(hasValidParentType('lesson', 'topic'), true);
  assert.equal(getCourseNodeLabel(sequence[3], sequence), 'Coding > Fundamentals > Variables > Data types');
  assert.deepEqual(orderCourseNodes([...sequence].reverse()).map(({ node, depth }) => [node.id, depth]), [
    ['subject', 0], ['unit', 1], ['topic', 2], ['lesson', 3],
  ]);
});

test('course nodes reject invalid parent types, cross-course links, missing parents, and cycles', () => {
  assert.equal(isValidCourseNodeTree([...sequence, { ...sequence[2], id: 'bad', parent_id: 'lesson' }]), false);
  assert.equal(isValidCourseNodeTree([{ ...sequence[1], course_id: 'another-course' }]), false);
  assert.equal(isValidCourseNodeTree([{ ...sequence[1], parent_id: 'missing' }]), false);
  assert.equal(isValidCourseNodeTree([
    ...sequence,
    { ...sequence[0], id: 'duplicate-subject' },
  ]), false);
  assert.equal(isValidCourseNodeTree([
    sequence[0],
    { ...sequence[1], id: 'root-unit', parent_id: null },
  ]), false);
  assert.equal(isValidCourseNodeTree([
    { ...sequence[2], parent_id: 'lesson' },
    { ...sequence[3], parent_id: 'topic' },
  ]), false);
});
