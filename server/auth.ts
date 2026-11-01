import type { NextFunction, Request, Response } from 'express';
import { jwtVerify, SignJWT } from 'jose';
import { config, frontendOrigins } from './config.js';

export const MANAGEMENT_COOKIE = 'preppx_management_session';
const jwtKey = new TextEncoder().encode(config.MANAGEMENT_JWT_SECRET);

export type ManagementIdentity = { id: string; email: string; fullName: string };
export type StudentIdentity = { id: string; email: string; fullName: string };

declare global {
  namespace Express {
    interface Request {
      managementUser?: ManagementIdentity;
      studentUser?: StudentIdentity;
    }
  }
}

export const STUDENT_COOKIE = 'preppx_student_session';
export const STUDENT_RESET_COOKIE = 'preppx_student_reset';

export async function createStudentToken(identity: StudentIdentity) {
  return new SignJWT({ email: identity.email, fullName: identity.fullName, role: 'student' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(identity.id)
    .setIssuer('preppx-api')
    .setAudience('preppx-student')
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(jwtKey);
}

export async function requireStudent(request: Request, response: Response, next: NextFunction) {
  const token = request.cookies?.[STUDENT_COOKIE] as string | undefined;
  if (!token) {
    response.status(401).json({ error: 'Student sign-in is required.' });
    return;
  }
  try {
    const { payload } = await jwtVerify(token, jwtKey, { issuer: 'preppx-api', audience: 'preppx-student' });
    if (payload.role !== 'student' || typeof payload.sub !== 'string' || typeof payload.email !== 'string' || typeof payload.fullName !== 'string') {
      response.status(401).json({ error: 'The student session is invalid.' });
      return;
    }
    request.studentUser = { id: payload.sub, email: payload.email, fullName: payload.fullName };
    next();
  } catch {
    response.status(401).json({ error: 'The student session has expired. Sign in again.' });
  }
}

export function requireStudentId(request: Request) {
  if (!request.studentUser) throw Object.assign(new Error('Student sign-in is required.'), { status: 401 });
  return request.studentUser.id;
}

export async function createManagementToken(identity: ManagementIdentity) {
  return new SignJWT({ email: identity.email, fullName: identity.fullName, role: 'management' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(identity.id)
    .setIssuer('preppx-api')
    .setAudience('preppx-management')
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(jwtKey);
}

export async function requireManagement(request: Request, response: Response, next: NextFunction) {
  const token = request.cookies?.[MANAGEMENT_COOKIE] as string | undefined;
  if (!token) {
    response.status(401).json({ error: 'Management sign-in is required.' });
    return;
  }
  try {
    const { payload } = await jwtVerify(token, jwtKey, { issuer: 'preppx-api', audience: 'preppx-management' });
    if (payload.role !== 'management' || typeof payload.sub !== 'string' || typeof payload.email !== 'string' || typeof payload.fullName !== 'string') {
      response.status(401).json({ error: 'The management session is invalid.' });
      return;
    }
    request.managementUser = { id: payload.sub, email: payload.email, fullName: payload.fullName };
    next();
  } catch {
    response.status(401).json({ error: 'The management session has expired. Sign in again.' });
  }
}

export function requireSameOrigin(request: Request, response: Response, next: NextFunction) {
  if (!frontendOrigins.has(request.get('origin') ?? '')) {
    response.status(403).json({ error: 'The request origin is not allowed.' });
    return;
  }
  next();
}
