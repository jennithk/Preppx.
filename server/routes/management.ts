import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireManagement, requireSameOrigin } from '../auth.js';
import { pool } from '../db/pool.js';
import { asyncRoute, parseId, requireManagerId } from '../http.js';
import { deleteStoredMaterial, getMaterialDownloadUrl, materialUploadLimits, uploadLearningMaterial } from '../storage.js';
import { isValidCourseNodeTree, type CourseNodeSummary } from '../../shared/courseNodes.js';
import { SUPPORTED_SUBJECTS } from '../../shared/subjects.js';

const uuidSchema = z.string().uuid();
const subjectSchema = z.enum(SUPPORTED_SUBJECTS);
const httpUrlSchema = z.string().url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'Use an HTTP or HTTPS URL.');
const courseInputSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(8000).default(''),
  subject: subjectSchema,
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
}).strict();
const nodeInputSchema = z.object({
  parentId: uuidSchema.nullable().optional(),
  nodeType: z.enum(['subject', 'unit', 'topic', 'lesson']),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(8000).default(''),
  position: z.number().int().min(0).max(100_000).default(0),
}).strict();
const materialInputSchema = z.object({
  courseId: uuidSchema.nullable().optional(),
  nodeId: uuidSchema.nullable().optional(),
  subject: subjectSchema,
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(4000).default(''),
  position: z.coerce.number().int().min(0).max(100_000).default(0),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
}).strict();
const liveClassInputSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(5000).default(''),
  courseId: uuidSchema.nullable().optional(),
  subject: subjectSchema,
  instructor: z.string().trim().min(2).max(160),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  meetingUrl: httpUrlSchema.max(2000).nullable().optional(),
  status: z.enum(['scheduled', 'cancelled']).default('scheduled'),
}).strict().refine((value) => new Date(value.endsAt) > new Date(value.startsAt), { path: ['endsAt'], message: 'End time must be after start time.' });
const assignmentInputSchema = z.object({
  title: z.string().trim().min(2).max(180),
  instructions: z.string().trim().min(1).max(12000),
  courseId: uuidSchema.nullable().optional(),
  subject: subjectSchema,
  dueAt: z.string().datetime().nullable().optional(),
  maxMarks: z.number().positive().max(1_000_000).nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
}).strict();
const questionSchema = z.object({
  questionType: z.enum(['multiple_choice', 'short_answer', 'long_answer']),
  prompt: z.string().trim().min(1).max(5000),
  options: z.array(z.string().trim().min(1).max(1000)).max(12).default([]),
  correctOption: z.number().int().nonnegative().nullable().optional(),
  marks: z.number().nonnegative().max(1_000_000).default(1),
}).strict().refine((question) => question.questionType !== 'multiple_choice' || question.options.length >= 2, { path: ['options'], message: 'Multiple-choice questions need at least two options.' }).refine((question) => question.questionType !== 'multiple_choice' || question.correctOption === undefined || question.correctOption === null || question.correctOption < question.options.length, { path: ['correctOption'], message: 'The correct answer must match an available option.' }).refine((question) => question.questionType === 'multiple_choice' || question.correctOption === undefined || question.correctOption === null, { path: ['correctOption'], message: 'Subjective questions cannot have automatic answer keys.' });
const assessmentInputSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(6000).default(''),
  courseId: uuidSchema.nullable().optional(),
  subject: subjectSchema,
  durationMinutes: z.number().int().positive().max(1440).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  questions: z.array(questionSchema).min(1).max(300),
}).strict().refine((value) => !value.startsAt || !value.endsAt || new Date(value.endsAt) > new Date(value.startsAt), { path: ['endsAt'], message: 'End time must be after start time.' });
const announcementInputSchema = z.object({
  title: z.string().trim().min(2).max(180),
  body: z.string().trim().min(1).max(10_000),
  linkUrl: httpUrlSchema.max(2000).nullable().optional(),
  materialId: uuidSchema.nullable().optional(),
  courseId: uuidSchema.nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
}).strict();
const studentUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(160).optional(),
  phone: z.string().trim().max(32).optional(),
  rollNumber: z.string().trim().max(80).nullable().optional(),
  academicInfo: z.record(z.string(), z.unknown()).optional(),
}).strict();
const submissionReviewSchema = z.object({
  score: z.number().nonnegative().max(1_000_000).nullable(),
  feedback: z.string().trim().max(8000).default(''),
}).strict();
const assessmentReviewSchema = z.object({
  feedback: z.string().trim().max(8000).default(''),
  responses: z.array(z.object({
    questionId: uuidSchema,
    awardedMarks: z.number().nonnegative().max(1_000_000),
    feedback: z.string().trim().max(8000).default(''),
  }).strict()).max(300),
}).strict();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: materialUploadLimits.maxBytes, files: materialUploadLimits.maxFiles },
});

async function resolveCourseSubject(courseId: string | null | undefined, subject: string) {
  if (!courseId) return null;
  const result = await pool.query<{ id: string; subject: string; status: string }>(
    'SELECT id, subject, status FROM courses WHERE id = $1',
    [courseId],
  );
  const course = result.rows[0];
  if (!course || course.status === 'archived') {
    throw Object.assign(new Error('Select an available course.'), { status: 400 });
  }
  if (course.subject !== subject) {
    throw Object.assign(new Error('The selected course does not belong to the selected subject.'), { status: 400 });
  }
  return course.id;
}

async function validateLinkedCourse(
  table: 'live_classes' | 'assignments' | 'assessments',
  id: string,
  courseId: string | null | undefined,
  subject: string | undefined,
) {
  const current = await pool.query<{ course_id: string | null; subject: string }>(
    `SELECT course_id, subject FROM ${table} WHERE id = $1`,
    [id],
  );
  if (!current.rows[0]) {
    throw Object.assign(new Error('The selected record no longer exists.'), { status: 404 });
  }
  await resolveCourseSubject(
    courseId === undefined ? current.rows[0].course_id : courseId,
    subject ?? current.rows[0].subject,
  );
}

async function validateAnnouncementCourse(id: string | null | undefined) {
  if (!id) return;
  const result = await pool.query('SELECT id, status FROM courses WHERE id = $1', [id]);
  if (!result.rows[0] || result.rows[0].status === 'archived') {
    throw Object.assign(new Error('Select an available course for this announcement.'), { status: 400 });
  }
}

async function resolveMaterialCourse(subject: string, courseId: string | null | undefined, nodeId: string | null | undefined) {
  const resolvedCourseId = await resolveCourseSubject(courseId, subject);
  if (!nodeId) return resolvedCourseId;
  const node = await pool.query<{ id: string; course_id: string; node_type: string }>(
    'SELECT id, course_id, node_type FROM course_nodes WHERE id = $1',
    [nodeId],
  );
  if (!node.rows[0]) throw Object.assign(new Error('The selected topic or lesson no longer exists.'), { status: 400 });
  if (resolvedCourseId && node.rows[0].course_id !== resolvedCourseId) {
    throw Object.assign(new Error('The selected topic or lesson belongs to a different course.'), { status: 400 });
  }
  if (!['topic', 'lesson'].includes(node.rows[0].node_type)) {
    throw Object.assign(new Error('Materials can only be attached to a topic or lesson.'), { status: 400 });
  }
  const resolvedNodeCourse = await resolveCourseSubject(node.rows[0].course_id, subject);
  const courseNodes = await pool.query<CourseNodeSummary>(
    'SELECT id, course_id, parent_id, node_type, title FROM course_nodes WHERE course_id = $1',
    [resolvedNodeCourse],
  );
  if (!isValidCourseNodeTree(courseNodes.rows)) {
    throw Object.assign(new Error('The selected course has an invalid learning sequence. Correct its Subject → Unit → Topic → Lesson hierarchy before attaching materials.'), { status: 409 });
  }
  return node.rows[0].course_id;
}

export const managementRouter = Router();
managementRouter.use(requireManagement);
managementRouter.use((request, response, next) => {
  if (['POST', 'PATCH', 'DELETE'].includes(request.method)) return requireSameOrigin(request, response, next);
  next();
});

managementRouter.get('/overview', asyncRoute(async (_request, response) => {
  const [counts, engagement, progress, recent] = await Promise.all([
    pool.query(`
      SELECT
        (SELECT count(*)::int FROM students) AS students,
        (SELECT count(*)::int FROM courses WHERE status = 'published') AS courses,
        (SELECT count(*)::int FROM learning_materials m
         LEFT JOIN courses c ON c.id = m.course_id
         WHERE m.status = 'published' AND (m.course_id IS NULL OR c.status = 'published')) AS materials,
        (SELECT count(*)::int FROM live_classes WHERE status = 'scheduled' AND starts_at >= now()) AS upcoming_classes,
        (SELECT count(*)::int FROM assignments WHERE status = 'published') AS assignments,
        (SELECT count(*)::int FROM assessments WHERE status = 'published') AS assessments
    `),
    pool.query(`
      SELECT
        count(DISTINCT student_id) FILTER (WHERE occurred_at >= now() - interval '30 days')::int AS active_students,
        count(*) FILTER (WHERE activity_type = 'assignment_submitted' AND occurred_at >= now() - interval '30 days')::int AS recent_submissions,
        count(*) FILTER (WHERE activity_type = 'assessment_attempted' AND occurred_at >= now() - interval '30 days')::int AS recent_assessment_attempts
      FROM learning_activity
    `),
    pool.query(`
      WITH enrolled_lessons AS (
        SELECT e.student_id, e.course_id, count(n.id)::numeric AS total
        FROM course_enrollments e
        JOIN courses c ON c.id = e.course_id AND c.status = 'published'
        LEFT JOIN course_nodes n ON n.course_id = c.id AND n.node_type = 'lesson'
        GROUP BY e.student_id, e.course_id
      ), completed_lessons AS (
        SELECT student_id, course_id, count(DISTINCT node_id)::numeric AS completed
        FROM learning_activity
        WHERE activity_type = 'lesson_completed' AND course_id IS NOT NULL AND node_id IS NOT NULL
        GROUP BY student_id, course_id
      )
      SELECT round(avg(CASE WHEN total = 0 THEN 0 ELSE least(100, coalesce(completed, 0) / total * 100) END))::int AS average_completion
      FROM enrolled_lessons LEFT JOIN completed_lessons USING (student_id, course_id)
    `),
    pool.query(`
      SELECT a.id, a.activity_type, a.subject, a.occurred_at, s.full_name AS student_name,
             c.title AS course_title, n.title AS lesson_title
      FROM learning_activity a
      JOIN students s ON s.id = a.student_id
      LEFT JOIN courses c ON c.id = a.course_id
      LEFT JOIN course_nodes n ON n.id = a.node_id
      ORDER BY a.occurred_at DESC
      LIMIT 8
    `),
  ]);
  response.json({
    counts: counts.rows[0],
    engagement: engagement.rows[0],
    averageCompletion: progress.rows[0]?.average_completion ?? null,
    recentActivity: recent.rows,
  });
}));

managementRouter.get('/students', asyncRoute(async (request, response) => {
  const search = typeof request.query.q === 'string' ? request.query.q.trim().slice(0, 100) : '';
  const page = Math.max(1, Math.min(10_000, Number(request.query.page) || 1));
  const pageSize = Math.max(1, Math.min(100, Number(request.query.pageSize) || 25));
  const sortBy = typeof request.query.sort === 'string' ? request.query.sort : 'name';
  const orderBy = {
    name: 's.full_name ASC',
    newest: 's.created_at DESC, s.full_name ASC',
    xp: 'total_xp DESC, s.full_name ASC',
  }[sortBy] ?? 's.full_name ASC';
  const result = await pool.query(`
    SELECT s.id, s.full_name, s.email, s.phone, s.roll_number, s.academic_info, s.created_at,
           count(DISTINCT e.course_id)::int AS enrolled_courses,
           count(DISTINCT a.id) FILTER (WHERE a.occurred_at >= now() - interval '30 days')::int AS recent_activities,
           coalesce(x.total_xp, 0)::int AS total_xp
    FROM students s
    LEFT JOIN course_enrollments e ON e.student_id = s.id
    LEFT JOIN learning_activity a ON a.student_id = s.id
    LEFT JOIN student_xp x ON x.student_id = s.id
    WHERE ($1 = '' OR s.full_name ILIKE '%' || $1 || '%' OR s.email ILIKE '%' || $1 || '%' OR coalesce(s.roll_number, '') ILIKE '%' || $1 || '%')
    GROUP BY s.id, x.total_xp
    ORDER BY ${orderBy}
    LIMIT $2 OFFSET $3
  `, [search, pageSize, (page - 1) * pageSize]);
  const total = await pool.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM students WHERE ($1 = '' OR full_name ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%' OR coalesce(roll_number, '') ILIKE '%' || $1 || '%')`,
    [search],
  );
  response.json({ students: result.rows, page, pageSize, total: total.rows[0]?.count ?? 0 });
}));

managementRouter.get('/students/:studentId', asyncRoute(async (request, response) => {
  const studentId = parseId(request.params.studentId);
  const [profile, courses, activity, attempts, submissions, xp] = await Promise.all([
    pool.query('SELECT id, email, full_name, phone, roll_number, academic_info, created_at, updated_at FROM students WHERE id = $1', [studentId]),
    pool.query(`
      SELECT c.id, c.title, c.subject, e.enrolled_at,
        count(DISTINCT n.id) FILTER (WHERE n.node_type = 'lesson')::int AS lessons_total,
        count(DISTINCT la.node_id) FILTER (WHERE la.activity_type = 'lesson_completed')::int AS lessons_completed
      FROM course_enrollments e JOIN courses c ON c.id = e.course_id
      LEFT JOIN course_nodes n ON n.course_id = c.id
      LEFT JOIN learning_activity la ON la.student_id = e.student_id AND la.course_id = e.course_id
      WHERE e.student_id = $1
      GROUP BY c.id, e.enrolled_at ORDER BY e.enrolled_at DESC
    `, [studentId]),
    pool.query(`
      SELECT a.id, a.activity_type, a.subject, a.occurred_at, c.title AS course_title, n.title AS lesson_title
      FROM learning_activity a LEFT JOIN courses c ON c.id = a.course_id LEFT JOIN course_nodes n ON n.id = a.node_id
      WHERE a.student_id = $1 ORDER BY a.occurred_at DESC LIMIT 100
    `, [studentId]),
    pool.query(`
      SELECT at.id, a.title, a.subject, at.score, at.total_marks, at.started_at, at.submitted_at
      FROM assessment_attempts at JOIN assessments a ON a.id = at.assessment_id
      WHERE at.student_id = $1 ORDER BY at.started_at DESC LIMIT 100
    `, [studentId]),
    pool.query(`
      SELECT sub.id, a.title, a.subject, sub.status, sub.score, a.max_marks, sub.feedback, sub.submitted_at, sub.reviewed_at
      FROM assignment_submissions sub JOIN assignments a ON a.id = sub.assignment_id
      WHERE sub.student_id = $1 ORDER BY sub.submitted_at DESC LIMIT 100
    `, [studentId]),
    pool.query('SELECT coalesce(total_xp, 0)::int AS total_xp FROM student_xp WHERE student_id = $1', [studentId]),
  ]);
  if (!profile.rows[0]) {
    response.status(404).json({ error: 'Student record not found.' });
    return;
  }
  response.json({
    student: profile.rows[0],
    courses: courses.rows,
    activity: activity.rows,
    assessmentAttempts: attempts.rows,
    assignmentSubmissions: submissions.rows,
    xp: xp.rows[0]?.total_xp ?? 0,
  });
}));

managementRouter.patch('/students/:studentId', asyncRoute(async (request, response) => {
  const studentId = parseId(request.params.studentId);
  const changes = studentUpdateSchema.parse(request.body);
  const fields: string[] = [];
  const values: unknown[] = [];
  const add = (column: string, value: unknown) => { values.push(value); fields.push(`${column} = $${values.length}`); };
  if (changes.fullName !== undefined) add('full_name', changes.fullName);
  if (changes.phone !== undefined) add('phone', changes.phone);
  if (changes.rollNumber !== undefined) add('roll_number', changes.rollNumber);
  if (changes.academicInfo !== undefined) add('academic_info', JSON.stringify(changes.academicInfo));
  if (!fields.length) {
    response.status(400).json({ error: 'No editable student information was supplied.' });
    return;
  }
  values.push(studentId);
  const result = await pool.query(
    `UPDATE students SET ${fields.join(', ')}, updated_at = now() WHERE id = $${values.length}
     RETURNING id, email, full_name, phone, roll_number, academic_info, updated_at`,
    values,
  );
  if (!result.rows[0]) {
    response.status(404).json({ error: 'Student record not found.' });
    return;
  }
  response.json({ student: result.rows[0] });
}));

managementRouter.get('/courses', asyncRoute(async (_request, response) => {
  const result = await pool.query(`
    SELECT c.id, c.title, c.description, c.subject, c.status, c.created_at, c.updated_at,
           count(DISTINCT e.student_id)::int AS enrollments,
           count(DISTINCT n.id) FILTER (WHERE n.node_type = 'lesson')::int AS lessons
    FROM courses c LEFT JOIN course_enrollments e ON e.course_id = c.id
    LEFT JOIN course_nodes n ON n.course_id = c.id
    GROUP BY c.id ORDER BY c.updated_at DESC
  `);
  response.json({ courses: result.rows });
}));

managementRouter.post('/courses', asyncRoute(async (request, response) => {
  const course = courseInputSchema.parse(request.body);
  const result = await pool.query(
    `INSERT INTO courses (title, description, subject, status, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [course.title, course.description, course.subject, course.status, requireManagerId(request)],
  );
  response.status(201).json({ course: result.rows[0] });
}));

managementRouter.patch('/courses/:courseId', asyncRoute(async (request, response) => {
  const courseId = parseId(request.params.courseId);
  const changes = courseInputSchema.partial().parse(request.body);
  const entries = Object.entries({
    title: changes.title,
    description: changes.description,
    subject: changes.subject,
    status: changes.status,
  }).filter(([, value]) => value !== undefined);
  if (!entries.length) {
    response.status(400).json({ error: 'No course changes were supplied.' });
    return;
  }
  if (changes.subject !== undefined) {
    const linked = await pool.query<{ linked: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM course_nodes WHERE course_id = $1
        UNION ALL SELECT 1 FROM learning_materials WHERE course_id = $1
        UNION ALL SELECT 1 FROM assignments WHERE course_id = $1
        UNION ALL SELECT 1 FROM assessments WHERE course_id = $1
        UNION ALL SELECT 1 FROM live_classes WHERE course_id = $1
        UNION ALL SELECT 1 FROM announcements WHERE course_id = $1
        UNION ALL SELECT 1 FROM course_enrollments WHERE course_id = $1
      ) AS linked
    `, [courseId]);
    if (linked.rows[0]?.linked) {
      throw Object.assign(new Error('A course subject cannot be changed after learning content or student activity has been linked to it.'), { status: 409 });
    }
  }
  const columns = { title: 'title', description: 'description', subject: 'subject', status: 'status' } as const;
  const values = entries.map(([, value]) => value);
  const assignments = entries.map(([key], index) => `${columns[key as keyof typeof columns]} = $${index + 1}`);
  values.push(courseId);
  const result = await pool.query(
    `UPDATE courses SET ${assignments.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
    values,
  );
  if (!result.rows[0]) {
    response.status(404).json({ error: 'Course not found.' });
    return;
  }
  response.json({ course: result.rows[0] });
}));

managementRouter.delete('/courses/:courseId', asyncRoute(async (request, response) => {
  const result = await pool.query(
    `UPDATE courses SET status = 'archived', updated_at = now() WHERE id = $1 AND status <> 'archived' RETURNING id`,
    [parseId(request.params.courseId)],
  );
  if (!result.rows[0]) {
    response.status(404).json({ error: 'Course not found or already archived.' });
    return;
  }
  response.status(204).end();
}));

managementRouter.get('/courses/:courseId/nodes', asyncRoute(async (request, response) => {
  const result = await pool.query(
    `SELECT id, course_id, parent_id, node_type, title, description, position
     FROM course_nodes WHERE course_id = $1 ORDER BY position ASC, created_at ASC`,
    [parseId(request.params.courseId)],
  );
  response.json({ nodes: result.rows });
}));

managementRouter.post('/courses/:courseId/nodes', asyncRoute(async (request, response) => {
  const courseId = parseId(request.params.courseId);
  const node = nodeInputSchema.parse(request.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const course = await client.query('SELECT id, subject FROM courses WHERE id = $1 AND status <> $2 FOR UPDATE', [courseId, 'archived']);
    if (!course.rows[0]) {
      await client.query('ROLLBACK');
      response.status(404).json({ error: 'Available course not found.' });
      return;
    }
    if (node.nodeType === 'subject' && node.title !== course.rows[0].subject) {
      await client.query('ROLLBACK');
      response.status(400).json({ error: 'A subject node must use the course subject name.' });
      return;
    }
    const existing = await client.query<CourseNodeSummary>(
      'SELECT id, course_id, parent_id, node_type, title FROM course_nodes WHERE course_id = $1 FOR UPDATE',
      [courseId],
    );
    const candidate: CourseNodeSummary = {
      id: '__new_node__', course_id: courseId, parent_id: node.parentId ?? null,
      node_type: node.nodeType, title: node.title,
    };
    if (!isValidCourseNodeTree([...existing.rows, candidate])) {
      await client.query('ROLLBACK');
      response.status(400).json({ error: 'Use the learning order Subject → Unit → Topic → Lesson, and choose a parent from this course.' });
      return;
    }
    const result = await client.query(
      `INSERT INTO course_nodes (course_id, parent_id, node_type, title, description, position)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [courseId, node.parentId ?? null, node.nodeType, node.title, node.description, node.position],
    );
    await client.query('COMMIT');
    response.status(201).json({ node: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}));

managementRouter.patch('/courses/:courseId/nodes/:nodeId', asyncRoute(async (request, response) => {
  const courseId = parseId(request.params.courseId);
  const nodeId = parseId(request.params.nodeId);
  const node = nodeInputSchema.partial().parse(request.body);
  const columnMap = { parentId: 'parent_id', nodeType: 'node_type', title: 'title', description: 'description', position: 'position' } as const;
  const entries = Object.entries(node).filter(([, value]) => value !== undefined);
  if (!entries.length) {
    response.status(400).json({ error: 'No topic changes were supplied.' });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const course = await client.query('SELECT id, subject FROM courses WHERE id = $1 AND status <> $2 FOR UPDATE', [courseId, 'archived']);
    if (!course.rows[0]) {
      await client.query('ROLLBACK');
      response.status(404).json({ error: 'Available course not found.' });
      return;
    }
    const existing = await client.query<CourseNodeSummary>(
      'SELECT id, course_id, parent_id, node_type, title FROM course_nodes WHERE course_id = $1 FOR UPDATE',
      [courseId],
    );
    const original = existing.rows.find((item) => item.id === nodeId);
    if (!original) {
      await client.query('ROLLBACK');
      response.status(404).json({ error: 'Course topic not found.' });
      return;
    }
    const candidate: CourseNodeSummary = {
      ...original,
      parent_id: node.parentId === undefined ? original.parent_id : node.parentId,
      node_type: node.nodeType ?? original.node_type,
      title: node.title ?? original.title,
    };
    if (candidate.node_type === 'subject' && candidate.title !== course.rows[0].subject) {
      await client.query('ROLLBACK');
      response.status(400).json({ error: 'A subject node must use the course subject name.' });
      return;
    }
    const proposed = existing.rows.map((item) => item.id === nodeId ? candidate : item);
    if (!isValidCourseNodeTree(proposed)) {
      await client.query('ROLLBACK');
      response.status(400).json({ error: 'The change would break the Subject → Unit → Topic → Lesson hierarchy or create a cycle.' });
      return;
    }
    const values = entries.map(([, value]) => value);
    const assignments = entries.map(([key], index) => `${columnMap[key as keyof typeof columnMap]} = $${index + 1}`);
    values.push(courseId, nodeId);
    const result = await client.query(
      `UPDATE course_nodes SET ${assignments.join(', ')}, updated_at = now() WHERE course_id = $${values.length - 1} AND id = $${values.length} RETURNING *`,
      values,
    );
    await client.query('COMMIT');
    response.json({ node: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}));

managementRouter.delete('/courses/:courseId/nodes/:nodeId', asyncRoute(async (request, response) => {
  const result = await pool.query(
    'DELETE FROM course_nodes WHERE course_id = $1 AND id = $2 RETURNING id',
    [parseId(request.params.courseId), parseId(request.params.nodeId)],
  );
  if (!result.rows[0]) {
    response.status(404).json({ error: 'Course topic not found.' });
    return;
  }
  response.status(204).end();
}));

managementRouter.get('/materials', asyncRoute(async (_request, response) => {
  const result = await pool.query(`
    SELECT m.id, m.course_id, m.node_id, m.subject, m.title, m.description, m.original_filename,
           m.mime_type, m.file_size, m.position, m.status, m.created_at,
           c.title AS course_title, n.title AS topic_title
    FROM learning_materials m
    LEFT JOIN courses c ON c.id = m.course_id
    LEFT JOIN course_nodes n ON n.id = m.node_id
    WHERE m.status <> 'archived'
    ORDER BY m.course_id NULLS LAST, m.position ASC, m.created_at DESC
  `);
  response.json({ materials: result.rows });
}));

managementRouter.post('/materials', upload.single('file'), asyncRoute(async (request, response) => {
  if (!request.file) {
    response.status(400).json({ error: 'Choose a material file to upload.' });
    return;
  }
  const input = materialInputSchema.parse(request.body);
  const courseId = await resolveMaterialCourse(input.subject, input.courseId, input.nodeId);
  const uploaded = await uploadLearningMaterial(request.file);
  try {
    const result = await pool.query(
      `INSERT INTO learning_materials
       (course_id, node_id, subject, title, description, object_key, original_filename, mime_type, file_size, position, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id, title, subject, status, created_at`,
      [courseId, input.nodeId ?? null, input.subject, input.title, input.description, uploaded.key, uploaded.originalFilename, uploaded.mimeType, uploaded.fileSize, input.position, input.status, requireManagerId(request)],
    );
    response.status(201).json({ material: result.rows[0] });
  } catch (error) {
    await deleteStoredMaterial(uploaded.key);
    throw error;
  }
}));

managementRouter.patch('/materials/:materialId', asyncRoute(async (request, response) => {
  const materialId = parseId(request.params.materialId);
  const input = materialInputSchema.partial().parse(request.body);
  const columnMap = { courseId: 'course_id', nodeId: 'node_id', subject: 'subject', title: 'title', description: 'description', position: 'position', status: 'status' } as const;
  const hasRelationChange = input.courseId !== undefined || input.nodeId !== undefined || input.subject !== undefined;
  let relation: { courseId: string | null; nodeId: string | null } | undefined;
  if (hasRelationChange) {
    const current = await pool.query<{ course_id: string | null; node_id: string | null; subject: string }>(
      'SELECT course_id, node_id, subject FROM learning_materials WHERE id = $1',
      [materialId],
    );
    if (!current.rows[0]) {
      response.status(404).json({ error: 'Learning material not found.' });
      return;
    }
    const courseId = input.courseId === undefined ? current.rows[0].course_id : input.courseId;
    const nodeId = input.nodeId === undefined ? current.rows[0].node_id : input.nodeId;
    const subject = input.subject ?? current.rows[0].subject;
    relation = { courseId: await resolveMaterialCourse(subject, courseId, nodeId), nodeId };
  }
  const changes = relation ? { ...input, courseId: relation.courseId, nodeId: relation.nodeId } : input;
  const entries = Object.entries(changes).filter(([, value]) => value !== undefined);
  if (!entries.length) {
    response.status(400).json({ error: 'No material changes were supplied.' });
    return;
  }
  const values = entries.map(([, value]) => value);
  const assignments = entries.map(([key], index) => `${columnMap[key as keyof typeof columnMap]} = $${index + 1}`);
  values.push(materialId);
  const result = await pool.query(
    `UPDATE learning_materials SET ${assignments.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING id, course_id, node_id, subject, title, description, original_filename, mime_type, file_size, status`,
    values,
  );
  if (!result.rows[0]) {
    response.status(404).json({ error: 'Learning material not found.' });
    return;
  }
  response.json({ material: result.rows[0] });
}));

managementRouter.post('/materials/:materialId/file', upload.single('file'), asyncRoute(async (request, response) => {
  const materialId = parseId(request.params.materialId);
  if (!request.file) {
    response.status(400).json({ error: 'Choose a replacement file to upload.' });
    return;
  }
  const uploaded = await uploadLearningMaterial(request.file);
  const client = await pool.connect();
  let oldKey: string | null = null;
  try {
    await client.query('BEGIN');
    const old = await client.query<{ object_key: string }>('SELECT object_key FROM learning_materials WHERE id = $1 FOR UPDATE', [materialId]);
    if (!old.rows[0]) {
      await client.query('ROLLBACK');
      await deleteStoredMaterial(uploaded.key);
      response.status(404).json({ error: 'Learning material not found.' });
      return;
    }
    oldKey = old.rows[0].object_key;
    const updated = await client.query(
      `UPDATE learning_materials SET object_key = $1, original_filename = $2, mime_type = $3, file_size = $4, updated_at = now()
       WHERE id = $5 RETURNING id, title, original_filename, mime_type, file_size`,
      [uploaded.key, uploaded.originalFilename, uploaded.mimeType, uploaded.fileSize, materialId],
    );
    await client.query('COMMIT');
    if (!updated.rows[0]) throw new Error('The material replacement did not update a record.');
    try {
      await deleteStoredMaterial(oldKey);
      response.json({ material: updated.rows[0] });
    } catch (cleanupError) {
      console.error('PREPPX replaced a material but could not remove its previous stored file', cleanupError);
      response.json({ material: updated.rows[0], warning: 'The new file was saved, but the previous file could not be removed.' });
    }
  } catch (error) {
    await client.query('ROLLBACK').catch((rollbackError: unknown) => console.error('Could not roll back material replacement', rollbackError));
    try {
      await deleteStoredMaterial(uploaded.key);
    } catch (cleanupError) {
      console.error('Could not remove the uncommitted replacement file', cleanupError);
    }
    throw error;
  } finally {
    client.release();
  }
}));

managementRouter.get('/materials/:materialId/download', asyncRoute(async (request, response) => {
  const result = await pool.query<{ object_key: string; original_filename: string }>(
    'SELECT object_key, original_filename FROM learning_materials WHERE id = $1 AND status <> $2',
    [parseId(request.params.materialId), 'archived'],
  );
  if (!result.rows[0]) {
    response.status(404).json({ error: 'Learning material not found.' });
    return;
  }
  response.json({ url: await getMaterialDownloadUrl(result.rows[0].object_key), filename: result.rows[0].original_filename });
}));

managementRouter.delete('/materials/:materialId', asyncRoute(async (request, response) => {
  const materialId = parseId(request.params.materialId);
  const material = await pool.query<{ object_key: string }>(
    `UPDATE learning_materials SET status = 'archived', updated_at = now()
     WHERE id = $1 AND status <> 'archived' RETURNING object_key`,
    [materialId],
  );
  if (!material.rows[0]) {
    response.status(404).json({ error: 'Learning material not found.' });
    return;
  }
  try {
    await deleteStoredMaterial(material.rows[0].object_key);
  } catch (error) {
    console.error('PREPPX archived a material but could not remove its stored file', error);
    response.json({ warning: 'The material was archived, but its stored file could not be removed.' });
    return;
  }
  response.status(204).end();
}));

managementRouter.get('/live-classes', asyncRoute(async (_request, response) => {
  const result = await pool.query(`
    SELECT s.*, c.title AS course_title FROM live_classes s
    LEFT JOIN courses c ON c.id = s.course_id
    ORDER BY s.starts_at DESC LIMIT 500
  `);
  response.json({ liveClasses: result.rows });
}));

managementRouter.post('/live-classes', asyncRoute(async (request, response) => {
  const item = liveClassInputSchema.parse(request.body);
  await resolveCourseSubject(item.courseId, item.subject);
  const result = await pool.query(
    `INSERT INTO live_classes (title, description, course_id, subject, instructor, starts_at, ends_at, meeting_url, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [item.title, item.description, item.courseId ?? null, item.subject, item.instructor, item.startsAt, item.endsAt, item.meetingUrl ?? null, item.status, requireManagerId(request)],
  );
  response.status(201).json({ liveClass: result.rows[0] });
}));

managementRouter.patch('/live-classes/:classId', asyncRoute(async (request, response) => {
  const classId = parseId(request.params.classId);
  const item = liveClassInputSchema.partial().parse(request.body);
  await validateLinkedCourse('live_classes', classId, item.courseId, item.subject);
  const map = { title: 'title', description: 'description', courseId: 'course_id', subject: 'subject', instructor: 'instructor', startsAt: 'starts_at', endsAt: 'ends_at', meetingUrl: 'meeting_url', status: 'status' } as const;
  const entries = Object.entries(item).filter(([, value]) => value !== undefined);
  if (!entries.length) {
    response.status(400).json({ error: 'No live-class changes were supplied.' });
    return;
  }
  const values = entries.map(([, value]) => value);
  const fields = entries.map(([key], index) => `${map[key as keyof typeof map]} = $${index + 1}`);
  values.push(classId);
  const result = await pool.query(`UPDATE live_classes SET ${fields.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`, values);
  if (!result.rows[0]) {
    response.status(404).json({ error: 'Live class not found.' });
    return;
  }
  response.json({ liveClass: result.rows[0] });
}));

managementRouter.post('/live-classes/:classId/cancel', asyncRoute(async (request, response) => {
  const result = await pool.query(`UPDATE live_classes SET status = 'cancelled', updated_at = now() WHERE id = $1 RETURNING id`, [parseId(request.params.classId)]);
  if (!result.rows[0]) {
    response.status(404).json({ error: 'Live class not found.' });
    return;
  }
  response.status(204).end();
}));

managementRouter.get('/assignments', asyncRoute(async (_request, response) => {
  const result = await pool.query(`
    SELECT a.*, c.title AS course_title,
      count(s.id)::int AS submissions,
      count(s.id) FILTER (WHERE s.status = 'reviewed')::int AS reviewed
    FROM assignments a LEFT JOIN courses c ON c.id = a.course_id
    LEFT JOIN assignment_submissions s ON s.assignment_id = a.id
    GROUP BY a.id, c.title ORDER BY a.created_at DESC
  `);
  response.json({ assignments: result.rows });
}));

managementRouter.post('/assignments', asyncRoute(async (request, response) => {
  const item = assignmentInputSchema.parse(request.body);
  await resolveCourseSubject(item.courseId, item.subject);
  const result = await pool.query(
    `INSERT INTO assignments (title, instructions, course_id, subject, due_at, max_marks, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [item.title, item.instructions, item.courseId ?? null, item.subject, item.dueAt ?? null, item.maxMarks ?? null, item.status, requireManagerId(request)],
  );
  response.status(201).json({ assignment: result.rows[0] });
}));

managementRouter.patch('/assignments/:assignmentId', asyncRoute(async (request, response) => {
  const assignmentId = parseId(request.params.assignmentId);
  const item = assignmentInputSchema.partial().parse(request.body);
  await validateLinkedCourse('assignments', assignmentId, item.courseId, item.subject);
  const map = { title: 'title', instructions: 'instructions', courseId: 'course_id', subject: 'subject', dueAt: 'due_at', maxMarks: 'max_marks', status: 'status' } as const;
  const entries = Object.entries(item).filter(([, value]) => value !== undefined);
  if (!entries.length) {
    response.status(400).json({ error: 'No assignment changes were supplied.' });
    return;
  }
  const values = entries.map(([, value]) => value);
  const fields = entries.map(([key], index) => `${map[key as keyof typeof map]} = $${index + 1}`);
  values.push(assignmentId);
  const result = await pool.query(`UPDATE assignments SET ${fields.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`, values);
  if (!result.rows[0]) {
    response.status(404).json({ error: 'Assignment not found.' });
    return;
  }
  response.json({ assignment: result.rows[0] });
}));

managementRouter.get('/assignments/:assignmentId/submissions', asyncRoute(async (request, response) => {
  const result = await pool.query(`
    SELECT sub.id, sub.response_text, sub.attachment_key, sub.attachment_filename, sub.status, sub.score, sub.feedback, sub.submitted_at, sub.reviewed_at,
           s.id AS student_id, s.full_name, s.email, s.roll_number, a.max_marks
    FROM assignment_submissions sub JOIN students s ON s.id = sub.student_id
    JOIN assignments a ON a.id = sub.assignment_id
    WHERE sub.assignment_id = $1 ORDER BY sub.submitted_at DESC
  `, [parseId(request.params.assignmentId)]);
  response.json({ submissions: result.rows });
}));

managementRouter.get('/submissions/:submissionId/attachment', asyncRoute(async (request, response) => {
  const result = await pool.query<{ attachment_key: string | null; attachment_filename: string }>(
    'SELECT attachment_key, attachment_filename FROM assignment_submissions WHERE id = $1',
    [parseId(request.params.submissionId)],
  );
  const submission = result.rows[0];
  if (!submission?.attachment_key) {
    response.status(404).json({ error: 'This submission has no downloadable attachment.' });
    return;
  }
  response.json({
    url: await getMaterialDownloadUrl(submission.attachment_key),
    filename: submission.attachment_filename,
  });
}));

managementRouter.patch('/submissions/:submissionId/review', asyncRoute(async (request, response) => {
  const submissionId = parseId(request.params.submissionId);
  const review = submissionReviewSchema.parse(request.body);
  const result = await pool.query(`
    UPDATE assignment_submissions sub SET score = $1, feedback = $2, status = 'reviewed', reviewed_at = now()
    FROM assignments a WHERE sub.id = $3 AND sub.assignment_id = a.id
      AND ($1::numeric IS NULL OR a.max_marks IS NULL OR $1 <= a.max_marks)
    RETURNING sub.id, sub.status, sub.score, sub.feedback, sub.reviewed_at
  `, [review.score, review.feedback, submissionId]);
  if (!result.rows[0]) {
    response.status(404).json({ error: 'Submission not found, or the score exceeds the assignment marks.' });
    return;
  }
  response.json({ submission: result.rows[0] });
}));

managementRouter.get('/assessments', asyncRoute(async (_request, response) => {
  const result = await pool.query(`
    SELECT a.*, c.title AS course_title, count(DISTINCT q.id)::int AS questions,
      count(DISTINCT at.id)::int AS attempts,
      round(avg(at.score) FILTER (WHERE at.submitted_at IS NOT NULL), 1) AS average_score
    FROM assessments a LEFT JOIN courses c ON c.id = a.course_id
    LEFT JOIN assessment_questions q ON q.assessment_id = a.id
    LEFT JOIN assessment_attempts at ON at.assessment_id = a.id
    GROUP BY a.id, c.title ORDER BY a.created_at DESC
  `);
  response.json({ assessments: result.rows });
}));

managementRouter.post('/assessments', asyncRoute(async (request, response) => {
  const item = assessmentInputSchema.parse(request.body);
  await resolveCourseSubject(item.courseId, item.subject);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = await client.query(
      `INSERT INTO assessments (title, description, course_id, subject, duration_minutes, starts_at, ends_at, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [item.title, item.description, item.courseId ?? null, item.subject, item.durationMinutes ?? null, item.startsAt ?? null, item.endsAt ?? null, item.status, requireManagerId(request)],
    );
    const assessment = created.rows[0];
    for (const [position, question] of item.questions.entries()) {
      await client.query(
        `INSERT INTO assessment_questions (assessment_id, question_type, prompt, options, correct_option, marks, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [assessment.id, question.questionType, question.prompt, JSON.stringify(question.options), question.correctOption ?? null, question.marks, position],
      );
    }
    await client.query('COMMIT');
    response.status(201).json({ assessment, questionCount: item.questions.length });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

managementRouter.patch('/assessments/:assessmentId', asyncRoute(async (request, response) => {
  const assessmentId = parseId(request.params.assessmentId);
  const item = assessmentInputSchema.partial().parse(request.body);
  await validateLinkedCourse('assessments', assessmentId, item.courseId, item.subject);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const map = { title: 'title', description: 'description', courseId: 'course_id', subject: 'subject', durationMinutes: 'duration_minutes', startsAt: 'starts_at', endsAt: 'ends_at', status: 'status' } as const;
    const entries = Object.entries(item).filter(([key, value]) => key !== 'questions' && value !== undefined);
    let updated = null;
    if (entries.length) {
      const values = entries.map(([, value]) => value);
      const fields = entries.map(([key], index) => `${map[key as keyof typeof map]} = $${index + 1}`);
      values.push(assessmentId);
      const result = await client.query(`UPDATE assessments SET ${fields.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`, values);
      updated = result.rows[0] ?? null;
    }
    if (item.questions) {
      const assessment = await client.query('SELECT id FROM assessments WHERE id = $1 FOR UPDATE', [assessmentId]);
      if (!assessment.rows[0]) {
        await client.query('ROLLBACK');
        response.status(404).json({ error: 'Assessment not found.' });
        return;
      }
      const hasAttempts = await client.query('SELECT 1 FROM assessment_attempts WHERE assessment_id = $1 LIMIT 1', [assessmentId]);
      if (hasAttempts.rows[0]) {
        await client.query('ROLLBACK');
        response.status(409).json({ error: 'Questions cannot be changed after students have started assessment attempts.' });
        return;
      }
      await client.query('DELETE FROM assessment_questions WHERE assessment_id = $1', [assessmentId]);
      for (const [position, question] of item.questions.entries()) {
        await client.query(
          `INSERT INTO assessment_questions (assessment_id, question_type, prompt, options, correct_option, marks, position)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [assessmentId, question.questionType, question.prompt, JSON.stringify(question.options), question.correctOption ?? null, question.marks, position],
        );
      }
    }
    if (!entries.length && !item.questions) {
      await client.query('ROLLBACK');
      response.status(400).json({ error: 'No assessment changes were supplied.' });
      return;
    }
    const result = updated
      ? { rows: [updated] }
      : await client.query('SELECT * FROM assessments WHERE id = $1', [assessmentId]);
    if (!result.rows[0]) {
      await client.query('ROLLBACK');
      response.status(404).json({ error: 'Assessment not found.' });
      return;
    }
    await client.query('COMMIT');
    response.json({ assessment: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

managementRouter.get('/assessments/:assessmentId/attempts', asyncRoute(async (request, response) => {
  const result = await pool.query(`
    SELECT at.id, at.score, at.total_marks, at.feedback, at.reviewed_at, at.started_at, at.submitted_at,
      s.id AS student_id, s.full_name, s.email, s.roll_number,
      at.submitted_at IS NOT NULL AND EXISTS (SELECT 1 FROM assessment_responses ar WHERE ar.attempt_id = at.id AND ar.awarded_marks IS NULL) AS pending_review
    FROM assessment_attempts at JOIN students s ON s.id = at.student_id
    WHERE at.assessment_id = $1 ORDER BY at.started_at DESC LIMIT 1000
  `, [parseId(request.params.assessmentId)]);
  response.json({ attempts: result.rows });
}));

managementRouter.get('/assessment-attempts/:attemptId', asyncRoute(async (request, response) => {
  const attemptId = parseId(request.params.attemptId);
  const attempt = await pool.query(`
    SELECT at.id, at.score, at.total_marks, at.feedback, at.reviewed_at, at.started_at, at.submitted_at,
      s.full_name, s.email, a.title AS assessment_title
    FROM assessment_attempts at
    JOIN students s ON s.id = at.student_id
    JOIN assessments a ON a.id = at.assessment_id
    WHERE at.id = $1
  `, [attemptId]);
  if (!attempt.rows[0]) {
    response.status(404).json({ error: 'Assessment attempt not found.' });
    return;
  }
  const responses = await pool.query(`
    SELECT q.id AS question_id, q.question_type, q.prompt, q.options, q.marks,
      ar.selected_option, ar.answer_text, ar.awarded_marks, ar.feedback
    FROM assessment_responses ar JOIN assessment_questions q ON q.id = ar.question_id
    WHERE ar.attempt_id = $1 ORDER BY q.position
  `, [attemptId]);
  response.json({ attempt: attempt.rows[0], responses: responses.rows });
}));

managementRouter.patch('/assessment-attempts/:attemptId/review', asyncRoute(async (request, response) => {
  const attemptId = parseId(request.params.attemptId);
  const review = assessmentReviewSchema.parse(request.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const attempt = await client.query<{ student_id: string; total_marks: string; submitted_at: Date | null; reviewed_at: Date | null }>(
      'SELECT student_id, total_marks, submitted_at, reviewed_at FROM assessment_attempts WHERE id = $1 FOR UPDATE',
      [attemptId],
    );
    if (!attempt.rows[0] || !attempt.rows[0].submitted_at) {
      await client.query('ROLLBACK');
      response.status(404).json({ error: 'A submitted assessment attempt was not found.' });
      return;
    }
    if (attempt.rows[0].reviewed_at) {
      await client.query('ROLLBACK');
      response.status(409).json({ error: 'This assessment attempt has already been reviewed.' });
      return;
    }
    const subjective = await client.query<{ question_id: string; marks: string }>(`
      SELECT ar.question_id, q.marks
      FROM assessment_responses ar JOIN assessment_questions q ON q.id = ar.question_id
      WHERE ar.attempt_id = $1 AND q.question_type <> 'multiple_choice'
    `, [attemptId]);
    const submitted = new Map(review.responses.map((item) => [item.questionId, item]));
    if (submitted.size !== subjective.rows.length || subjective.rows.some((item) => !submitted.has(item.question_id))) {
      await client.query('ROLLBACK');
      response.status(400).json({ error: 'Provide a grade and feedback for every subjective response.' });
      return;
    }
    for (const responseItem of subjective.rows) {
      const grade = submitted.get(responseItem.question_id)!;
      if (grade.awardedMarks > Number(responseItem.marks)) {
        await client.query('ROLLBACK');
        response.status(400).json({ error: 'A response grade cannot exceed the question marks.' });
        return;
      }
      await client.query(
        'UPDATE assessment_responses SET awarded_marks = $1, feedback = $2 WHERE attempt_id = $3 AND question_id = $4',
        [grade.awardedMarks, grade.feedback, attemptId, responseItem.question_id],
      );
    }
    const scoreResult = await client.query<{ score: string }>(
      'SELECT coalesce(sum(awarded_marks), 0)::numeric AS score FROM assessment_responses WHERE attempt_id = $1',
      [attemptId],
    );
    const score = Number(scoreResult.rows[0].score);
    const total = Number(attempt.rows[0].total_marks);
    const feedback = review.feedback || review.responses.map((item) => item.feedback).filter(Boolean).join('\n');
    const updated = await client.query(
      'UPDATE assessment_attempts SET score = $1, feedback = $2, reviewed_at = now() WHERE id = $3 RETURNING id, score, total_marks, feedback, reviewed_at',
      [score, feedback, attemptId],
    );
    const points = total > 0 && score / total >= 0.8 ? 65 : 50;
    const award = await client.query(
      `INSERT INTO student_xp_awards (student_id, activity_key, points, reason)
       VALUES ($1,$2,$3,$4) ON CONFLICT (student_id, activity_key) DO NOTHING RETURNING points`,
      [attempt.rows[0].student_id, `assessment:${attemptId}`, points, points === 65 ? 'Assessment completed · high score bonus' : 'Assessment completed'],
    );
    if (award.rows[0]) {
      await client.query(
        `INSERT INTO student_xp (student_id, total_xp) VALUES ($1,$2)
         ON CONFLICT (student_id) DO UPDATE SET total_xp = student_xp.total_xp + EXCLUDED.total_xp, updated_at = now()`,
        [attempt.rows[0].student_id, points],
      );
    }
    await client.query('COMMIT');
    response.json({ attempt: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}));

managementRouter.get('/announcements', asyncRoute(async (_request, response) => {
  const result = await pool.query(`
    SELECT n.*, c.title AS course_title FROM announcements n
    LEFT JOIN courses c ON c.id = n.course_id
    ORDER BY n.updated_at DESC
  `);
  response.json({ announcements: result.rows });
}));

managementRouter.post('/announcements', asyncRoute(async (request, response) => {
  const item = announcementInputSchema.parse(request.body);
  await validateAnnouncementCourse(item.courseId);
  const result = await pool.query(
    `INSERT INTO announcements (title, body, link_url, material_id, course_id, status, published_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $6 = 'published' THEN now() END,$7) RETURNING *`,
    [item.title, item.body, item.linkUrl ?? null, item.materialId ?? null, item.courseId ?? null, item.status, requireManagerId(request)],
  );
  response.status(201).json({ announcement: result.rows[0] });
}));

managementRouter.patch('/announcements/:announcementId', asyncRoute(async (request, response) => {
  const announcementId = parseId(request.params.announcementId);
  const item = announcementInputSchema.partial().parse(request.body);
  if (item.courseId !== undefined) await validateAnnouncementCourse(item.courseId);
  const map = { title: 'title', body: 'body', linkUrl: 'link_url', materialId: 'material_id', courseId: 'course_id', status: 'status' } as const;
  const entries = Object.entries(item).filter(([, value]) => value !== undefined);
  if (!entries.length) {
    response.status(400).json({ error: 'No announcement changes were supplied.' });
    return;
  }
  const values = entries.map(([, value]) => value);
  const fields = entries.map(([key], index) => `${map[key as keyof typeof map]} = $${index + 1}`);
  const statusIndex = entries.findIndex(([key]) => key === 'status');
  const publishDate = statusIndex >= 0
    ? `published_at = CASE WHEN $${statusIndex + 1} = 'published' THEN coalesce(published_at, now()) ELSE published_at END,`
    : '';
  values.push(announcementId);
  const result = await pool.query(
    `UPDATE announcements SET ${fields.join(', ')}, ${publishDate}
      updated_at = now()
     WHERE id = $${values.length} RETURNING *`,
    values,
  );
  if (!result.rows[0]) {
    response.status(404).json({ error: 'Announcement not found.' });
    return;
  }
  response.json({ announcement: result.rows[0] });
}));

managementRouter.delete('/announcements/:announcementId', asyncRoute(async (request, response) => {
  const result = await pool.query(`UPDATE announcements SET status = 'archived', updated_at = now() WHERE id = $1 RETURNING id`, [parseId(request.params.announcementId)]);
  if (!result.rows[0]) {
    response.status(404).json({ error: 'Announcement not found.' });
    return;
  }
  response.status(204).end();
}));

managementRouter.get('/reports/summary', asyncRoute(async (request, response) => {
  const from = typeof request.query.from === 'string' ? request.query.from : new Date(Date.now() - 30 * 86400_000).toISOString();
  const to = typeof request.query.to === 'string' ? request.query.to : new Date().toISOString();
  const range = z.object({ from: z.string().datetime(), to: z.string().datetime() }).parse({ from, to });
  if (new Date(range.to) <= new Date(range.from)) {
    response.status(400).json({ error: 'The end date must be after the start date.' });
    return;
  }
  const [students, courses, activity] = await Promise.all([
    pool.query(`
      SELECT s.id, s.full_name, s.email, s.roll_number, count(a.id)::int AS activity_count,
             count(a.id) FILTER (WHERE a.activity_type = 'lesson_completed')::int AS lessons_completed,
             coalesce(x.total_xp, 0)::int AS total_xp
      FROM students s
      LEFT JOIN learning_activity a ON a.student_id = s.id AND a.occurred_at >= $1 AND a.occurred_at < $2
      LEFT JOIN student_xp x ON x.student_id = s.id
      GROUP BY s.id, x.total_xp ORDER BY activity_count DESC, s.full_name
    `, [range.from, range.to]),
    pool.query(`
      SELECT c.id, c.title, c.subject, count(DISTINCT e.student_id)::int AS enrolled,
             count(DISTINCT a.node_id) FILTER (WHERE a.activity_type = 'lesson_completed')::int AS lessons_completed
      FROM courses c LEFT JOIN course_enrollments e ON e.course_id = c.id
      LEFT JOIN learning_activity a ON a.course_id = c.id AND a.occurred_at >= $1 AND a.occurred_at < $2
      GROUP BY c.id ORDER BY c.title
    `, [range.from, range.to]),
    pool.query(`
      SELECT date_trunc('day', occurred_at)::date AS day, activity_type, count(*)::int AS count
      FROM learning_activity WHERE occurred_at >= $1 AND occurred_at < $2
      GROUP BY day, activity_type ORDER BY day
    `, [range.from, range.to]),
  ]);
  response.json({ range, students: students.rows, courses: courses.rows, activity: activity.rows });
}));

managementRouter.get('/reports/students.csv', asyncRoute(async (request, response) => {
  const from = typeof request.query.from === 'string' ? request.query.from : new Date(Date.now() - 30 * 86400_000).toISOString();
  const to = typeof request.query.to === 'string' ? request.query.to : new Date().toISOString();
  const range = z.object({ from: z.string().datetime(), to: z.string().datetime() }).parse({ from, to });
  if (new Date(range.to) <= new Date(range.from)) {
    response.status(400).json({ error: 'The end date must be after the start date.' });
    return;
  }
  const result = await pool.query(`
    SELECT s.full_name, s.email, s.roll_number, s.phone,
      count(DISTINCT a.id)::int AS activity_count,
      count(DISTINCT a.id) FILTER (WHERE a.activity_type = 'lesson_completed')::int AS lessons_completed,
      coalesce(x.total_xp, 0)::int AS total_xp
    FROM students s
    LEFT JOIN learning_activity a ON a.student_id = s.id AND a.occurred_at >= $1 AND a.occurred_at < $2
    LEFT JOIN student_xp x ON x.student_id = s.id
    GROUP BY s.id, x.total_xp ORDER BY s.full_name
  `, [range.from, range.to]);
  const quote = (value: unknown) => {
    const text = String(value ?? '');
    const safeText = /^[\u0000-\u0020]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replaceAll('"', '""')}"`;
  };
  const headers = ['Name', 'Email', 'Roll number', 'Phone', 'Activity records', 'Lessons completed', 'XP'];
  const csv = [headers, ...result.rows.map((row) => [row.full_name, row.email, row.roll_number, row.phone, row.activity_count, row.lessons_completed, row.total_xp])]
    .map((row) => row.map(quote).join(',')).join('\r\n');
  response.setHeader('Content-Type', 'text/csv; charset=utf-8');
  response.setHeader('Content-Disposition', 'attachment; filename="preppx-student-report.csv"');
  response.send(csv);
}));
