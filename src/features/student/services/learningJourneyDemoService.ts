export const journeySubjectIds = ['coding', 'aptitude', 'logic'] as const;

export type JourneySubjectId = typeof journeySubjectIds[number];

export type JourneyDemoProgress = {
  completed: Record<JourneySubjectId, string[]>;
  awardedMilestones: string[];
};

const STORAGE_KEY = 'preppx.learning-journey-demo.v1';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isJourneyDemoProgress(value: unknown): value is JourneyDemoProgress {
  if (!value || typeof value !== 'object') return false;
  const progress = value as Record<string, unknown>;
  const completed = progress.completed;
  if (!completed || typeof completed !== 'object') return false;
  const subjects = completed as Record<string, unknown>;
  return journeySubjectIds.every((subject) => isStringArray(subjects[subject]))
    && isStringArray(progress.awardedMilestones);
}

function readStoredProgress(): JourneyDemoProgress | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    throw new Error('Demo progress could not be read. Check your browser storage settings and try again.');
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Demo progress is invalid. Reset the demo to create a fresh journey.');
  }
  if (!isJourneyDemoProgress(parsed)) {
    throw new Error('Demo progress is invalid. Reset the demo to create a fresh journey.');
  }
  return parsed;
}

function writeProgress(progress: JourneyDemoProgress) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    throw new Error('Demo progress could not be saved. Check your browser storage settings and try again.');
  }
}

function copyProgress(progress: JourneyDemoProgress): JourneyDemoProgress {
  return {
    completed: {
      coding: [...progress.completed.coding],
      aptitude: [...progress.completed.aptitude],
      logic: [...progress.completed.logic],
    },
    awardedMilestones: [...progress.awardedMilestones],
  };
}

function seedProgress(initialCompleted: Record<JourneySubjectId, string[]>): JourneyDemoProgress {
  const completed = {
    coding: [...initialCompleted.coding],
    aptitude: [...initialCompleted.aptitude],
    logic: [...initialCompleted.logic],
  };
  return {
    completed,
    awardedMilestones: journeySubjectIds.flatMap((subject) =>
      completed[subject].map((milestoneId) => `${subject}:${milestoneId}`),
    ),
  };
}

export const learningJourneyDemoService = {
  startDemo(initialCompleted: Record<JourneySubjectId, string[]>): JourneyDemoProgress {
    const existing = readStoredProgress();
    if (existing) return copyProgress(existing);
    const seeded = seedProgress(initialCompleted);
    writeProgress(seeded);
    return copyProgress(seeded);
  },

  resetDemo(initialCompleted: Record<JourneySubjectId, string[]>): JourneyDemoProgress {
    const seeded = seedProgress(initialCompleted);
    writeProgress(seeded);
    return copyProgress(seeded);
  },

  completeMilestone(
    subject: JourneySubjectId,
    milestoneId: string,
    orderedMilestoneIds: string[],
  ): { progress: JourneyDemoProgress; awarded: boolean } {
    const progress = readStoredProgress();
    if (!progress) throw new Error('Start demo mode before completing a milestone.');

    const current = copyProgress(progress);
    if (current.completed[subject].includes(milestoneId)) {
      return { progress: current, awarded: false };
    }

    const nextMilestoneId = orderedMilestoneIds.find((id) => !current.completed[subject].includes(id));
    if (nextMilestoneId !== milestoneId) {
      throw new Error('Complete the current milestone before moving further along the path.');
    }

    current.completed[subject].push(milestoneId);
    const awardId = `${subject}:${milestoneId}`;
    const awarded = !current.awardedMilestones.includes(awardId);
    if (awarded) current.awardedMilestones.push(awardId);
    writeProgress(current);
    return { progress: current, awarded };
  },

  readDemoProgress(): JourneyDemoProgress | null {
    const progress = readStoredProgress();
    return progress ? copyProgress(progress) : null;
  },
};
