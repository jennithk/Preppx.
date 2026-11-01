import { Router } from 'express';
import type { PoolClient } from 'pg';
import multer from 'multer';
import { z } from 'zod';
import { requireSameOrigin, requireStudent, requireStudentId } from '../auth.js';
import { pool } from '../db/pool.js';
import { asyncRoute, parseId } from '../http.js';
import { getMaterialDownloadUrl, materialUploadLimits, uploadLearningMaterial } from '../storage.js';
import { gradeMultipleChoiceAnswer } from '../../shared/assessmentScoring.js';

const uuid = z.string().uuid();
const answerInput = z.object({
  questionId: uuid,
  selectedOption: z.number().int().nonnegative().nullable().optional(),
  answerText: z.string().max(12_000).nullable().optional(),
}).strict();
const assignmentSubmissionInput = z.object({
  responseText: z.string().trim().max(12_000).default(''),
}).strict().refine((value) => value.responseText.length > 0, 'Write a response before submitting.');
const assignmentUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: materialUploadLimits.maxBytes, files: 1 } });

const LEVELS = [
  { level: 1, name: 'Starter', xp: 0 }, { level: 2, name: 'Explorer', xp: 100 },
  { level: 3, name: 'Learner', xp: 250 }, { level: 4, name: 'Builder', xp: 450 },
  { level: 5, name: 'Achiever', xp: 700 }, { level: 6, name: 'Specialist', xp: 1000 },
  { level: 7, name: 'Expert', xp: 1400 }, { level: 8, name: 'Master', xp: 1900 },
  { level: 9, name: 'Champion', xp: 2500 }, { level: 10, name: 'Legend', xp: 3200 },
] as const;

async function awardXp(client: import('pg').PoolClient, studentId: string, activityKey: string, points: number, reason: string) {
  const awarded = await client.query(
    `INSERT INTO student_xp_awards (student_id, activity_key, points, reason)
     VALUES ($1,$2,$3,$4) ON CONFLICT (student_id, activity_key) DO NOTHING RETURNING points`,
    [studentId, activityKey, points, reason],
  );
  if (!awarded.rows[0]) return false;
  await client.query(
    `INSERT INTO student_xp (student_id, total_xp) VALUES ($1,$2)
     ON CONFLICT (student_id) DO UPDATE SET total_xp = student_xp.total_xp + EXCLUDED.total_xp, updated_at = now()`,
    [studentId, points],
  );
  return true;
}

async function ensureCourseAccess(studentId: string, courseId: string, client: PoolClient | typeof pool = pool) {
  const course = await client.query<{ subject: string; status: string }>(
    'SELECT subject, status FROM courses WHERE id = $1',
    [courseId],
  );
  if (!course.rows[0] || course.rows[0].status !== 'published') {
    throw Object.assign(new Error('This course is not available.'), { status: 404 });
  }
  await client.query(
    'INSERT INTO course_enrollments (student_id, course_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
    [studentId, courseId],
  );
  return course.rows[0];
}

async function recordActivity(
  studentId: string,
  activityType: string,
  courseId: string | null,
  nodeId: string | null,
  subject: string | null,
  metadata: unknown = {},
  client: PoolClient | typeof pool = pool,
) {
  await client.query(
    `INSERT INTO learning_activity (student_id, course_id, node_id, activity_type, subject, metadata)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [studentId, courseId, nodeId, activityType, subject, JSON.stringify(metadata)],
  );
}

export const studentRouter = Router();
studentRouter.use(requireStudent);
studentRouter.use((request, response, next) => {
  if (['POST', 'PATCH', 'DELETE'].includes(request.method)) return requireSameOrigin(request, response, next);
  next();
});

studentRouter.get('/courses', asyncRoute(async (request, response) => {
  const studentId = requireStudentId(request);
  const result = await pool.query(`
    SELECT c.id, c.title, c.description, c.subject, c.thumbnail_key, c.updated_at,
      count(DISTINCT n.id) FILTER (WHERE n.node_type = 'lesson')::int AS lesson_count,
      count(DISTINCT a.node_id) FILTER (WHERE a.activity_type = 'lesson_completed')::int AS completed_lessons,
      EXISTS (SELECT 1 FROM course_enrollments e WHERE e.course_id = c.id AND e.student_id = $1) AS enrolled
    FROM courses c
    LEFT JOIN course_nodes n ON n.course_id = c.id
    LEFT JOIN learning_activity a ON a.course_id = c.id AND a.student_id = $1
    WHERE c.status = 'published'
    GROUP BY c.id ORDER BY c.subject, c.updated_at DESC
  `, [studentId]);
  response.json({ courses: result.rows });
}));

studentRouter.get('/courses/:courseId', asyncRoute(async (request, response) => {
  const studentId = requireStudentId(request);
  const courseId = parseId(request.params.courseId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const course = await ensureCourseAccess(studentId, courseId, client);
    await client.query(
      `INSERT INTO learning_activity (student_id, course_id, activity_type, subject)
       VALUES ($1,$2,'course_accessed',$3)`,
      [studentId, courseId, course.subject],
    );
    const details = await client.query(`
      SELECT id, title, description, subject, thumbnail_key, updated_at
      FROM courses WHERE id = $1 AND status = 'published'
    `, [courseId]);
    const nodes = await client.query(`
      SELECT n.id, n.parent_id, n.node_type, n.title, n.description, n.position,
        EXISTS (SELECT 1 FROM learning_activity la WHERE la.student_id = $2 AND la.node_id = n.id AND la.activity_type = 'lesson_completed') AS completed
      FROM course_nodes n WHERE n.course_id = $1 ORDER BY n.position, n.created_at
    `, [courseId, studentId]);
    const materials = await client.query(`
      SELECT id, node_id, title, description, original_filename, mime_type, file_size, position
      FROM learning_materials
      WHERE course_id = $1 AND status = 'published'
      ORDER BY position, created_at
    `, [courseId]);
    await client.query('COMMIT');
    response.json({ course: details.rows[0], nodes: nodes.rows, materials: materials.rows });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}));

studentRouter.get('/materials', asyncRoute(async (request, response) => {
  const studentId = requireStudentId(request);
  const courseId = typeof request.query.courseId === 'string' ? parseId(request.query.courseId) : null;
  const result = await pool.query(`
    SELECT m.id, m.course_id, m.node_id, m.subject, m.title, m.description, m.original_filename,
           m.mime_type, m.file_size, m.position, c.title AS course_title, n.title AS topic_title
    FROM learning_materials m
    LEFT JOIN courses c ON c.id = m.course_id
    LEFT JOIN course_nodes n ON n.id = m.node_id
    WHERE m.status = 'published' AND (m.course_id IS NULL OR c.status = 'published')
      AND ($1::uuid IS NULL OR m.course_id = $1)
      AND (m.course_id IS NULL OR EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id = $2 AND e.course_id = m.course_id))
    ORDER BY m.course_id NULLS LAST, m.position, m.created_at
  `, [courseId, studentId]);
  response.json({ materials: result.rows });
}));

studentRouter.get('/materials/:materialId/download', asyncRoute(async (request, response) => {
  const result = await pool.query<{ object_key: string; original_filename: string; course_id: string | null }>(`
    SELECT m.object_key, m.original_filename, m.course_id
    FROM learning_materials m LEFT JOIN courses c ON c.id = m.course_id
    WHERE m.id = $1 AND m.status = 'published' AND (m.course_id IS NULL OR c.status = 'published')
      AND (m.course_id IS NULL OR EXISTS (SELECT 1 FROM course_enrollments e WHERE e.course_id = m.course_id AND e.student_id = $2))
  `, [parseId(request.params.materialId), requireStudentId(request)]);
  if (!result.rows[0]) {
    response.status(404).json({ error: 'Learning material not found or unavailable.' });
    return;
  }
  await recordActivity(requireStudentId(request), 'material_opened', result.rows[0].course_id, null, null, { materialId: request.params.materialId });
  response.json({ url: await getMaterialDownloadUrl(result.rows[0].object_key), filename: result.rows[0].original_filename });
}));

studentRouter.post('/lessons/:nodeId/start', asyncRoute(async (request, response) => {
  const nodeId = parseId(request.params.nodeId);
  const studentId = requireStudentId(request);
  const node = await pool.query<{ course_id: string; subject: string }>(`
    SELECT n.course_id, c.subject FROM course_nodes n JOIN courses c ON c.id = n.course_id
    WHERE n.id = $1 AND n.node_type = 'lesson' AND c.status = 'published'
  `, [nodeId]);
  if (!node.rows[0]) {
    response.status(404).json({ error: 'Lesson not found or unavailable.' });
    return;
  }
  await ensureCourseAccess(studentId, node.rows[0].course_id);
  await recordActivity(studentId, 'lesson_started', node.rows[0].course_id, nodeId, node.rows[0].subject);
  response.status(204).end();
}));

studentRouter.post('/lessons/:nodeId/complete', asyncRoute(async (request, response) => {
  const nodeId = parseId(request.params.nodeId);
  const studentId = requireStudentId(request);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const node = await client.query<{ course_id: string; subject: string }>(`
      SELECT n.course_id, c.subject FROM course_nodes n JOIN courses c ON c.id = n.course_id
      WHERE n.id = $1 AND n.node_type = 'lesson' AND c.status = 'published' FOR UPDATE OF n
    `, [nodeId]);
    if (!node.rows[0]) {
      await client.query('ROLLBACK');
      response.status(404).json({ error: 'Lesson not found or unavailable.' });
      return;
    }
    await ensureCourseAccess(studentId, node.rows[0].course_id, client);
    const completed = await client.query(
      `SELECT 1 FROM learning_activity WHERE student_id = $1 AND node_id = $2 AND activity_type = 'lesson_completed' LIMIT 1`,
      [studentId, nodeId],
    );
    let awarded = false;
    if (!completed.rows[0]) {
      await client.query(
        `INSERT INTO learning_activity (student_id, course_id, node_id, activity_type, subject)
         VALUES ($1,$2,$3,'lesson_completed',$4)`,
        [studentId, node.rows[0].course_id, nodeId, node.rows[0].subject],
      );
      awarded = await awardXp(client, studentId, `lesson:${nodeId}`, 15, 'Lesson completed');
    }
    const stats = await client.query(
      'SELECT total_xp FROM student_xp WHERE student_id = $1',
      [studentId],
    );
    await client.query('COMMIT');
    response.json({ completed: true, awarded, totalXp: stats.rows[0]?.total_xp ?? 0 });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}));

studentRouter.get('/assignments', asyncRoute(async (request, response) => {
  const studentId = requireStudentId(request);
  const result = await pool.query(`
    SELECT a.id, a.title, a.instructions, a.subject, a.course_id, c.title AS course_title, a.due_at, a.max_marks,
           sub.id AS submission_id, sub.response_text, sub.status AS submission_status, sub.score, sub.feedback, sub.submitted_at, sub.reviewed_at,
           CASE WHEN sub.id IS NOT NULL THEN sub.status
                WHEN a.due_at IS NOT NULL AND a.due_at < now() THEN 'overdue'
                ELSE 'pending' END AS student_status
    FROM assignments a LEFT JOIN courses c ON c.id = a.course_id
    LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id AND sub.student_id = $1
    WHERE a.status = 'published' AND (a.course_id IS NULL OR c.status = 'published')
      AND (a.course_id IS NULL OR EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id = $1 AND e.course_id = a.course_id))
      AND (a.classroom_id IS NULL OR EXISTS (SELECT 1 FROM classroom_enrollments ce WHERE ce.classroom_id = a.classroom_id AND ce.student_id = $1))
    ORDER BY a.due_at NULLS LAST, a.created_at DESC
  `, [studentId]);
  response.json({ assignments: result.rows });
}));

studentRouter.post('/assignments/:assignmentId/submissions', asyncRoute(async (request, response) => {
  const assignmentId = parseId(request.params.assignmentId);
  const input = assignmentSubmissionInput.parse(request.body);
  const studentId = requireStudentId(request);
  const assignment = await pool.query<{ course_id: string | null; subject: string }>(`
    SELECT a.course_id, a.subject FROM assignments a LEFT JOIN courses c ON c.id = a.course_id
    WHERE a.id = $1 AND a.status = 'published' AND (a.course_id IS NULL OR c.status = 'published')
      AND (a.due_at IS NULL OR a.due_at >= now())
      AND (a.course_id IS NULL OR EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id = $2 AND e.course_id = a.course_id))
      AND (a.classroom_id IS NULL OR EXISTS (SELECT 1 FROM classroom_enrollments ce WHERE ce.classroom_id = a.classroom_id AND ce.student_id = $2))
  `, [assignmentId, studentId]);
  if (!assignment.rows[0]) {
    response.status(404).json({ error: 'Assignment unavailable or its deadline has passed.' });
    return;
  }
  const client = await pool.connect();
  let replacedAttachment: string | null = null;
  try {
    await client.query('BEGIN');
    const previous = await client.query<{ attachment_key: string | null }>(
      'SELECT attachment_key FROM assignment_submissions WHERE assignment_id = $1 AND student_id = $2 FOR UPDATE',
      [assignmentId, studentId],
    );
    replacedAttachment = previous.rows[0]?.attachment_key ?? null;
    const result = await client.query(`
      INSERT INTO assignment_submissions (assignment_id, student_id, response_text)
      VALUES ($1,$2,$3)
      ON CONFLICT (assignment_id, student_id) DO UPDATE
        SET response_text = EXCLUDED.response_text, attachment_key = NULL, attachment_filename = '',
            status = 'submitted', score = NULL, feedback = '', reviewed_at = NULL, submitted_at = now()
        WHERE assignment_submissions.status <> 'reviewed'
      RETURNING id, status, submitted_at
    `, [assignmentId, studentId, input.responseText]);
    if (!result.rows[0]) {
      await client.query('ROLLBACK');
      response.status(409).json({ error: 'This submission has already been reviewed and cannot be changed.' });
      return;
    }
    await recordActivity(studentId, 'assignment_submitted', assignment.rows[0].course_id, null, assignment.rows[0].subject, { assignmentId }, client);
    await client.query('COMMIT');
    if (replacedAttachment) {
      const { deleteStoredMaterial } = await import('../storage.js');
      await deleteStoredMaterial(replacedAttachment).catch((cleanupError) => console.error('Could not remove replaced assignment attachment', cleanupError));
    }
    response.status(201).json({ submission: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}));

studentRouter.post('/assignments/:assignmentId/attachment', assignmentUpload.single('file'), asyncRoute(async (request, response) => {
  const assignmentId = parseId(request.params.assignmentId);
  const studentId = requireStudentId(request);
  if (!request.file) {
    response.status(400).json({ error: 'Choose a file to submit.' });
    return;
  }
  const assignment = await pool.query<{ course_id: string | null; subject: string }>(`
    SELECT a.course_id, a.subject FROM assignments a LEFT JOIN courses c ON c.id = a.course_id
    WHERE a.id = $1 AND a.status = 'published' AND (a.due_at IS NULL OR a.due_at >= now())
      AND (a.course_id IS NULL OR c.status = 'published')
      AND (a.course_id IS NULL OR EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id = $2 AND e.course_id = a.course_id))
      AND (a.classroom_id IS NULL OR EXISTS (SELECT 1 FROM classroom_enrollments ce WHERE ce.classroom_id = a.classroom_id AND ce.student_id = $2))
  `, [assignmentId, studentId]);
  if (!assignment.rows[0]) {
    response.status(404).json({ error: 'Assignment unavailable or its deadline has passed.' });
    return;
  }
  const previous = await pool.query<{ attachment_key: string | null }>(
    'SELECT attachment_key FROM assignment_submissions WHERE assignment_id = $1 AND student_id = $2',
    [assignmentId, studentId],
  );
  const uploaded = await uploadLearningMaterial(request.file);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`
      INSERT INTO assignment_submissions (assignment_id, student_id, response_text, attachment_key, attachment_filename)
      VALUES ($1,$2,'', $3, $4)
      ON CONFLICT (assignment_id, student_id) DO UPDATE
        SET response_text = '', attachment_key = EXCLUDED.attachment_key, status = 'submitted',
            attachment_filename = EXCLUDED.attachment_filename,
            score = NULL, feedback = '', reviewed_at = NULL, submitted_at = now()
        WHERE assignment_submissions.status <> 'reviewed'
      RETURNING id, status, submitted_at
    `, [assignmentId, studentId, uploaded.key, request.file.originalname]);
    if (!result.rows[0]) {
      await client.query('ROLLBACK');
      const { deleteStoredMaterial } = await import('../storage.js');
      await deleteStoredMaterial(uploaded.key).catch((cleanupError) => console.error('Could not remove rejected assignment attachment', cleanupError));
      response.status(409).json({ error: 'This submission has already been reviewed and cannot be changed.' });
      return;
    }
    await recordActivity(studentId, 'assignment_submitted', assignment.rows[0].course_id, null, assignment.rows[0].subject, { assignmentId }, client);
    await client.query('COMMIT');
    if (previous.rows[0]?.attachment_key && previous.rows[0].attachment_key !== uploaded.key) {
      const { deleteStoredMaterial } = await import('../storage.js');
      await deleteStoredMaterial(previous.rows[0].attachment_key).catch((cleanupError) => console.error('Could not remove replaced assignment attachment', cleanupError));
    }
    response.status(201).json({ submission: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    const { deleteStoredMaterial } = await import('../storage.js');
    await deleteStoredMaterial(uploaded.key).catch((cleanupError) => console.error('Could not remove rejected assignment attachment', cleanupError));
    throw error;
  } finally {
    client.release();
  }
}));

studentRouter.get('/assessments', asyncRoute(async (request, response) => {
  const studentId = requireStudentId(request);
  const result = await pool.query(`
    SELECT a.id, a.title, a.description, a.subject, a.course_id, c.title AS course_title, a.duration_minutes,
           a.starts_at, a.ends_at,
           (SELECT count(*)::int FROM assessment_questions q WHERE q.assessment_id = a.id) AS question_count,
           (SELECT count(*)::int FROM assessment_attempts at WHERE at.assessment_id = a.id AND at.student_id = $1) AS attempts
    FROM assessments a LEFT JOIN courses c ON c.id = a.course_id
    WHERE a.status = 'published' AND (a.starts_at IS NULL OR a.starts_at <= now()) AND (a.ends_at IS NULL OR a.ends_at > now())
      AND (a.course_id IS NULL OR c.status = 'published')
      AND (a.course_id IS NULL OR EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id = $1 AND e.course_id = a.course_id))
      AND (a.classroom_id IS NULL OR EXISTS (SELECT 1 FROM classroom_enrollments ce WHERE ce.classroom_id = a.classroom_id AND ce.student_id = $1))
    ORDER BY a.starts_at NULLS FIRST, a.created_at DESC
  `, [studentId]);
  response.json({ assessments: result.rows });
}));

studentRouter.post('/assessments/:assessmentId/attempts', asyncRoute(async (request, response) => {
  const assessmentId = parseId(request.params.assessmentId);
  const studentId = requireStudentId(request);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const assessment = await client.query<{ course_id: string | null; subject: string; duration_minutes: number | null }>(`
      SELECT a.course_id, a.subject, a.duration_minutes FROM assessments a LEFT JOIN courses c ON c.id = a.course_id
      WHERE a.id = $1 AND a.status = 'published' AND (a.starts_at IS NULL OR a.starts_at <= now()) AND (a.ends_at IS NULL OR a.ends_at > now())
        AND (a.course_id IS NULL OR c.status = 'published')
        AND (a.course_id IS NULL OR EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id = $2 AND e.course_id = a.course_id))
        AND (a.classroom_id IS NULL OR EXISTS (SELECT 1 FROM classroom_enrollments ce WHERE ce.classroom_id = a.classroom_id AND ce.student_id = $2))
      FOR UPDATE OF a
    `, [assessmentId, studentId]);
    if (!assessment.rows[0]) {
      await client.query('ROLLBACK');
      response.status(404).json({ error: 'Assessment unavailable.' });
      return;
    }
    const attempt = await client.query<{ id: string; started_at: Date }>(
      'INSERT INTO assessment_attempts (assessment_id, student_id) VALUES ($1,$2) RETURNING id, started_at',
      [assessmentId, studentId],
    );
    const questions = await client.query(`
      SELECT id, question_type, prompt, options, marks, position
      FROM assessment_questions WHERE assessment_id = $1 ORDER BY position
    `, [assessmentId]);
    await client.query(
      `INSERT INTO learning_activity (student_id, course_id, activity_type, subject, metadata)
       VALUES ($1,$2,'assessment_attempted',$3,$4)`,
      [studentId, assessment.rows[0].course_id, assessment.rows[0].subject, JSON.stringify({ assessmentId, attemptId: attempt.rows[0].id })],
    );
    await client.query('COMMIT');
    response.status(201).json({
      attemptId: attempt.rows[0].id, startedAt: attempt.rows[0].started_at,
      durationMinutes: assessment.rows[0].duration_minutes, questions: questions.rows,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}));

studentRouter.post('/assessments/attempts/:attemptId/submit', asyncRoute(async (request, response) => {
  const attemptId = parseId(request.params.attemptId);
  const { answers } = z.object({ answers: z.array(answerInput).max(300) }).strict().parse(request.body);
  const studentId = requireStudentId(request);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const attempt = await client.query<{
      assessment_id: string; course_id: string | null; subject: string;
      started_at: Date; duration_minutes: number | null;
    }>(`
      SELECT at.assessment_id, at.started_at, a.course_id, a.subject, a.duration_minutes FROM assessment_attempts at
      JOIN assessments a ON a.id = at.assessment_id
      WHERE at.id = $1 AND at.student_id = $2 AND at.submitted_at IS NULL
        AND (a.classroom_id IS NULL OR EXISTS (
          SELECT 1 FROM classroom_enrollments ce WHERE ce.classroom_id = a.classroom_id AND ce.student_id = $2
        ))
      FOR UPDATE OF at
    `, [attemptId, studentId]);
    if (!attempt.rows[0]) {
      await client.query('ROLLBACK');
      response.status(404).json({ error: 'Assessment attempt not found or already submitted.' });
      return;
    }
    if (attempt.rows[0].duration_minutes !== null
      && Date.now() > attempt.rows[0].started_at.getTime() + attempt.rows[0].duration_minutes * 60_000) {
      await client.query('ROLLBACK');
      response.status(409).json({ error: 'The assessment time limit has passed. This attempt can no longer be submitted.' });
      return;
    }
    const questions = await client.query<{
      id: string; question_type: string; correct_option: number | null; marks: string;
    }>('SELECT id, question_type, correct_option, marks FROM assessment_questions WHERE assessment_id = $1', [attempt.rows[0].assessment_id]);
    const supplied = new Map(answers.map((answer) => [answer.questionId, answer]));
    if (supplied.size !== questions.rows.length || questions.rows.some((question) => !supplied.has(question.id))) {
      await client.query('ROLLBACK');
      response.status(400).json({ error: 'Submit one answer for every assessment question.' });
      return;
    }
    let objectiveScore = 0;
    let totalMarks = 0;
    let needsReview = false;
    for (const question of questions.rows) {
      const answer = supplied.get(question.id)!;
      const marks = Number(question.marks);
      totalMarks += marks;
      let awarded: number | null = null;
      if (question.question_type === 'multiple_choice') {
        const choice = await client.query<{ options: string[] }>('SELECT options FROM assessment_questions WHERE id = $1', [question.id]);
        awarded = gradeMultipleChoiceAnswer(
          answer.selectedOption,
          question.correct_option,
          choice.rows[0].options.length,
          marks,
        );
        if (awarded === null) {
          await client.query('ROLLBACK');
          response.status(400).json({ error: 'An answer option is invalid.' });
          return;
        }
        objectiveScore += awarded;
      } else {
        needsReview = true;
      }
      await client.query(
        `INSERT INTO assessment_responses (attempt_id, question_id, selected_option, answer_text, awarded_marks)
         VALUES ($1,$2,$3,$4,$5)`,
        [attemptId, question.id, answer.selectedOption ?? null, answer.answerText ?? null, awarded],
      );
    }
    const score = needsReview ? null : objectiveScore;
    await client.query(
      'UPDATE assessment_attempts SET score = $1, total_marks = $2, submitted_at = now() WHERE id = $3',
      [score, totalMarks, attemptId],
    );
    if (!needsReview) {
      const scoreRatio = totalMarks > 0 ? objectiveScore / totalMarks : 0;
      await awardXp(client, studentId, `assessment:${attemptId}`, scoreRatio >= 0.8 ? 65 : 50, scoreRatio >= 0.8 ? 'Assessment completed · high score bonus' : 'Assessment completed');
    }
    await client.query('COMMIT');
    response.json({ submitted: true, score, totalMarks, pendingReview: needsReview });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}));

studentRouter.get('/assessments/attempts', asyncRoute(async (request, response) => {
  const result = await pool.query(`
    SELECT at.id, at.assessment_id, a.title, a.subject, at.score, at.total_marks, at.feedback, at.reviewed_at, at.started_at, at.submitted_at
    FROM assessment_attempts at JOIN assessments a ON a.id = at.assessment_id
    WHERE at.student_id = $1 ORDER BY at.started_at DESC LIMIT 100
  `, [requireStudentId(request)]);
  response.json({ attempts: result.rows });
}));

studentRouter.get('/live-classes', asyncRoute(async (request, response) => {
  const result = await pool.query(`
    SELECT lc.id, lc.title, lc.description, lc.subject, lc.instructor, lc.starts_at, lc.ends_at,
      lc.meeting_url, c.title AS course_title,
      CASE WHEN lc.ends_at <= now() THEN 'completed' WHEN lc.starts_at <= now() THEN 'live' ELSE 'scheduled' END AS session_status
    FROM live_classes lc LEFT JOIN courses c ON c.id = lc.course_id
    WHERE lc.status = 'scheduled' AND lc.ends_at >= now() - interval '24 hours'
      AND (lc.course_id IS NULL OR c.status = 'published')
      AND (lc.course_id IS NULL OR EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id = $1 AND e.course_id = lc.course_id))
    ORDER BY lc.starts_at
  `, [requireStudentId(request)]);
  response.json({ liveClasses: result.rows });
}));

studentRouter.post('/live-classes/:classId/join', asyncRoute(async (request, response) => {
  const studentId = requireStudentId(request);
  const classId = parseId(request.params.classId);
  const session = await pool.query<{ course_id: string | null; subject: string; meeting_url: string | null }>(`
    SELECT lc.course_id, lc.subject, lc.meeting_url FROM live_classes lc LEFT JOIN courses c ON c.id = lc.course_id
    WHERE lc.id = $1 AND lc.status = 'scheduled' AND lc.starts_at <= now() AND lc.ends_at > now()
      AND lc.meeting_url IS NOT NULL AND (lc.course_id IS NULL OR c.status = 'published')
      AND (lc.course_id IS NULL OR EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id = $2 AND e.course_id = lc.course_id))
  `, [classId, studentId]);
  if (!session.rows[0]) {
    response.status(404).json({ error: 'This live class is not currently joinable.' });
    return;
  }
  await recordActivity(studentId, 'live_class_joined', session.rows[0].course_id, null, session.rows[0].subject, { classId });
  response.json({ meetingUrl: session.rows[0].meeting_url });
}));

studentRouter.get('/announcements', asyncRoute(async (request, response) => {
  const result = await pool.query(`
    SELECT a.id, a.title, a.body, a.link_url, a.course_id, c.title AS course_title, coalesce(a.published_at, a.created_at) AS published_at,
      (r.read_at IS NOT NULL) AS read, r.read_at
    FROM announcements a LEFT JOIN courses c ON c.id = a.course_id
    LEFT JOIN student_announcement_reads r ON r.announcement_id = a.id AND r.student_id = $1
    WHERE a.status = 'published' AND (a.course_id IS NULL OR c.status = 'published')
      AND (a.course_id IS NULL OR EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id = $1 AND e.course_id = a.course_id))
    ORDER BY a.published_at DESC NULLS LAST
  `, [requireStudentId(request)]);
  response.json({ announcements: result.rows });
}));

studentRouter.post('/announcements/:announcementId/read', asyncRoute(async (request, response) => {
  await pool.query(`
    INSERT INTO student_announcement_reads (student_id, announcement_id)
    SELECT $1, a.id FROM announcements a
    LEFT JOIN courses c ON c.id = a.course_id
    WHERE a.id = $2 AND a.status = 'published' AND (a.course_id IS NULL OR c.status = 'published')
      AND (a.course_id IS NULL OR EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id = $1 AND e.course_id = a.course_id))
    ON CONFLICT DO NOTHING
  `, [requireStudentId(request), parseId(request.params.announcementId)]);
  response.status(204).end();
}));

studentRouter.get('/progress', asyncRoute(async (request, response) => {
  const studentId = requireStudentId(request);
  const [xp, activity, courses, attempts, submissions, awards] = await Promise.all([
    pool.query('SELECT total_xp FROM student_xp WHERE student_id = $1', [studentId]),
    pool.query(`
      SELECT activity_type, subject, occurred_at, course_id, node_id, metadata
      FROM learning_activity WHERE student_id = $1 ORDER BY occurred_at DESC LIMIT 100
    `, [studentId]),
    pool.query(`
      SELECT c.id, c.title, c.subject, count(DISTINCT n.id) FILTER (WHERE n.node_type = 'lesson')::int AS lessons_total,
        count(DISTINCT a.node_id) FILTER (WHERE a.activity_type = 'lesson_completed')::int AS lessons_completed
      FROM course_enrollments e JOIN courses c ON c.id = e.course_id
      LEFT JOIN course_nodes n ON n.course_id = c.id
      LEFT JOIN learning_activity a ON a.student_id = e.student_id AND a.course_id = e.course_id
      WHERE e.student_id = $1 GROUP BY c.id ORDER BY c.title
    `, [studentId]),
    pool.query(`
      SELECT at.id, a.title, at.score, at.total_marks, at.started_at, at.submitted_at, at.feedback, at.reviewed_at
      FROM assessment_attempts at JOIN assessments a ON a.id = at.assessment_id
      WHERE at.student_id = $1 ORDER BY at.started_at DESC LIMIT 25
    `, [studentId]),
    pool.query(`
      SELECT sub.id, a.title, sub.status, sub.score, a.max_marks, sub.feedback, sub.submitted_at, sub.reviewed_at
      FROM assignment_submissions sub JOIN assignments a ON a.id = sub.assignment_id
      WHERE sub.student_id = $1 ORDER BY sub.submitted_at DESC LIMIT 25
    `, [studentId]),
    pool.query('SELECT id, points, reason, created_at FROM student_xp_awards WHERE student_id = $1 ORDER BY created_at DESC LIMIT 20', [studentId]),
  ]);
  const totalXp = Number(xp.rows[0]?.total_xp ?? 0);
  const currentLevel = [...LEVELS].reverse().find((level) => totalXp >= level.xp) ?? LEVELS[0];
  response.json({
    totalXp,
    level: currentLevel.level,
    levelName: currentLevel.name,
    courses: courses.rows,
    activity: activity.rows,
    assessmentAttempts: attempts.rows,
    assignmentSubmissions: submissions.rows,
    xpAwards: awards.rows,
    legacyProgress: null,
  });
}));

studentRouter.get('/notifications', asyncRoute(async (request, response) => {
  const result = await pool.query(`
    SELECT a.id, a.title, a.body AS message, 'Platform' AS category, a.published_at AS created_at,
      (r.read_at IS NOT NULL) AS read
    FROM announcements a LEFT JOIN student_announcement_reads r ON r.announcement_id = a.id AND r.student_id = $1
    LEFT JOIN courses c ON c.id = a.course_id
    WHERE a.status = 'published' AND (a.course_id IS NULL OR c.status = 'published')
      AND (a.course_id IS NULL OR EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id = $1 AND e.course_id = a.course_id))
    ORDER BY a.published_at DESC NULLS LAST
  `, [requireStudentId(request)]);
  response.json({ notifications: result.rows });
}));
