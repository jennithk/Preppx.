import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { ZodError } from 'zod';
import { config, frontendOrigins } from './config.js';
import { managementAuthRouter } from './routes/auth.js';
import { managementRouter } from './routes/management.js';
import { studentAuthRouter } from './routes/studentAuth.js';
import { studentRouter } from './routes/student.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => callback(null, !origin || frontendOrigins.has(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', async (_request, response, next) => {
    try {
      const { pool } = await import('./db/pool.js');
      await pool.query('SELECT 1');
      response.json({ status: 'ok', database: 'connected' });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/management/auth', managementAuthRouter);
  app.use('/api/management', managementRouter);
  app.use('/api/student/auth', studentAuthRouter);
  app.use('/api/student', studentRouter);

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const status = typeof error === 'object' && error && 'status' in error && typeof error.status === 'number' ? error.status : 500;
    if (error instanceof ZodError) {
      response.status(400).json({ error: 'The request data is invalid.', issues: error.issues });
      return;
    }
    if (error instanceof multer.MulterError) {
      response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Files must be 50 MB or smaller.' : 'The uploaded file could not be accepted.' });
      return;
    }
    const databaseCode = typeof error === 'object' && error && 'code' in error && typeof error.code === 'string' ? error.code : '';
    const safeMessage = error instanceof Error && typeof error === 'object' && 'expose' in error && error.expose === true
      ? error.message
      : null;
    if (databaseCode === '23505') {
      response.status(409).json({ error: 'A record with the supplied unique value already exists.' });
      return;
    }
    if (['23503', '23514', '23502', '22P02'].includes(databaseCode)) {
      response.status(400).json({ error: 'The request references invalid or incomplete data.' });
      return;
    }
    if (status >= 500) console.error('PREPPX API request failed', error);
    response.status(status).json({ error: status < 500 && error instanceof Error ? error.message : safeMessage ?? 'The request could not be completed.' });
  });
  return app;
}
