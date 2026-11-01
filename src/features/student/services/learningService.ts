import { authService } from '../../auth/services/authService';

export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type CodingChallenge = {
  id: string;
  title: string;
  topic: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  description: string;
  input: string;
  output: string;
  constraints: string[];
  starterCode: Record<string, string>;
  hints: string[];
};

export type AptitudeQuestion = {
  id: string;
  topic: string;
  difficulty: Difficulty;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

export type AssessmentQuestion = {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

export type Assessment = {
  id: string;
  title: string;
  category: string;
  difficulty: Difficulty;
  durationMinutes: number;
  totalMarks: number;
  description: string;
  questions: AssessmentQuestion[];
};

export type AssessmentAttempt = {
  id: string;
  assessmentId: string;
  title: string;
  score: number;
  total: number;
  correct: number;
  completedAt: string;
};

export type LearningResource = {
  id: string;
  title: string;
  category: string;
  trainer: string;
  duration: string;
  description: string;
  kind: 'video' | 'recording';
  day?: string;
  watchedMinutes?: number;
};

export type StudentNotification = {
  id: string;
  title: string;
  message: string;
  category: 'Sessions' | 'Learning' | 'Platform';
  createdAt: string;
  read: boolean;
};

export type AptitudeProgress = Record<string, { selectedIndex: number; correct: boolean; answeredAt: string }>;

export type XpAwardEvent = {
  id: string;
  points: number;
  reason: string;
  createdAt: string;
};

export type LevelUpEvent = {
  previousLevel: number;
  currentLevel: number;
  levelName: string;
  totalXp: number;
  xpGained: number;
  reason: string;
};

export type GamificationStats = {
  totalXp: number;
  level: number;
  levelName: string;
  currentLevelXp: number;
  nextLevelXp: number | null;
  nextLevelName: string | null;
  xpWithinLevel: number;
  xpToNextLevel: number;
  progressPercent: number;
  recentAwards: XpAwardEvent[];
};

type StudyLog = {
  solvedCodingIds: string[];
  savedDrafts: Record<string, string>;
  aptitude: AptitudeProgress;
  attempts: AssessmentAttempt[];
  completedResources: string[];
  readNotifications: string[];
  joinedSessionIds: string[];
  totalXp: number;
  xpAwards: XpAwardEvent[];
};

const LEVELS = [
  { level: 1, name: 'Starter', minXp: 0 },
  { level: 2, name: 'Explorer', minXp: 100 },
  { level: 3, name: 'Learner', minXp: 250 },
  { level: 4, name: 'Builder', minXp: 450 },
  { level: 5, name: 'Achiever', minXp: 700 },
  { level: 6, name: 'Specialist', minXp: 1000 },
  { level: 7, name: 'Expert', minXp: 1400 },
  { level: 8, name: 'Master', minXp: 1900 },
  { level: 9, name: 'Champion', minXp: 2500 },
  { level: 10, name: 'Legend', minXp: 3200 },
] as const;

function levelForXp(totalXp: number) {
  return [...LEVELS].reverse().find((level) => totalXp >= level.minXp) ?? LEVELS[0];
}

function getGamificationStatsFromLog(log: StudyLog): GamificationStats {
  const current = levelForXp(log.totalXp);
  const next = LEVELS.find((level) => level.minXp > log.totalXp) ?? null;
  const range = next ? next.minXp - current.minXp : 0;
  const xpWithinLevel = Math.max(0, log.totalXp - current.minXp);
  return {
    totalXp: log.totalXp,
    level: current.level,
    levelName: current.name,
    currentLevelXp: current.minXp,
    nextLevelXp: next?.minXp ?? null,
    nextLevelName: next?.name ?? null,
    xpWithinLevel,
    xpToNextLevel: next ? Math.max(0, next.minXp - log.totalXp) : 0,
    progressPercent: next && range > 0 ? Math.min(100, Math.round((xpWithinLevel / range) * 100)) : 100,
    recentAwards: log.xpAwards.slice(0, 6),
  };
}

const STORAGE_KEY = 'preppx.learning.v2';
const LEGACY_CLEANUP_KEY = 'preppx.legacy-seed-cleanup.v1';

function clearOldSeededRecords() {
  try {
    if (window.localStorage.getItem(LEGACY_CLEANUP_KEY)) return;
    // Earlier builds contained pre-filled sample activity. Remove those records while preserving student accounts.
    window.localStorage.removeItem('preppx-learning-data-v1');
    window.localStorage.removeItem('preppx-demo-study-log');
    window.localStorage.setItem(LEGACY_CLEANUP_KEY, 'complete');
  } catch {
    // The app can still run with an empty in-memory learning record if storage is unavailable.
  }
}

function storageKey() {
  const email = authService.getCurrentSession()?.email.toLowerCase() ?? 'unassigned';
  return `${STORAGE_KEY}:${encodeURIComponent(email)}`;
}

function emptyLog(): StudyLog {
  return {
    solvedCodingIds: [],
    savedDrafts: {},
    aptitude: {},
    attempts: [],
    completedResources: [],
    readNotifications: [],
    joinedSessionIds: [],
    totalXp: 0,
    xpAwards: [],
  };
}

function readLog(): StudyLog {
  clearOldSeededRecords();
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return emptyLog();
    const parsed = JSON.parse(raw) as Partial<StudyLog>;
    return {
      ...emptyLog(),
      ...parsed,
      solvedCodingIds: Array.isArray(parsed.solvedCodingIds) ? parsed.solvedCodingIds : [],
      savedDrafts: parsed.savedDrafts && typeof parsed.savedDrafts === 'object' ? parsed.savedDrafts : {},
      aptitude: parsed.aptitude && typeof parsed.aptitude === 'object' ? parsed.aptitude : {},
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      completedResources: Array.isArray(parsed.completedResources) ? parsed.completedResources : [],
      readNotifications: Array.isArray(parsed.readNotifications) ? parsed.readNotifications : [],
      joinedSessionIds: Array.isArray(parsed.joinedSessionIds) ? parsed.joinedSessionIds : [],
      totalXp: Number.isFinite(parsed.totalXp) ? Math.max(0, Number(parsed.totalXp)) : 0,
      xpAwards: Array.isArray(parsed.xpAwards) ? parsed.xpAwards : [],
    };
  } catch {
    return emptyLog();
  }
}

function writeLog(log: StudyLog, award?: { id: string; points: number; reason: string }) {
  let awardEvent: XpAwardEvent | null = null;
  let levelUpEvent: LevelUpEvent | null = null;

  if (award && !log.xpAwards.some((item) => item.id === award.id)) {
    const previous = levelForXp(log.totalXp);
    awardEvent = { ...award, createdAt: new Date().toISOString() };
    log.totalXp += award.points;
    log.xpAwards.unshift(awardEvent);
    const next = levelForXp(log.totalXp);
    if (next.level > previous.level) {
      levelUpEvent = {
        previousLevel: previous.level,
        currentLevel: next.level,
        levelName: next.name,
        totalXp: log.totalXp,
        xpGained: award.points,
        reason: award.reason,
      };
    }
  }

  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(log));
  } catch {
    throw new Error('Your learning activity could not be saved. Check your browser storage settings and try again.');
  }

  if (awardEvent) window.dispatchEvent(new CustomEvent<XpAwardEvent>('preppx:xp-awarded', { detail: awardEvent }));
  if (awardEvent) window.dispatchEvent(new CustomEvent('preppx:xp-updated'));
  if (levelUpEvent) window.dispatchEvent(new CustomEvent<LevelUpEvent>('preppx:level-up', { detail: levelUpEvent }));
}

export const learningService = {
  exportLegacyProgress: () => readLog(),
  // Content is intentionally empty until it is supplied by the trainer/admin content system.
  getCodingChallenges: async (): Promise<CodingChallenge[]> => [],
  getCodingDraft: (id: string) => readLog().savedDrafts[id] ?? '',
  saveCodingDraft: (id: string, code: string) => {
    const log = readLog();
    log.savedDrafts[id] = code;
    writeLog(log);
  },
  getSolvedCodingIds: () => readLog().solvedCodingIds,
  markCodingSolved: (id: string) => {
    const log = readLog();
    if (log.solvedCodingIds.includes(id)) return;
    log.solvedCodingIds.push(id);
    writeLog(log, { id: `coding:${id}`, points: 30, reason: 'Coding challenge completed' });
  },
  getAptitudeQuestions: async (): Promise<AptitudeQuestion[]> => [],
  getAptitudeProgress: () => readLog().aptitude,
  submitAptitudeAnswer: (id: string, selectedIndex: number, correct: boolean) => {
    const log = readLog();
    const isFirstAnswer = !log.aptitude[id];
    log.aptitude[id] = { selectedIndex, correct, answeredAt: new Date().toISOString() };
    writeLog(log, isFirstAnswer ? { id: `aptitude:${id}`, points: correct ? 20 : 5, reason: correct ? 'Correct aptitude answer' : 'Aptitude question attempted' } : undefined);
  },
  getAssessments: async (): Promise<Assessment[]> => [],
  getAssessmentAttempts: () => readLog().attempts,
  saveAssessmentAttempt: (attempt: AssessmentAttempt) => {
    const log = readLog();
    log.attempts.unshift(attempt);
    const points = attempt.score >= 80 ? 65 : 50;
    writeLog(log, { id: `assessment:${attempt.id}`, points, reason: attempt.score >= 80 ? 'Assessment completed · high score bonus' : 'Assessment completed' });
  },
  getVideos: async (): Promise<LearningResource[]> => [],
  getRecordings: async (): Promise<LearningResource[]> => [],
  getCompletedResourceIds: () => readLog().completedResources,
  markResourceCompleted: (id: string) => {
    const log = readLog();
    if (log.completedResources.includes(id)) return;
    log.completedResources.push(id);
    writeLog(log, { id: `resource:${id}`, points: 15, reason: 'Learning resource reviewed' });
  },
  getSessions: async () => [],
  getPastSessions: async () => [],
  getNotifications: (): StudentNotification[] => [],
  markNotificationRead: (id: string) => {
    const log = readLog();
    if (!log.readNotifications.includes(id)) log.readNotifications.push(id);
    writeLog(log);
  },
  markAllNotificationsRead: () => undefined,
  getJoinedSessionIds: () => readLog().joinedSessionIds,
  markSessionJoined: (id: string) => {
    const log = readLog();
    if (log.joinedSessionIds.includes(id)) return;
    log.joinedSessionIds.push(id);
    writeLog(log, { id: `session:${id}`, points: 25, reason: 'Live learning session joined' });
  },
  getGamificationStats: () => getGamificationStatsFromLog(readLog()),
  getProgress: () => {
    const log = readLog();
    const answered = Object.values(log.aptitude);
    const correct = answered.filter((item) => item.correct).length;
    return {
      codingSolved: log.solvedCodingIds.length,
      codingTotal: 0,
      aptitudeAnswered: answered.length,
      aptitudeAccuracy: answered.length ? Math.round((correct / answered.length) * 100) : 0,
      assessmentsCompleted: log.attempts.length,
      assessmentAverage: log.attempts.length ? Math.round(log.attempts.reduce((sum, attempt) => sum + attempt.score, 0) / log.attempts.length) : 0,
      resourcesCompleted: log.completedResources.length,
      resourcesTotal: 0,
      recentAttempts: log.attempts.slice(0, 4),
    };
  },
};
