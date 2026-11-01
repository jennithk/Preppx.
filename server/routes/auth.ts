import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { createManagementToken, MANAGEMENT_COOKIE, requireManagement, requireSameOrigin } from '../auth.js';
import { config } from '../config.js';
import { pool } from '../db/pool.js';

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again later.' },
});

export const managementAuthRouter = Router();

managementAuthRouter.post('/login', requireSameOrigin, loginLimiter, async (request, response, next) => {
  const parsed = credentialsSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Enter a valid email address and password.' });
    return;
  }
  try {
    const result = await pool.query<{ id: string; email: string; full_name: string; password_hash: string }>(
      'SELECT id, email, full_name, password_hash FROM management_users WHERE email = $1',
      [parsed.data.email.toLowerCase()],
    );
    const manager = result.rows[0];
    if (!manager || !await bcrypt.compare(parsed.data.password, manager.password_hash)) {
      response.status(401).json({ error: 'The email or password is incorrect.' });
      return;
    }
    const token = await createManagementToken({ id: manager.id, email: manager.email, fullName: manager.full_name });
    response.cookie(MANAGEMENT_COOKIE, token, {
      httpOnly: true,
      secure: config.COOKIE_SECURE,
      sameSite: 'strict',
      path: '/api',
      maxAge: 8 * 60 * 60 * 1000,
    });
    response.json({ manager: { id: manager.id, email: manager.email, fullName: manager.full_name } });
  } catch (error) {
    next(error);
  }
});

managementAuthRouter.post('/logout', requireSameOrigin, (_request, response) => {
  response.clearCookie(MANAGEMENT_COOKIE, {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/api',
  });
  response.status(204).end();
});

managementAuthRouter.get('/session', requireManagement, (request, response) => {
  response.json({ manager: request.managementUser });
});
