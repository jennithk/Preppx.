import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { learningJourneyDemoService, type JourneyDemoProgress } from '../src/features/student/services/learningJourneyDemoService';

const storage = new Map<string, string>();
const previousWindow = globalThis.window;
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
    },
  },
});

after(() => {
  if (previousWindow) Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
  else Reflect.deleteProperty(globalThis, 'window');
});

const baseline: JourneyDemoProgress['completed'] = {
  coding: ['fundamentals', 'variables', 'conditionals'],
  aptitude: ['number-sense', 'percentages'],
  logic: ['patterns', 'analogies', 'classification', 'syllogisms'],
};

test('Learning Journey demo progress stays isolated and resets to its subject baselines', () => {
  storage.clear();
  const progress = learningJourneyDemoService.startDemo(baseline);

  assert.deepEqual(Object.fromEntries(Object.entries(progress.completed).map(([subject, items]) => [subject, items.length])), {
    coding: 3,
    aptitude: 2,
    logic: 4,
  });
  assert.deepEqual([...storage.keys()], ['preppx.learning-journey-demo.v1']);
  assert.throws(() => learningJourneyDemoService.completeMilestone('coding', 'functions', [
    'fundamentals', 'variables', 'conditionals', 'loops', 'functions',
  ]), /Complete the current milestone/);

  const changed = learningJourneyDemoService.completeMilestone('coding', 'loops', [
    'fundamentals', 'variables', 'conditionals', 'loops', 'functions',
  ]);
  assert.equal(changed.awarded, true);
  assert.deepEqual(changed.progress.completed.coding.slice(-1), ['loops']);

  const duplicate = learningJourneyDemoService.completeMilestone('coding', 'loops', [
    'fundamentals', 'variables', 'conditionals', 'loops', 'functions',
  ]);
  assert.equal(duplicate.awarded, false);
  assert.equal(duplicate.progress.awardedMilestones.filter((id) => id === 'coding:loops').length, 1);

  const reset = learningJourneyDemoService.resetDemo(baseline);
  assert.deepEqual(reset.completed, baseline);
  assert.equal(reset.awardedMilestones.includes('coding:loops'), false);
});
