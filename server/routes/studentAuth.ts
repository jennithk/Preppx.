import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { config } from '../config.js';
import {
  createStudentToken, requireSameOrigin, requireStudent, requireStudentId,
  STUDENT_COOKIE, STUDENT_RESET_COOKIE,
} from '../auth.js';
import { sendOtpEmail } from '../email.js';
import { pool } from '../db/pool.js';
import { asyncRoute } from '../http.js';

const emailSchema = z.string().email().max(254).transform((value) => value.toLowerCase());
const interestSchema = z.array(z.enum([
  'Coding and programming', 'Non-coding activities', 'Technical subjects', 'Non-technical subjects',
])).max(4);
const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(32).default(''),
  email: emailSchema,
  profileImageName: z.string().trim().max(255).default(''),
  interests: interestSchema.default([]),
}).strict();
const passwordSchema = z.string().min(8).max(128).regex(/[A-Za-z]/, 'Include at least one letter.').regex(/[0-9]/, 'Include at least one number.');
const registrationSchema = profileSchema.extend({ password: passwordSchema }).strict();
const credentialsSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).strict();
const challengeSchema = z.object({ email: emailSchema, purpose: z.enum(['register', 'login', 'reset', 'migration']) }).strict();
const verifySchema = z.object({ email: emailSchema, code: z.string().regex(/^\d{6}$/), purpose: z.enum(['register', 'login', 'reset', 'migration']) }).strict();
const migrationSchema = profileSchema.extend({
  password: passwordSchema,
  legacyProgress: z.record(z.string(), z.unknown()).optional(),
}).strict().refine((value) => JSON.stringify(value.legacyProgress ?? {}).length <= 100_000, {
  path: ['legacyProgress'], message: 'The saved legacy progress export is too large.',
});
const resetSchema = z.object({ password: passwordSchema }).strict();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Try again later.' },
});
const jwtKey = new TextEncoder().encode(config.MANAGEMENT_JWT_SECRET);
const COOKIE_OPTIONS = { httpOnly: true, secure: config.COOKIE_SECURE, sameSite: 'strict' as const, path: '/api' };

function codeDigest(id: string, code: string) {
  return createHmac('sha256', config.MANAGEMENT_JWT_SECRET).update(`${id}:${code}`).digest();
}

async function createChallenge(email: string, purpose: 'register' | 'login' | 'reset' | 'migration', payload: unknown = null) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const created = await pool.query<{ id: string }>(
    `INSERT INTO student_auth_challenges (email, purpose, code_digest, payload, expires_at)
     VALUES ($1, $2, $3, $4, now() + interval '10 minutes') RETURNING id`,
    [email, purpose, codeDigest('pending', code).toString('hex'), payload ? JSON.stringify(payload) : null],
  );
  const id = created.rows[0].id;
  await pool.query('UPDATE student_auth_challenges SET code_digest = $1 WHERE id = $2', [codeDigest(id, code).toString('hex'), id]);
  try {
    await sendOtpEmail(email, code, purpose);
  } catch (error) {
    await pool.query('DELETE FROM student_auth_challenges WHERE id = $1', [id]);
    throw error;
  }
}

async function consumeChallenge(email: string, purpose: 'register' | 'login' | 'reset' | 'migration', code: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<{
      id: string; code_digest: string; payload: Record<string, unknown> | null; attempts: number; expires_at: Date; consumed_at: Date | null;
    }>(
      `SELECT id, code_digest, payload, attempts, expires_at, consumed_at
       FROM student_auth_challenges
       WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [email, purpose],
    );
    const challenge = result.rows[0];
    if (!challenge || challenge.expires_at <= new Date() || challenge.attempts >= 5) {
      await client.query('COMMIT');
      throw Object.assign(new Error('The verification code expired or is invalid. Request a new code.'), { status: 400 });
    }
    const actual = codeDigest(challenge.id, code);
    const expected = Buffer.from(challenge.code_digest, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      await client.query('UPDATE student_auth_challenges SET attempts = attempts + 1 WHERE id = $1', [challenge.id]);
      await client.query('COMMIT');
      throw Object.assign(new Error('The verification code is incorrect.'), { status: 400 });
    }
    await client.query('UPDATE student_auth_challenges SET consumed_at = now() WHERE id = $1', [challenge.id]);
    await client.query('COMMIT');
    return challenge.payload;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function establishSession(response: import('express').Response, student: { id: string; email: string; full_name: string }) {
  const token = await createStudentToken({ id: student.id, email: student.email, fullName: student.full_name });
  response.cookie(STUDENT_COOKIE, token, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });
  response.clearCookie(STUDENT_RESET_COOKIE, COOKIE_OPTIONS);
  response.json({ student: { id: student.id, email: student.email, fullName: student.full_name } });
}

export const studentAuthRouter = Router();
studentAuthRouter.use((request, response, next) => {
  if (['POST', 'PATCH', 'DELETE'].includes(request.method)) return requireSameOrigin(request, response, next);
  next();
});

studentAuthRouter.post('/register', limiter, asyncRoute(async (request, response) => {
  const input = registrationSchema.parse(request.body);
  const existing = await pool.query('SELECT id FROM students WHERE email = $1', [input.email]);
  if (existing.rows[0]) {
    response.status(409).json({ error: 'An account with this email already exists. Sign in or use password recovery.' });
    return;
  }
  const passwordHash = await bcrypt.hash(input.password, 12);
  await createChallenge(input.email, 'register', {
    fullName: input.fullName, phone: input.phone, profileImageName: input.profileImageName,
    interests: input.interests, passwordHash,
  });
  response.status(202).json({ accepted: true, email: input.email });
}));

studentAuthRouter.post('/login', limiter, asyncRoute(async (request, response) => {
  const input = credentialsSchema.parse(request.body);
  const result = await pool.query<{ id: string; email: string; full_name: string; password_hash: string | null; email_verified_at: Date | null }>(
    'SELECT id, email, full_name, password_hash, email_verified_at FROM students WHERE email = $1',
    [input.email],
  );
  const student = result.rows[0];
  if (!student || !student.password_hash || !await bcrypt.compare(input.password, student.password_hash)) {
    response.status(401).json({ error: 'The email or password is incorrect.' });
    return;
  }
  if (!student.email_verified_at) {
    response.status(403).json({ error: 'Verify your email address before signing in.' });
    return;
  }
  await createChallenge(student.email, 'login');
  response.status(202).json({ accepted: true, email: student.email });
}));

studentAuthRouter.post('/migration', limiter, asyncRoute(async (request, response) => {
  const input = migrationSchema.parse(request.body);
  const existing = await pool.query('SELECT id FROM students WHERE email = $1', [input.email]);
  if (existing.rows[0]) {
    response.status(409).json({ error: 'A server-backed student account already exists. Sign in or use password recovery.' });
    return;
  }
  const passwordHash = await bcrypt.hash(input.password, 12);
  await createChallenge(input.email, 'migration', {
    fullName: input.fullName, phone: input.phone, profileImageName: input.profileImageName,
    interests: input.interests, passwordHash, legacyProgress: input.legacyProgress ?? null,
  });
  response.status(202).json({ accepted: true, email: input.email });
}));

studentAuthRouter.post('/resend', limiter, asyncRoute(async (request, response) => {
  const { email, purpose } = challengeSchema.parse(request.body);
  if (purpose === 'register' || purpose === 'migration') {
    const challenge = await pool.query<{ payload: Record<string, unknown> }>(
      `SELECT payload FROM student_auth_challenges
       WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [email, purpose],
    );
    if (!challenge.rows[0]) {
      response.status(400).json({ error: 'The registration verification has expired. Start again.' });
      return;
    }
    await createChallenge(email, purpose, challenge.rows[0].payload);
  } else {
    const student = await pool.query('SELECT id FROM students WHERE email = $1 AND email_verified_at IS NOT NULL', [email]);
    if (!student.rows[0]) {
      response.status(400).json({ error: 'No verified student account was found for this email.' });
      return;
    }
    await createChallenge(email, purpose);
  }
  response.status(202).json({ accepted: true });
}));

studentAuthRouter.post('/verify', limiter, asyncRoute(async (request, response) => {
  const input = verifySchema.parse(request.body);
  const payload = await consumeChallenge(input.email, input.purpose, input.code);
  if (input.purpose === 'register' || input.purpose === 'migration') {
    if (!payload || typeof payload.passwordHash !== 'string') {
      response.status(400).json({ error: 'The account setup has expired. Start again.' });
      return;
    }
    const profile = profileSchema.parse({
      email: input.email, fullName: payload.fullName, phone: payload.phone,
      profileImageName: payload.profileImageName, interests: payload.interests,
    });
    const inserted = await pool.query<{ id: string; email: string; full_name: string }>(
      `INSERT INTO students (email, full_name, phone, profile_image_name, interests, password_hash, email_verified_at, legacy_progress)
       VALUES ($1,$2,$3,$4,$5,$6,now(),$7)
       RETURNING id, email, full_name`,
      [
        profile.email, profile.fullName, profile.phone, profile.profileImageName,
        JSON.stringify(profile.interests), payload.passwordHash,
        payload.legacyProgress ? JSON.stringify(payload.legacyProgress) : null,
      ],
    );
    await pool.query('INSERT INTO student_xp (student_id, total_xp) VALUES ($1, 0) ON CONFLICT (student_id) DO NOTHING', [inserted.rows[0].id]);
    await establishSession(response, inserted.rows[0]);
    return;
  }
  const student = await pool.query<{ id: string; email: string; full_name: string }>(
    'SELECT id, email, full_name FROM students WHERE email = $1 AND email_verified_at IS NOT NULL',
    [input.email],
  );
  if (!student.rows[0]) {
    response.status(400).json({ error: 'The student account could not be found.' });
    return;
  }
  if (input.purpose === 'reset') {
    const token = await new SignJWT({ email: input.email, purpose: 'password-reset' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(student.rows[0].id)
      .setIssuer('preppx-api')
      .setAudience('preppx-student-reset')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(jwtKey);
    response.cookie(STUDENT_RESET_COOKIE, token, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
    response.json({ purpose: 'reset', email: input.email });
    return;
  }
  await establishSession(response, student.rows[0]);
}));

studentAuthRouter.post('/reset', limiter, asyncRoute(async (request, response) => {
  const input = resetSchema.parse(request.body);
  const token = request.cookies?.[STUDENT_RESET_COOKIE] as string | undefined;
  if (!token) {
    response.status(401).json({ error: 'Complete email verification before resetting your password.' });
    return;
  }
  let subject: string;
  try {
    const { payload } = await jwtVerify(token, jwtKey, { issuer: 'preppx-api', audience: 'preppx-student-reset' });
    if (payload.purpose !== 'password-reset' || typeof payload.sub !== 'string') throw new Error('Invalid reset session');
    subject = payload.sub;
  } catch {
    response.status(401).json({ error: 'The password reset session has expired. Request a new code.' });
    return;
  }
  const passwordHash = await bcrypt.hash(input.password, 12);
  const changed = await pool.query('UPDATE students SET password_hash = $1, updated_at = now() WHERE id = $2 RETURNING id', [passwordHash, subject]);
  if (!changed.rows[0]) {
    response.status(404).json({ error: 'Student account not found.' });
    return;
  }
  response.clearCookie(STUDENT_RESET_COOKIE, COOKIE_OPTIONS);
  response.clearCookie(STUDENT_COOKIE, COOKIE_OPTIONS);
  response.status(204).end();
}));

studentAuthRouter.get('/session', requireStudent, (request, response) => {
  response.json({ student: request.studentUser });
});

studentAuthRouter.post('/logout', requireSameOrigin, (_request, response) => {
  response.clearCookie(STUDENT_COOKIE, COOKIE_OPTIONS);
  response.clearCookie(STUDENT_RESET_COOKIE, COOKIE_OPTIONS);
  response.status(204).end();
});

studentAuthRouter.get('/profile', requireStudent, asyncRoute(async (request, response) => {
  const result = await pool.query(
    `SELECT id, email, full_name, phone, profile_image_name, interests, roll_number, academic_info, created_at, updated_at
     FROM students WHERE id = $1`,
    [requireStudentId(request)],
  );
  if (!result.rows[0]) {
    response.status(404).json({ error: 'Student account not found.' });
    return;
  }
  response.json({ student: result.rows[0] });
}));

studentAuthRouter.patch('/profile', requireStudent, asyncRoute(async (request, response) => {
  const input = z.object({
    fullName: z.string().trim().min(2).max(160).optional(),
    phone: z.string().trim().max(32).optional(),
    interests: interestSchema.optional(),
  }).strict().parse(request.body);
  if (!Object.keys(input).length) {
    response.status(400).json({ error: 'No profile changes were supplied.' });
    return;
  }
  const mapping = { fullName: 'full_name', phone: 'phone', interests: 'interests' } as const;
  const entries = Object.entries(input);
  const values: unknown[] = entries.map(([, value]) => Array.isArray(value) ? JSON.stringify(value) : value);
  const assignments = entries.map(([key], index) => `${mapping[key as keyof typeof mapping]} = $${index + 1}${key === 'interests' ? '::jsonb' : ''}`);
  values.push(requireStudentId(request));
  const result = await pool.query(
    `UPDATE students SET ${assignments.join(', ')}, updated_at = now()
     WHERE id = $${values.length}
     RETURNING id, email, full_name, phone, profile_image_name, interests, roll_number, academic_info, updated_at`,
    values,
  );
  if (!result.rows[0]) {
    response.status(404).json({ error: 'Student account not found.' });
    return;
  }
  response.json({ student: result.rows[0] });
}));
