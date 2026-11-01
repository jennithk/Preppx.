import type { AuthPurpose, StudentRegistration, StudentSession } from '../types/auth';
import { learningService } from '../../student/services/learningService';

const STUDENTS_KEY = 'preppx.students.v1';
const SERVER_SESSION_KEY = 'preppx.server-session.v1';
const SERVER_PROFILE_KEY = 'preppx.server-profile.v1';
const PENDING_KEY = 'preppx.pending-otp.v1';
const LEGACY_STUDENTS_KEY = 'preppx-demo-students';

type PendingOtp = { email: string; purpose: AuthPurpose; createdAt: string; profile?: StudentRegistration };
type StoredStudent = StudentRegistration & { passwordSalt?: string; passwordHash?: string };
type ApiStudent = { id: string; email: string; fullName: string };

class StudentApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/student${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error
      : `The request failed (${response.status}).`;
    throw new StudentApiError(message, response.status);
  }
  return body as T;
}

function storeServerProfile(profile: StudentRegistration) {
  window.sessionStorage.setItem(SERVER_PROFILE_KEY, JSON.stringify(profile));
}

function storeServerSession(student: ApiStudent) {
  const session: StudentSession = {
    id: student.id, email: student.email, role: 'student', fullName: student.fullName, createdAt: new Date().toISOString(),
  };
  window.sessionStorage.setItem(SERVER_SESSION_KEY, JSON.stringify(session));
}

function readStudents(): StoredStudent[] {
  let currentStudents: StoredStudent[] = [];
  try {
    const current = window.localStorage.getItem(STUDENTS_KEY);
    if (current) {
      const parsed: unknown = JSON.parse(current);
      if (Array.isArray(parsed)) currentStudents = parsed as StoredStudent[];
    }
  } catch {
    // Continue to the legacy migration path; malformed current data must not hide recoverable account details.
  }

  try {
    const legacy = window.localStorage.getItem(LEGACY_STUDENTS_KEY);
    if (!legacy) return currentStudents;

    // Preserve details students entered in earlier Preppx builds, even if the new key already exists.
    const legacyParsed: unknown = JSON.parse(legacy);
    const legacyStudents = Array.isArray(legacyParsed) ? legacyParsed as StoredStudent[] : [];
    const knownEmails = new Set(currentStudents.flatMap((student) => typeof student.email === 'string' ? [student.email.toLowerCase()] : []));
    const migrated = legacyStudents
      .filter((student) => typeof student.email === 'string' && !knownEmails.has(student.email.toLowerCase()))
      .map((student) => ({
        ...student,
        interests: Array.isArray(student.interests) ? student.interests : [],
        profileImageName: student.profileImageName ?? '',
      }));
    const combined = [...currentStudents, ...migrated];
    window.localStorage.setItem(STUDENTS_KEY, JSON.stringify(combined));
    window.localStorage.removeItem(LEGACY_STUDENTS_KEY);
    return combined;
  } catch {
    return currentStudents;
  }
}

function writeStudents(students: StoredStudent[]) {
  try {
    window.localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));
  } catch {
    throw new Error('Your account details could not be saved. Try a smaller profile picture or check browser storage settings.');
  }
}

function findStudent(email: string) {
  return readStudents().find((student) => student.email.toLowerCase() === email.trim().toLowerCase());
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string) {
  const pairs = hex.match(/.{1,2}/g) ?? [];
  return new Uint8Array(pairs.map((pair) => Number.parseInt(pair, 16)));
}

async function hashPassword(password: string, saltHex: string) {
  if (!window.crypto?.subtle) {
    throw new Error('Password setup requires a secure browser context. Use localhost or the deployed HTTPS website.');
  }
  const keyMaterial = await window.crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await window.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromHex(saltHex), iterations: 150_000, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return toHex(new Uint8Array(bits));
}

async function makePasswordRecord(password: string) {
  const salt = toHex(window.crypto.getRandomValues(new Uint8Array(16)));
  return { passwordSalt: salt, passwordHash: await hashPassword(password, salt) };
}

function readSession(): StudentSession | null {
  try {
    const current = window.sessionStorage.getItem(SERVER_SESSION_KEY);
    return current ? JSON.parse(current) as StudentSession : null;
  } catch {
    return null;
  }
}

export const authService = {
  async registerStudent(profile: Omit<StudentRegistration, 'passwordSetupCompleted' | 'createdAt' | 'updatedAt'>, password: string) {
    await apiRequest<{ accepted: true }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        fullName: profile.fullName, phone: profile.phone, email: profile.email,
        profileImageName: profile.profileImageName, interests: profile.interests, password,
      }),
    });
    const cached: StudentRegistration = { ...profile, passwordSetupCompleted: true, createdAt: new Date().toISOString() };
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify({
      email: profile.email.toLowerCase(), purpose: 'register', createdAt: new Date().toISOString(), profile: cached,
    } satisfies PendingOtp));
  },

  async completePasswordSetup(email: string, password: string) {
    const students = readStudents();
    const index = students.findIndex((student) => student.email.toLowerCase() === email.toLowerCase());
    if (index < 0) throw new Error('No student account was found for this email. Please register first.');
    const passwordRecord = await makePasswordRecord(password);
    students[index] = { ...students[index], ...passwordRecord, passwordSetupCompleted: true, updatedAt: new Date().toISOString() };
    writeStudents(students);
  },

  async verifyPassword(email: string, password: string) {
    const student = findStudent(email);
    if (!student) throw new Error('No student account was found for this email. Please register first.');
    if (!student.passwordSetupCompleted || !student.passwordSalt || !student.passwordHash) {
      throw new Error('Your password needs to be set up again. Use Forgot password to continue.');
    }
    const candidate = await hashPassword(password, student.passwordSalt);
    if (candidate !== student.passwordHash) throw new Error('The email or password is incorrect.');
  },

  async startLogin(email: string, password: string) {
    try {
      await apiRequest<{ accepted: true; email: string }>('/auth/login', {
        method: 'POST', body: JSON.stringify({ email, password }),
      });
      window.sessionStorage.setItem(PENDING_KEY, JSON.stringify({
        email: email.toLowerCase(), purpose: 'login', createdAt: new Date().toISOString(),
      } satisfies PendingOtp));
    } catch (error) {
      if (!(error instanceof StudentApiError) || error.status !== 401) throw error;
      try {
        await this.verifyPassword(email, password);
      } catch {
        throw error;
      }
      const profile = this.getLocalStudentProfile(email);
      if (!profile) throw error;
      await apiRequest<{ accepted: true }>('/auth/migration', {
        method: 'POST',
        body: JSON.stringify({
          fullName: profile.fullName, phone: profile.phone, email: profile.email,
          profileImageName: profile.profileImageName, interests: profile.interests,
          password, legacyProgress: learningService.exportLegacyProgress(),
        }),
      });
      window.sessionStorage.setItem(PENDING_KEY, JSON.stringify({
        email: email.toLowerCase(), purpose: 'migration', createdAt: new Date().toISOString(), profile,
      } satisfies PendingOtp));
    }
  },

  async requestOtp(email: string, purpose: AuthPurpose) {
    await apiRequest<{ accepted: true }>('/auth/resend', {
      method: 'POST', body: JSON.stringify({ email: email.toLowerCase(), purpose }),
    });
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify({
      email: email.toLowerCase(), purpose, createdAt: new Date().toISOString(),
    } satisfies PendingOtp));
  },

  async verifyOtp(code: string, context?: { email: string; purpose: AuthPurpose }): Promise<{ purpose: AuthPurpose; email: string }> {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    let pending: PendingOtp | null = null;
    if (raw) {
      try {
        pending = JSON.parse(raw) as PendingOtp;
      } catch {
        throw new Error('Your verification session is invalid. Please start again.');
      }
    }
    const pendingForVerification = pending && (!context || (pending.email === context.email && pending.purpose === context.purpose))
      ? pending
      : null;
    const email = context?.email ?? pendingForVerification?.email;
    const purpose = context?.purpose ?? pendingForVerification?.purpose;
    if (!email || !purpose) throw new Error('Your verification session has expired. Please start again.');
    const result = await apiRequest<{ student?: ApiStudent; purpose?: 'reset'; email: string }>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ email, purpose, code }),
    });
    if (pendingForVerification) window.sessionStorage.removeItem(PENDING_KEY);
    if (purpose === 'reset') return { purpose, email };

    if (result.student) {
      storeServerSession(result.student);
      let profile = pendingForVerification?.profile ?? this.getLocalStudentProfile(email);
      if (profile) {
        profile = { ...profile, fullName: result.student.fullName, email: result.student.email, passwordSetupCompleted: true };
        storeServerProfile(profile);
      } else {
        const profileResult = await apiRequest<{ student: Record<string, unknown> }>('/auth/profile');
        const record = profileResult.student;
        storeServerProfile({
          fullName: String(record.full_name), phone: String(record.phone ?? ''), email: String(record.email),
          profileImageName: String(record.profile_image_name ?? ''),
          interests: Array.isArray(record.interests) ? record.interests as StudentRegistration['interests'] : [],
          passwordSetupCompleted: true, createdAt: String(record.created_at ?? ''),
        });
      }
    }
    return { purpose, email };
  },

  async completePasswordReset(password: string) {
    await apiRequest<void>('/auth/reset', { method: 'POST', body: JSON.stringify({ password }) });
  },

  getCurrentSession(): StudentSession | null {
    return readSession();
  },

  getCurrentStudentProfile(): StudentRegistration | null {
    const session = readSession();
    if (!session) return null;
    try {
      const cached = window.sessionStorage.getItem(SERVER_PROFILE_KEY);
      if (cached) return JSON.parse(cached) as StudentRegistration;
    } catch { return null; }
    return findStudent(session.email) ?? null;
  },

  getLocalStudentProfile(email: string) {
    return findStudent(email) ?? null;
  },

  async restoreServerSession() {
    const result = await apiRequest<{ student: ApiStudent }>('/auth/session');
    const profile = await apiRequest<{ student: Record<string, unknown> }>('/auth/profile');
    storeServerSession(result.student);
    const record = profile.student;
    const cached: StudentRegistration = {
      fullName: String(record.full_name), phone: String(record.phone ?? ''), email: String(record.email),
      profileImageName: String(record.profile_image_name ?? ''),
      interests: Array.isArray(record.interests) ? record.interests as StudentRegistration['interests'] : [],
      passwordSetupCompleted: true, createdAt: String(record.created_at ?? ''), updatedAt: String(record.updated_at ?? ''),
    };
    storeServerProfile(cached);
    return cached;
  },

  clearClientSession() {
    window.sessionStorage.removeItem(SERVER_SESSION_KEY);
    window.sessionStorage.removeItem(SERVER_PROFILE_KEY);
  },

  async updateCurrentStudentProfile(updates: Partial<Pick<StudentRegistration, 'fullName' | 'phone' | 'interests' | 'profileImageName' | 'profileImageDataUrl'>>) {
    const session = readSession();
    if (!session) throw new Error('Please sign in again before updating your account.');
    const updatedOnServer = await apiRequest<{ student: Record<string, unknown> }>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ fullName: updates.fullName, phone: updates.phone, interests: updates.interests }),
    });
    const profile = this.getCurrentStudentProfile();
    if (!profile) throw new Error('Your student account could not be found.');
    const updated: StudentRegistration = {
      ...profile, ...updates,
      fullName: String(updatedOnServer.student.full_name),
      phone: String(updatedOnServer.student.phone),
      interests: Array.isArray(updatedOnServer.student.interests) ? updatedOnServer.student.interests as StudentRegistration['interests'] : [],
      updatedAt: String(updatedOnServer.student.updated_at),
    };
    storeServerProfile(updated);
    window.dispatchEvent(new Event('preppx:profile-updated'));
    return updated;
  },

  async signOut() {
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' });
    } finally {
      this.clearClientSession();
    }
    window.sessionStorage.removeItem(PENDING_KEY);
  },
};
