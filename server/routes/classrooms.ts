import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireManagement, requireSameOrigin, requireStudent, requireStudentId } from '../auth.js';
import { config, hasEmailDelivery, isValidEmailSender } from '../config.js';
import { pool } from '../db/pool.js';
import { asyncRoute, parseId, requireManagerId } from '../http.js';
import { materialUploadLimits, uploadLearningMaterial } from '../storage.js';
import { SUPPORTED_SUBJECTS } from '../../shared/subjects.js';

const uuid = z.string().uuid();
const subject = z.enum(SUPPORTED_SUBJECTS);
const classroomInput = z.object({
  name: z.string().trim().min(2).max(160),
  subject,
  courseId: uuid,
  section: z.string().trim().max(100).default(''),
  description: z.string().trim().max(4000).default(''),
  status: z.enum(['active', 'archived']).optional(),
}).strict();
const postInput = z.object({
  title: z.string().trim().min(2).max(180),
  body: z.string().trim().min(1).max(10_000),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
  isPinned: z.boolean().default(false),
}).strict();
const commentInput = z.object({ body: z.string().trim().min(1).max(4000) }).strict();
const linkInput = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(4000).default(''),
  topicId: uuid.nullable().optional(),
  url: z.string().url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'Use an HTTP or HTTPS link.').max(2000),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
}).strict();
const liveClassInput = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(5000).default(''),
  instructor: z.string().trim().min(2).max(160),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  meetingUrl: z.string().url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol)).max(2000).nullable().optional(),
  status: z.enum(['scheduled', 'cancelled']).default('scheduled'),
}).strict().refine((item) => new Date(item.endsAt) > new Date(item.startsAt), {
  path: ['endsAt'], message: 'End time must be after start time.',
});
const topicInput = z.object({
  title: z.string().trim().min(1).max(160),
  position: z.number().int().min(0).max(100_000).default(0),
}).strict();
const assignmentInput = z.object({
  title: z.string().trim().min(2).max(180),
  instructions: z.string().trim().min(1).max(12_000),
  topicId: uuid.nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  maxMarks: z.number().positive().max(1_000_000).nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
}).strict();
const questionInput = z.object({
  questionType: z.enum(['multiple_choice', 'short_answer', 'long_answer']),
  prompt: z.string().trim().min(1).max(5000),
  options: z.array(z.string().trim().min(1).max(1000)).max(12).default([]),
  correctOption: z.number().int().nonnegative().nullable().optional(),
  marks: z.number().nonnegative().max(1_000_000).default(1),
}).strict().refine((item) => item.questionType !== 'multiple_choice' || item.options.length >= 2, {
  path: ['options'], message: 'Multiple-choice questions need at least two options.',
}).refine((item) => item.correctOption == null || item.correctOption < item.options.length, {
  path: ['correctOption'], message: 'The correct answer must match an available option.',
});
const assessmentInput = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(6000).default(''),
  topicId: uuid.nullable().optional(),
  durationMinutes: z.number().int().positive().max(1440).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  questions: z.array(questionInput).min(1).max(300),
}).strict().refine((item) => !item.startsAt || !item.endsAt || new Date(item.endsAt) > new Date(item.startsAt), {
  path: ['endsAt'], message: 'End time must be after start time.',
});
const reviewInput = z.object({
  score: z.number().nonnegative().max(1_000_000).nullable(),
  feedback: z.string().trim().max(8000).default(''),
}).strict();

const materialUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: materialUploadLimits.maxBytes, files: 1 },
});

function makeJoinCode() {
  return randomBytes(5).toString('hex').toUpperCase();
}

async function validateClassCourse(classroomId: string, courseId: string, selectedSubject: string) {
  const result = await pool.query<{ course_id: string; subject: string; status: string }>(
    'SELECT course_id, subject, status FROM classrooms WHERE id = $1',
    [classroomId],
  );
  const classroom = result.rows[0];
  if (!classroom || classroom.status !== 'active') {
    throw Object.assign(new Error('This classroom is not available.'), { status: 404 });
  }
  if (classroom.course_id !== courseId || classroom.subject !== selectedSubject) {
    throw Object.assign(new Error('Classwork must use this classroom’s linked course and subject.'), { status: 400 });
  }
}

async function validateTopic(classroomId: string, topicId: string | null | undefined) {
  if (!topicId) return;
  const result = await pool.query(
    'SELECT id FROM classroom_topics WHERE id = $1 AND classroom_id = $2',
    [topicId, classroomId],
  );
  if (!result.rows[0]) {
    throw Object.assign(new Error('Select a topic from this classroom.'), { status: 400 });
  }
}

export const managementClassroomsRouter = Router();
managementClassroomsRouter.use(requireManagement);
managementClassroomsRouter.use((request, response, next) => {
  if (['POST', 'PATCH', 'DELETE'].includes(request.method)) return requireSameOrigin(request, response, next);
  next();
});

managementClassroomsRouter.get('/settings/email', (_request, response) => {
  response.json({
    configured: hasEmailDelivery,
    resendKeyPresent: Boolean(config.RESEND_API_KEY),
    senderPresent: Boolean(config.EMAIL_FROM),
    senderFormatValid: isValidEmailSender(config.EMAIL_FROM),
  });
});

managementClassroomsRouter.get('/calendar', asyncRoute(async (_request, response) => {
  const result = await pool.query(`
    SELECT 'assignment' AS event_type, a.id, a.title, a.due_at AS starts_at, a.classroom_id,
      c.name AS classroom_name
    FROM assignments a JOIN classrooms c ON c.id = a.classroom_id
    WHERE a.status = 'published' AND a.due_at IS NOT NULL AND c.status = 'active'
    UNION ALL
    SELECT 'assessment', a.id, a.title, a.starts_at, a.classroom_id, c.name
    FROM assessments a JOIN classrooms c ON c.id = a.classroom_id
    WHERE a.status = 'published' AND a.starts_at IS NOT NULL AND c.status = 'active'
    UNION ALL
    SELECT 'live_class', l.id, l.title, l.starts_at, l.classroom_id, c.name
    FROM live_classes l JOIN classrooms c ON c.id = l.classroom_id
    WHERE l.status = 'scheduled' AND c.status = 'active'
    ORDER BY starts_at
  `);
  response.json({ events: result.rows });
}));

managementClassroomsRouter.get('/review', asyncRoute(async (_request, response) => {
  const assignments = await pool.query(`
    SELECT sub.id AS submission_id, sub.submitted_at, sub.response_text, sub.attachment_filename,
      a.id AS assignment_id, a.title AS assignment_title, a.max_marks, c.id AS classroom_id, c.name AS classroom_name,
      s.id AS student_id, s.full_name, s.email, 'assignment' AS review_type
    FROM assignment_submissions sub
    JOIN assignments a ON a.id = sub.assignment_id
    JOIN classrooms c ON c.id = a.classroom_id
    JOIN students s ON s.id = sub.student_id
    WHERE sub.status = 'submitted' AND c.status = 'active'
    ORDER BY sub.submitted_at
  `);
  const assessments = await pool.query(`
    SELECT at.id AS attempt_id, at.submitted_at, at.score, at.total_marks,
      a.id AS assessment_id, a.title AS assessment_title, c.id AS classroom_id, c.name AS classroom_name,
      s.id AS student_id, s.full_name, s.email, 'assessment' AS review_type
    FROM assessment_attempts at
    JOIN assessments a ON a.id = at.assessment_id
    JOIN classrooms c ON c.id = a.classroom_id
    JOIN students s ON s.id = at.student_id
    WHERE at.submitted_at IS NOT NULL AND at.reviewed_at IS NULL AND c.status = 'active'
    ORDER BY at.submitted_at
  `);
  response.json({ assignmentSubmissions: assignments.rows, assessmentAttempts: assessments.rows });
}));

managementClassroomsRouter.get('/', asyncRoute(async (_request, response) => {
  const result = await pool.query(`
    SELECT c.id, c.name, c.subject, c.course_id, co.title AS course_title, c.section, c.description,
      c.join_code, c.status, c.created_at, c.updated_at,
      count(DISTINCT e.student_id)::int AS student_count,
      (SELECT max(activity.occurred_at) FROM learning_activity activity WHERE activity.course_id = c.course_id) AS recent_activity
    FROM classrooms c JOIN courses co ON co.id = c.course_id
    LEFT JOIN classroom_enrollments e ON e.classroom_id = c.id
    GROUP BY c.id, co.title ORDER BY c.updated_at DESC, c.name
  `);
  response.json({ classrooms: result.rows });
}));

managementClassroomsRouter.post('/', asyncRoute(async (request, response) => {
  const input = classroomInput.parse(request.body);
  const course = await pool.query<{ subject: string; status: string }>(
    'SELECT subject, status FROM courses WHERE id = $1',
    [input.courseId],
  );
  if (!course.rows[0] || course.rows[0].status !== 'published' || course.rows[0].subject !== input.subject) {
    response.status(400).json({ error: 'Select a published course for the chosen subject.' });
    return;
  }
  const result = await pool.query(`
    INSERT INTO classrooms (name, subject, course_id, section, description, join_code, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [input.name, input.subject, input.courseId, input.section, input.description, makeJoinCode(), requireManagerId(request)]);
  response.status(201).json({ classroom: result.rows[0] });
}));

managementClassroomsRouter.patch('/:classroomId', asyncRoute(async (request, response) => {
  const classroomId = parseId(request.params.classroomId);
  const input = classroomInput.partial().parse(request.body);
  if (!Object.keys(input).length) {
    response.status(400).json({ error: 'No classroom changes were supplied.' });
    return;
  }
  const current = await pool.query<{ subject: string; course_id: string }>(
    'SELECT subject, course_id FROM classrooms WHERE id = $1',
    [classroomId],
  );
  if (!current.rows[0]) {
    response.status(404).json({ error: 'Classroom not found.' });
    return;
  }
  const courseId = input.courseId ?? current.rows[0].course_id;
  const selectedSubject = input.subject ?? current.rows[0].subject;
  const course = await pool.query<{ subject: string; status: string }>('SELECT subject, status FROM courses WHERE id = $1', [courseId]);
  if (!course.rows[0] || course.rows[0].status !== 'published' || course.rows[0].subject !== selectedSubject) {
    response.status(400).json({ error: 'Select a published course for the chosen subject.' });
    return;
  }
  const values: unknown[] = [];
  const fields: string[] = [];
  const columns = { name: 'name', subject: 'subject', courseId: 'course_id', section: 'section', description: 'description', status: 'status' } as const;
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    values.push(value);
    fields.push(`${columns[key as keyof typeof columns]} = $${values.length}`);
  }
  values.push(classroomId);
  const result = await pool.query(`UPDATE classrooms SET ${fields.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`, values);
  response.json({ classroom: result.rows[0] });
}));

managementClassroomsRouter.post('/:classroomId/join-code', asyncRoute(async (request, response) => {
  const result = await pool.query(
    'UPDATE classrooms SET join_code = $1, updated_at = now() WHERE id = $2 AND status = $3 RETURNING join_code',
    [makeJoinCode(), parseId(request.params.classroomId), 'active'],
  );
  if (!result.rows[0]) {
    response.status(404).json({ error: 'Active classroom not found.' });
    return;
  }
  response.json({ joinCode: result.rows[0].join_code });
}));

managementClassroomsRouter.get('/:classroomId/people', asyncRoute(async (request, response) => {
  const classroomId = parseId(request.params.classroomId);
  const query = typeof request.query.q === 'string' ? request.query.q.trim().slice(0, 100) : '';
  const roster = await pool.query(`
    SELECT s.id, s.full_name, s.email, s.roll_number, e.joined_at
    FROM classroom_enrollments e JOIN students s ON s.id = e.student_id
    WHERE e.classroom_id = $1
      AND ($2 = '' OR s.full_name ILIKE '%' || $2 || '%' OR s.email ILIKE '%' || $2 || '%' OR coalesce(s.roll_number, '') ILIKE '%' || $2 || '%')
    ORDER BY s.full_name LIMIT 200
  `, [classroomId, query]);
  const available = await pool.query(`
    SELECT s.id, s.full_name, s.email, s.roll_number
    FROM students s
    WHERE NOT EXISTS (SELECT 1 FROM classroom_enrollments e WHERE e.classroom_id = $1 AND e.student_id = s.id)
      AND ($2 = '' OR s.full_name ILIKE '%' || $2 || '%' OR s.email ILIKE '%' || $2 || '%' OR coalesce(s.roll_number, '') ILIKE '%' || $2 || '%')
    ORDER BY s.full_name LIMIT 50
  `, [classroomId, query]);
  response.json({ students: roster.rows, availableStudents: available.rows });
}));

managementClassroomsRouter.post('/:classroomId/people', asyncRoute(async (request, response) => {
  const { studentId } = z.object({ studentId: uuid }).strict().parse(request.body);
  const classroomId = parseId(request.params.classroomId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const classroom = await client.query<{ course_id: string; status: string }>(
      'SELECT course_id, status FROM classrooms WHERE id = $1 FOR UPDATE',
      [classroomId],
    );
    if (!classroom.rows[0] || classroom.rows[0].status !== 'active') {
      await client.query('ROLLBACK');
      response.status(404).json({ error: 'Active classroom not found.' });
      return;
    }
    const student = await client.query('SELECT id FROM students WHERE id = $1', [studentId]);
    if (!student.rows[0]) {
      await client.query('ROLLBACK');
      response.status(404).json({ error: 'Existing student account not found.' });
      return;
    }
    const enrollment = await client.query(
      'INSERT INTO classroom_enrollments (classroom_id, student_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING student_id',
      [classroomId, studentId],
    );
    if (!enrollment.rows[0]) {
      await client.query('ROLLBACK');
      response.status(409).json({ error: 'This student is already enrolled in the classroom.' });
      return;
    }
    await client.query('INSERT INTO course_enrollments (student_id, course_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [studentId, classroom.rows[0].course_id]);
    await client.query('COMMIT');
    response.status(201).json({ enrolled: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}));

managementClassroomsRouter.delete('/:classroomId/people/:studentId', asyncRoute(async (request, response) => {
  const result = await pool.query(
    'DELETE FROM classroom_enrollments WHERE classroom_id = $1 AND student_id = $2 RETURNING student_id',
    [parseId(request.params.classroomId), parseId(request.params.studentId)],
  );
  if (!result.rows[0]) {
    response.status(404).json({ error: 'Classroom enrollment not found.' });
    return;
  }
  response.status(204).end();
}));

managementClassroomsRouter.get('/:classroomId/topics', asyncRoute(async (request, response) => {
  const result = await pool.query(
    'SELECT id, title, position, created_at FROM classroom_topics WHERE classroom_id = $1 ORDER BY position, created_at',
    [parseId(request.params.classroomId)],
  );
  response.json({ topics: result.rows });
}));

managementClassroomsRouter.post('/:classroomId/topics', asyncRoute(async (request, response) => {
  const item = topicInput.parse(request.body);
  const result = await pool.query(
    'INSERT INTO classroom_topics (classroom_id, title, position) VALUES ($1,$2,$3) RETURNING *',
    [parseId(request.params.classroomId), item.title, item.position],
  );
  response.status(201).json({ topic: result.rows[0] });
}));

managementClassroomsRouter.get('/:classroomId/posts', asyncRoute(async (request, response) => {
  const result = await pool.query(`
    SELECT p.id, p.title, p.body, p.status, p.is_pinned, p.created_at, p.updated_at,
      coalesce(json_agg(json_build_object(
        'id', cm.id, 'body', cm.body, 'created_at', cm.created_at,
        'student_name', s.full_name, 'student_id', s.id
      ) ORDER BY cm.created_at) FILTER (WHERE cm.id IS NOT NULL), '[]'::json) AS comments
    FROM classroom_posts p
    LEFT JOIN classroom_comments cm ON cm.post_id = p.id
    LEFT JOIN students s ON s.id = cm.student_id
    WHERE p.classroom_id = $1
    GROUP BY p.id ORDER BY p.is_pinned DESC, p.created_at DESC
  `, [parseId(request.params.classroomId)]);
  response.json({ posts: result.rows });
}));

managementClassroomsRouter.post('/:classroomId/posts', asyncRoute(async (request, response) => {
  const item = postInput.parse(request.body);
  const result = await pool.query(
    'INSERT INTO classroom_posts (classroom_id, created_by, title, body, status, is_pinned) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [parseId(request.params.classroomId), requireManagerId(request), item.title, item.body, item.status, item.isPinned],
  );
  response.status(201).json({ post: result.rows[0] });
}));

managementClassroomsRouter.patch('/:classroomId/posts/:postId', asyncRoute(async (request, response) => {
  const item = postInput.partial().parse(request.body);
  const keys = Object.keys(item) as Array<keyof typeof item>;
  if (!keys.length) {
    response.status(400).json({ error: 'No announcement changes were supplied.' });
    return;
  }
  const map = { title: 'title', body: 'body', status: 'status', isPinned: 'is_pinned' } as const;
  const values = keys.map((key) => item[key]);
  const fields = keys.map((key, index) => `${map[key]} = $${index + 1}`);
  values.push(parseId(request.params.postId), parseId(request.params.classroomId));
  const result = await pool.query(
    `UPDATE classroom_posts SET ${fields.join(', ')}, updated_at = now() WHERE id = $${values.length - 1} AND classroom_id = $${values.length} RETURNING id`,
    values,
  );
  if (!result.rows[0]) {
    response.status(404).json({ error: 'Classroom announcement not found.' });
    return;
  }
  response.status(204).end();
}));

managementClassroomsRouter.delete('/:classroomId/posts/:postId', asyncRoute(async (request, response) => {
  const result = await pool.query(
    `UPDATE classroom_posts SET status = 'archived', is_pinned = false, updated_at = now()
     WHERE id = $1 AND classroom_id = $2 RETURNING id`,
    [parseId(request.params.postId), parseId(request.params.classroomId)],
  );
  if (!result.rows[0]) {
    response.status(404).json({ error: 'Classroom announcement not found.' });
    return;
  }
  response.status(204).end();
}));

managementClassroomsRouter.get('/:classroomId/classwork', asyncRoute(async (request, response) => {
  const classroomId = parseId(request.params.classroomId);
  const [classroom, assignments, assessments, materials, links, liveClasses, topics] = await Promise.all([
    pool.query('SELECT id, course_id, subject FROM classrooms WHERE id = $1', [classroomId]),
    pool.query(`
      SELECT a.id, a.title, a.instructions, a.due_at, a.max_marks, a.status, a.classroom_topic_id,
        t.title AS topic_title, count(s.id)::int AS submission_count,
        count(s.id) FILTER (WHERE s.status = 'reviewed')::int AS reviewed_count
      FROM assignments a LEFT JOIN classroom_topics t ON t.id = a.classroom_topic_id
      LEFT JOIN assignment_submissions s ON s.assignment_id = a.id
      WHERE a.classroom_id = $1 GROUP BY a.id, t.title ORDER BY a.created_at DESC
    `, [classroomId]),
    pool.query(`
      SELECT a.id, a.title, a.description, a.starts_at, a.ends_at, a.duration_minutes, a.status, a.classroom_topic_id,
        t.title AS topic_title, count(DISTINCT at.id)::int AS attempt_count
      FROM assessments a LEFT JOIN classroom_topics t ON t.id = a.classroom_topic_id
      LEFT JOIN assessment_attempts at ON at.assessment_id = a.id
      WHERE a.classroom_id = $1 GROUP BY a.id, t.title ORDER BY a.created_at DESC
    `, [classroomId]),
    pool.query(`
      SELECT id, title, description, node_id, original_filename, mime_type, file_size, status, position
      FROM learning_materials WHERE course_id = (SELECT course_id FROM classrooms WHERE id = $1)
      ORDER BY position, created_at DESC
    `, [classroomId]),
    pool.query(`
      SELECT id, title, description, topic_id, external_url, status
      FROM classroom_resources WHERE classroom_id = $1 ORDER BY created_at DESC
    `, [classroomId]),
    pool.query(`
      SELECT id, title, description, instructor, starts_at, ends_at, meeting_url, status
      FROM live_classes WHERE classroom_id = $1 ORDER BY starts_at DESC
    `, [classroomId]),
    pool.query('SELECT id, title, position FROM classroom_topics WHERE classroom_id = $1 ORDER BY position, created_at', [classroomId]),
  ]);
  if (!classroom.rows[0]) {
    response.status(404).json({ error: 'Classroom not found.' });
    return;
  }
  response.json({
    assignments: assignments.rows, assessments: assessments.rows,
    materials: materials.rows, links: links.rows, liveClasses: liveClasses.rows,
    topics: topics.rows, courseId: classroom.rows[0].course_id,
    subject: classroom.rows[0].subject,
  });
}));

managementClassroomsRouter.post('/:classroomId/live-classes', asyncRoute(async (request, response) => {
  const classroomId = parseId(request.params.classroomId);
  const item = liveClassInput.parse(request.body);
  const classroom = await pool.query<{ course_id: string; subject: string; status: string }>(
    'SELECT course_id, subject, status FROM classrooms WHERE id = $1',
    [classroomId],
  );
  if (!classroom.rows[0] || classroom.rows[0].status !== 'active') {
    response.status(404).json({ error: 'Active classroom not found.' });
    return;
  }
  const result = await pool.query(`
    INSERT INTO live_classes (title, description, classroom_id, course_id, subject, instructor, starts_at, ends_at, meeting_url, status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id, title, description, starts_at, ends_at, meeting_url, status
  `, [item.title, item.description, classroomId, classroom.rows[0].course_id, classroom.rows[0].subject, item.instructor, item.startsAt, item.endsAt, item.meetingUrl ?? null, item.status, requireManagerId(request)]);
  response.status(201).json({ liveClass: result.rows[0] });
}));

managementClassroomsRouter.post('/:classroomId/links', asyncRoute(async (request, response) => {
  const classroomId = parseId(request.params.classroomId);
  const item = linkInput.parse(request.body);
  await validateTopic(classroomId, item.topicId);
  const result = await pool.query(`
    INSERT INTO classroom_resources (classroom_id, topic_id, title, description, external_url, status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, title, description, topic_id, external_url, status
  `, [classroomId, item.topicId ?? null, item.title, item.description, item.url, item.status, requireManagerId(request)]);
  response.status(201).json({ link: result.rows[0] });
}));

managementClassroomsRouter.patch('/:classroomId/links/:linkId', asyncRoute(async (request, response) => {
  const classroomId = parseId(request.params.classroomId);
  const linkId = parseId(request.params.linkId);
  const item = linkInput.partial().parse(request.body);
  if (!Object.keys(item).length) {
    response.status(400).json({ error: 'No link changes were supplied.' });
    return;
  }
  await validateTopic(classroomId, item.topicId);
  const columns = { title: 'title', description: 'description', topicId: 'topic_id', url: 'external_url', status: 'status' } as const;
  const entries = Object.entries(item).filter(([, value]) => value !== undefined);
  const values = entries.map(([, value]) => value);
  const fields = entries.map(([key], index) => `${columns[key as keyof typeof columns]} = $${index + 1}`);
  values.push(linkId, classroomId);
  const result = await pool.query(
    `UPDATE classroom_resources SET ${fields.join(', ')}, updated_at = now()
     WHERE id = $${values.length - 1} AND classroom_id = $${values.length} RETURNING id`,
    values,
  );
  if (!result.rows[0]) {
    response.status(404).json({ error: 'Classroom link not found.' });
    return;
  }
  response.status(204).end();
}));

managementClassroomsRouter.post('/:classroomId/assignments', asyncRoute(async (request, response) => {
  const classroomId = parseId(request.params.classroomId);
  const item = assignmentInput.parse(request.body);
  const classroom = await pool.query<{ course_id: string; subject: string; status: string }>(
    'SELECT course_id, subject, status FROM classrooms WHERE id = $1',
    [classroomId],
  );
  if (!classroom.rows[0] || classroom.rows[0].status !== 'active') {
    response.status(404).json({ error: 'Active classroom not found.' });
    return;
  }
  const { course_id: courseId, subject: classSubject } = classroom.rows[0];
  await validateTopic(classroomId, item.topicId);
  const result = await pool.query(`
    INSERT INTO assignments (title, instructions, classroom_id, classroom_topic_id, course_id, subject, due_at, max_marks, status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
  `, [item.title, item.instructions, classroomId, item.topicId ?? null, courseId, classSubject, item.dueAt ?? null, item.maxMarks ?? null, item.status, requireManagerId(request)]);
  response.status(201).json({ assignment: result.rows[0] });
}));

managementClassroomsRouter.post('/:classroomId/assessments', asyncRoute(async (request, response) => {
  const classroomId = parseId(request.params.classroomId);
  const item = assessmentInput.parse(request.body);
  const classroom = await pool.query<{ course_id: string; subject: string; status: string }>(
    'SELECT course_id, subject, status FROM classrooms WHERE id = $1',
    [classroomId],
  );
  if (!classroom.rows[0] || classroom.rows[0].status !== 'active') {
    response.status(404).json({ error: 'Active classroom not found.' });
    return;
  }
  const { course_id: courseId, subject: classSubject } = classroom.rows[0];
  await validateTopic(classroomId, item.topicId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = await client.query(`
      INSERT INTO assessments (title, description, classroom_id, classroom_topic_id, course_id, subject, duration_minutes, starts_at, ends_at, status, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
    `, [item.title, item.description, classroomId, item.topicId ?? null, courseId, classSubject, item.durationMinutes ?? null, item.startsAt ?? null, item.endsAt ?? null, item.status, requireManagerId(request)]);
    for (const [position, question] of item.questions.entries()) {
      await client.query(`
        INSERT INTO assessment_questions (assessment_id, question_type, prompt, options, correct_option, marks, position)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [created.rows[0].id, question.questionType, question.prompt, JSON.stringify(question.options), question.correctOption ?? null, question.marks, position]);
    }
    await client.query('COMMIT');
    response.status(201).json({ assessment: created.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}));

managementClassroomsRouter.post('/:classroomId/materials', materialUpload.single('file'), asyncRoute(async (request, response) => {
  const classroomId = parseId(request.params.classroomId);
  const input = z.object({
    title: z.string().trim().min(1).max(180),
    description: z.string().trim().max(4000).default(''),
    nodeId: z.string().uuid().optional(),
    status: z.enum(['draft', 'published', 'archived']).default('published'),
  }).strict().parse(request.body);
  if (!request.file) {
    response.status(400).json({ error: 'Choose a learning-material file.' });
    return;
  }
  const classroom = await pool.query<{ course_id: string; subject: string; status: string }>(
    'SELECT course_id, subject, status FROM classrooms WHERE id = $1',
    [classroomId],
  );
  if (!classroom.rows[0] || classroom.rows[0].status !== 'active') {
    response.status(404).json({ error: 'Active classroom not found.' });
    return;
  }
  if (input.nodeId) {
    const node = await pool.query(
      `SELECT id FROM course_nodes WHERE id = $1 AND course_id = $2 AND node_type IN ('topic','lesson')`,
      [input.nodeId, classroom.rows[0].course_id],
    );
    if (!node.rows[0]) {
      response.status(400).json({ error: 'Choose a topic or lesson from the classroom course.' });
      return;
    }
  }
  const uploaded = await uploadLearningMaterial(request.file);
  try {
    const result = await pool.query(`
      INSERT INTO learning_materials (course_id, node_id, subject, title, description, object_key, original_filename, mime_type, file_size, status, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id, title, description, node_id, original_filename, mime_type, file_size, status
    `, [classroom.rows[0].course_id, input.nodeId ?? null, classroom.rows[0].subject, input.title, input.description, uploaded.key, request.file.originalname, uploaded.mimeType, request.file.size, input.status, requireManagerId(request)]);
    response.status(201).json({ material: result.rows[0] });
  } catch (error) {
    const { deleteStoredMaterial } = await import('../storage.js');
    await deleteStoredMaterial(uploaded.key).catch((cleanupError) => console.error('Could not remove rejected classroom material', cleanupError));
    throw error;
  }
}));

managementClassroomsRouter.get('/:classroomId/grades', asyncRoute(async (request, response) => {
  const classroomId = parseId(request.params.classroomId);
  const [students, submissions, attempts] = await Promise.all([
    pool.query(`
      SELECT s.id, s.full_name, s.email, s.roll_number, e.joined_at
      FROM classroom_enrollments e JOIN students s ON s.id = e.student_id
      WHERE e.classroom_id = $1 ORDER BY s.full_name
    `, [classroomId]),
    pool.query(`
      SELECT sub.id, a.id AS assignment_id, a.title AS assignment_title, a.max_marks,
        s.id AS student_id, s.full_name, sub.response_text, sub.attachment_filename,
        coalesce(sub.status, 'missing') AS status, sub.score, sub.feedback, sub.submitted_at, sub.reviewed_at
      FROM classroom_enrollments e
      JOIN students s ON s.id = e.student_id
      JOIN assignments a ON a.classroom_id = e.classroom_id AND a.status <> 'draft'
      LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id AND sub.student_id = s.id
      WHERE e.classroom_id = $1 ORDER BY a.created_at, s.full_name
    `, [classroomId]),
    pool.query(`
      SELECT at.id, a.id AS assessment_id, a.title AS assessment_title, s.id AS student_id, s.full_name,
        at.score, at.total_marks, at.feedback, at.reviewed_at, at.started_at, at.submitted_at,
        coalesce(at.submitted_at IS NOT NULL AND EXISTS (
          SELECT 1 FROM assessment_responses ar WHERE ar.attempt_id = at.id AND ar.awarded_marks IS NULL
        ), false) AS pending_review
      FROM classroom_enrollments e
      JOIN students s ON s.id = e.student_id
      JOIN assessments a ON a.classroom_id = e.classroom_id AND a.status <> 'draft'
      LEFT JOIN LATERAL (
        SELECT * FROM assessment_attempts WHERE assessment_id = a.id AND student_id = s.id
        ORDER BY started_at DESC LIMIT 1
      ) at ON true
      WHERE e.classroom_id = $1 ORDER BY a.created_at, s.full_name
    `, [classroomId]),
  ]);
  response.json({ students: students.rows, submissions: submissions.rows, attempts: attempts.rows });
}));

export const studentClassroomsRouter = Router();
studentClassroomsRouter.use(requireStudent);
studentClassroomsRouter.use((request, response, next) => {
  if (['POST', 'PATCH', 'DELETE'].includes(request.method)) return requireSameOrigin(request, response, next);
  next();
});

studentClassroomsRouter.post('/join', asyncRoute(async (request, response) => {
  const { joinCode } = z.object({ joinCode: z.string().trim().min(6).max(32) }).strict().parse(request.body);
  const studentId = requireStudentId(request);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const classroom = await client.query<{ id: string; course_id: string }>(`
      SELECT c.id, c.course_id FROM classrooms c JOIN courses co ON co.id = c.course_id
      WHERE c.join_code = $1 AND c.status = 'active' AND co.status = 'published' FOR UPDATE OF c
    `, [joinCode.toUpperCase()]);
    if (!classroom.rows[0]) {
      await client.query('ROLLBACK');
      response.status(404).json({ error: 'This classroom code is invalid or no longer active.' });
      return;
    }
    const enrollment = await client.query(
      'INSERT INTO classroom_enrollments (classroom_id, student_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING classroom_id',
      [classroom.rows[0].id, studentId],
    );
    if (!enrollment.rows[0]) {
      await client.query('ROLLBACK');
      response.status(409).json({ error: 'You are already enrolled in this classroom.' });
      return;
    }
    await client.query('INSERT INTO course_enrollments (student_id, course_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [studentId, classroom.rows[0].course_id]);
    await client.query('COMMIT');
    response.status(201).json({ classroomId: classroom.rows[0].id });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}));

studentClassroomsRouter.get('/', asyncRoute(async (request, response) => {
  const result = await pool.query(`
    SELECT c.id, c.name, c.subject, c.section, c.description, c.course_id,
      co.title AS course_title, e.joined_at,
      (SELECT count(*)::int FROM classroom_posts p WHERE p.classroom_id = c.id AND p.status = 'published') AS post_count
    FROM classroom_enrollments e JOIN classrooms c ON c.id = e.classroom_id
    JOIN courses co ON co.id = c.course_id
    WHERE e.student_id = $1 AND c.status = 'active' AND co.status = 'published'
    ORDER BY c.name
  `, [requireStudentId(request)]);
  response.json({ classrooms: result.rows });
}));

async function requireClassroomEnrollment(classroomId: string, studentId: string) {
  const result = await pool.query<{ id: string }>(
    `SELECT c.id FROM classrooms c JOIN classroom_enrollments e ON e.classroom_id = c.id
     WHERE c.id = $1 AND c.status = 'active' AND e.student_id = $2`,
    [classroomId, studentId],
  );
  if (!result.rows[0]) throw Object.assign(new Error('Classroom not found or you are not enrolled.'), { status: 404 });
}

studentClassroomsRouter.get('/:classroomId/posts', asyncRoute(async (request, response) => {
  const classroomId = parseId(request.params.classroomId);
  await requireClassroomEnrollment(classroomId, requireStudentId(request));
  const result = await pool.query(`
    SELECT p.id, p.title, p.body, p.is_pinned, p.created_at,
      coalesce(json_agg(json_build_object(
        'id', cm.id, 'body', cm.body, 'created_at', cm.created_at, 'student_name', s.full_name
      ) ORDER BY cm.created_at) FILTER (WHERE cm.id IS NOT NULL), '[]'::json) AS comments
    FROM classroom_posts p
    LEFT JOIN classroom_comments cm ON cm.post_id = p.id
    LEFT JOIN students s ON s.id = cm.student_id
    WHERE p.classroom_id = $1 AND p.status = 'published'
    GROUP BY p.id ORDER BY p.is_pinned DESC, p.created_at DESC
  `, [classroomId]);
  response.json({ posts: result.rows });
}));

studentClassroomsRouter.post('/:classroomId/posts/:postId/comments', asyncRoute(async (request, response) => {
  const classroomId = parseId(request.params.classroomId);
  const postId = parseId(request.params.postId);
  const studentId = requireStudentId(request);
  const { body } = commentInput.parse(request.body);
  await requireClassroomEnrollment(classroomId, studentId);
  const post = await pool.query(
    `SELECT id FROM classroom_posts WHERE id = $1 AND classroom_id = $2 AND status = 'published'`,
    [postId, classroomId],
  );
  if (!post.rows[0]) {
    response.status(404).json({ error: 'Classroom announcement not found.' });
    return;
  }
  const result = await pool.query(
    'INSERT INTO classroom_comments (post_id, student_id, body) VALUES ($1,$2,$3) RETURNING id, body, created_at',
    [postId, studentId, body],
  );
  response.status(201).json({ comment: result.rows[0] });
}));

studentClassroomsRouter.get('/:classroomId/classwork', asyncRoute(async (request, response) => {
  const classroomId = parseId(request.params.classroomId);
  const studentId = requireStudentId(request);
  await requireClassroomEnrollment(classroomId, studentId);
  const [assignments, assessments, materials, links, liveClasses, topics] = await Promise.all([
    pool.query(`
      SELECT a.id, a.title, a.instructions, a.due_at, a.max_marks, a.classroom_topic_id,
        t.title AS topic_title, sub.id AS submission_id, sub.response_text, sub.status AS submission_status,
        sub.score, sub.feedback, sub.submitted_at, sub.reviewed_at
      FROM assignments a LEFT JOIN classroom_topics t ON t.id = a.classroom_topic_id
      LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id AND sub.student_id = $2
      WHERE a.classroom_id = $1 AND a.status = 'published'
      ORDER BY a.due_at NULLS LAST, a.created_at DESC
    `, [classroomId, studentId]),
    pool.query(`
      SELECT a.id, a.title, a.description, a.starts_at, a.ends_at, a.duration_minutes,
        a.classroom_topic_id, t.title AS topic_title,
        (SELECT count(*)::int FROM assessment_attempts at WHERE at.assessment_id = a.id AND at.student_id = $2) AS attempts,
        (SELECT at.score FROM assessment_attempts at WHERE at.assessment_id = a.id AND at.student_id = $2 AND at.submitted_at IS NOT NULL ORDER BY at.started_at DESC LIMIT 1) AS score,
        (SELECT at.total_marks FROM assessment_attempts at WHERE at.assessment_id = a.id AND at.student_id = $2 AND at.submitted_at IS NOT NULL ORDER BY at.started_at DESC LIMIT 1) AS total_marks,
        (SELECT at.feedback FROM assessment_attempts at WHERE at.assessment_id = a.id AND at.student_id = $2 AND at.submitted_at IS NOT NULL ORDER BY at.started_at DESC LIMIT 1) AS feedback
      FROM assessments a LEFT JOIN classroom_topics t ON t.id = a.classroom_topic_id
      WHERE a.classroom_id = $1 AND a.status = 'published'
        AND (a.starts_at IS NULL OR a.starts_at <= now()) AND (a.ends_at IS NULL OR a.ends_at > now())
      ORDER BY a.starts_at NULLS FIRST, a.created_at DESC
    `, [classroomId, studentId]),
    pool.query(`
      SELECT m.id, m.title, m.description, m.node_id, m.original_filename, m.mime_type,
        n.title AS lesson_title
      FROM learning_materials m
      LEFT JOIN courses c ON c.id = m.course_id
      LEFT JOIN course_nodes n ON n.id = m.node_id
      WHERE m.course_id = (SELECT course_id FROM classrooms WHERE id = $1)
        AND m.status = 'published' AND c.status = 'published'
      ORDER BY m.position, m.created_at DESC
    `, [classroomId]),
    pool.query(`
      SELECT r.id, r.title, r.description, r.external_url, r.topic_id, t.title AS topic_title
      FROM classroom_resources r LEFT JOIN classroom_topics t ON t.id = r.topic_id
      WHERE r.classroom_id = $1 AND r.status = 'published'
      ORDER BY r.created_at DESC
    `, [classroomId]),
    pool.query(`
      SELECT id, title, description, instructor, starts_at, ends_at, meeting_url, status
      FROM live_classes
      WHERE classroom_id = $1 AND status = 'scheduled' AND ends_at > now()
      ORDER BY starts_at
    `, [classroomId]),
    pool.query('SELECT id, title, position FROM classroom_topics WHERE classroom_id = $1 ORDER BY position, created_at', [classroomId]),
  ]);
  response.json({
    assignments: assignments.rows, assessments: assessments.rows, materials: materials.rows,
    links: links.rows, liveClasses: liveClasses.rows, topics: topics.rows,
  });
}));

studentClassroomsRouter.get('/:classroomId/grades', asyncRoute(async (request, response) => {
  const classroomId = parseId(request.params.classroomId);
  const studentId = requireStudentId(request);
  await requireClassroomEnrollment(classroomId, studentId);
  const [assignments, assessments] = await Promise.all([
    pool.query(`
      SELECT a.id, a.title, a.max_marks, sub.score, sub.feedback, sub.status, sub.submitted_at, sub.reviewed_at
      FROM assignments a LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id AND sub.student_id = $2
      WHERE a.classroom_id = $1 AND a.status = 'published' ORDER BY a.due_at NULLS LAST
    `, [classroomId, studentId]),
    pool.query(`
      SELECT a.id, a.title, at.score, at.total_marks, at.feedback, at.reviewed_at, at.submitted_at
      FROM assessments a LEFT JOIN LATERAL (
        SELECT * FROM assessment_attempts WHERE assessment_id = a.id AND student_id = $2
        ORDER BY started_at DESC LIMIT 1
      ) at ON true
      WHERE a.classroom_id = $1 AND a.status = 'published' ORDER BY a.starts_at NULLS LAST
    `, [classroomId, studentId]),
  ]);
  response.json({ assignments: assignments.rows, assessments: assessments.rows });
}));
