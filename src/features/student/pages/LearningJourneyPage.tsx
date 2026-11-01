import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BrainCircuit,
  Check,
  CheckCircle2,
  Clock3,
  Code2,
  Lightbulb,
  LockKeyhole,
  Milestone,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { learningJourneyDemoService, type JourneyDemoProgress, type JourneySubjectId } from '../services/learningJourneyDemoService';

type LearningMilestone = {
  id: string;
  title: string;
  description: string;
  objectives: string[];
  durationMinutes: number;
  xp: number;
};

type Journey = {
  id: JourneySubjectId;
  title: string;
  shortTitle: string;
  description: string;
  icon: LucideIcon;
  milestones: LearningMilestone[];
};

const journeys: Journey[] = [
  {
    id: 'coding',
    title: 'Coding',
    shortTitle: 'Coding',
    description: 'Build confidence with core programming concepts, one focused step at a time.',
    icon: Code2,
    milestones: [
      { id: 'fundamentals', title: 'Programming Fundamentals', description: 'Get comfortable with the building blocks of a program and how instructions are executed.', objectives: ['Describe an algorithm as a sequence of steps', 'Read basic program structure', 'Use input, output and comments'], durationMinutes: 35, xp: 60 },
      { id: 'variables', title: 'Variables and Data Types', description: 'Represent information with meaningful variables and choose an appropriate data type.', objectives: ['Declare and update variables', 'Distinguish common primitive types', 'Convert values safely'], durationMinutes: 40, xp: 65 },
      { id: 'conditionals', title: 'Conditional Statements', description: 'Make a program respond to different inputs using clear decision logic.', objectives: ['Write if and else branches', 'Combine conditions with logical operators', 'Trace a decision path'], durationMinutes: 45, xp: 70 },
      { id: 'loops', title: 'Loops and Iterations', description: 'Repeat work efficiently and recognize the right loop for a task.', objectives: ['Use for and while loops', 'Track counters and running totals', 'Avoid off-by-one errors'], durationMinutes: 50, xp: 80 },
      { id: 'functions', title: 'Functions', description: 'Organize reusable logic into small functions with clear inputs and outputs.', objectives: ['Define and call functions', 'Pass parameters and return values', 'Separate a problem into steps'], durationMinutes: 50, xp: 85 },
      { id: 'arrays', title: 'Arrays', description: 'Store related values together and process collections of data.', objectives: ['Create and access arrays', 'Traverse a collection', 'Apply common search and update patterns'], durationMinutes: 55, xp: 90 },
      { id: 'oop', title: 'Object-Oriented Programming', description: 'Model a problem with objects that combine state and behavior.', objectives: ['Create classes and instances', 'Encapsulate state', 'Explain inheritance and composition'], durationMinutes: 65, xp: 100 },
      { id: 'problem-solving', title: 'Problem Solving', description: 'Turn an unfamiliar prompt into a plan, implementation and verified result.', objectives: ['Clarify constraints', 'Choose a suitable approach', 'Test edge cases and refine'], durationMinutes: 60, xp: 110 },
      { id: 'mini-project', title: 'Mini Project', description: 'Bring the fundamentals together in a small, well-structured application.', objectives: ['Plan a simple feature', 'Build and test a working solution', 'Explain implementation choices'], durationMinutes: 90, xp: 140 },
    ],
  },
  {
    id: 'aptitude',
    title: 'Aptitude',
    shortTitle: 'Aptitude',
    description: 'Strengthen numerical fluency and learn to approach quantitative questions methodically.',
    icon: Target,
    milestones: [
      { id: 'number-sense', title: 'Number Sense', description: 'Refresh number properties and build reliable mental calculation habits.', objectives: ['Compare integers and fractions', 'Use divisibility rules', 'Estimate calculations'], durationMinutes: 30, xp: 55 },
      { id: 'percentages', title: 'Percentages', description: 'Translate percentage changes into practical, step-by-step calculations.', objectives: ['Find a percentage of a value', 'Calculate percentage change', 'Solve successive change problems'], durationMinutes: 35, xp: 60 },
      { id: 'ratios', title: 'Ratios and Proportions', description: 'Compare quantities and scale relationships without losing track of units.', objectives: ['Simplify a ratio', 'Solve direct proportions', 'Share a quantity in a given ratio'], durationMinutes: 40, xp: 65 },
      { id: 'averages', title: 'Averages', description: 'Use averages to summarize a set and reason about missing values.', objectives: ['Calculate mean and weighted mean', 'Find a missing observation', 'Check how changes affect an average'], durationMinutes: 40, xp: 70 },
      { id: 'time-work', title: 'Time and Work', description: 'Model work rates to solve completion-time and combined-work questions.', objectives: ['Convert work to rates', 'Combine individual rates', 'Solve work-and-time problems'], durationMinutes: 45, xp: 80 },
      { id: 'profit-loss', title: 'Profit and Loss', description: 'Apply cost price, selling price and discount relationships to everyday scenarios.', objectives: ['Calculate profit and loss percentages', 'Apply successive discounts', 'Distinguish marked and selling price'], durationMinutes: 45, xp: 85 },
      { id: 'data-interpretation', title: 'Data Interpretation', description: 'Read charts and tables accurately before choosing a calculation.', objectives: ['Extract values from charts', 'Compare categories', 'Estimate multi-step results'], durationMinutes: 55, xp: 90 },
      { id: 'probability', title: 'Probability Basics', description: 'Count outcomes carefully and express the likelihood of an event.', objectives: ['List possible outcomes', 'Calculate simple probability', 'Use complementary events'], durationMinutes: 50, xp: 100 },
      { id: 'quantitative-review', title: 'Quantitative Review', description: 'Combine core techniques in a timed, mixed-topic practice set.', objectives: ['Select an efficient method', 'Manage time across questions', 'Review and correct mistakes'], durationMinutes: 60, xp: 120 },
    ],
  },
  {
    id: 'logic',
    title: 'Logical Reasoning',
    shortTitle: 'Reasoning',
    description: 'Develop structured thinking by spotting patterns, testing assumptions and drawing conclusions.',
    icon: BrainCircuit,
    milestones: [
      { id: 'patterns', title: 'Patterns and Sequences', description: 'Look for consistent rules behind visual and numerical sequences.', objectives: ['Compare changes between terms', 'Identify repeating structures', 'Validate the next term'], durationMinutes: 30, xp: 55 },
      { id: 'analogies', title: 'Verbal Analogies', description: 'Recognize relationships between words and apply the same relationship to a new pair.', objectives: ['Identify relationship types', 'Check direction and context', 'Eliminate near matches'], durationMinutes: 35, xp: 60 },
      { id: 'classification', title: 'Classification', description: 'Group items by shared properties and spot the item that does not fit.', objectives: ['Choose a consistent grouping rule', 'Compare multiple attributes', 'Explain the odd item out'], durationMinutes: 35, xp: 65 },
      { id: 'syllogisms', title: 'Syllogisms', description: 'Evaluate what must follow from a set of statements without adding assumptions.', objectives: ['Translate statements into sets', 'Distinguish possible from certain', 'Check conclusions independently'], durationMinutes: 45, xp: 70 },
      { id: 'seating', title: 'Order and Arrangement', description: 'Organize constraints to solve ranking and seating arrangement questions.', objectives: ['Record each constraint', 'Build a valid arrangement', 'Test all conditions'], durationMinutes: 50, xp: 80 },
      { id: 'directions', title: 'Direction Sense', description: 'Track position and orientation through a sequence of movements.', objectives: ['Map turns and direction', 'Calculate relative position', 'Use a quick coordinate sketch'], durationMinutes: 40, xp: 85 },
      { id: 'coding-decoding', title: 'Coding and Decoding', description: 'Infer a consistent transformation and apply it to new letters or symbols.', objectives: ['Compare encoded pairs', 'Identify a transformation rule', 'Verify the rule with every example'], durationMinutes: 45, xp: 90 },
      { id: 'deductions', title: 'Logical Deductions', description: 'Use linked clues to determine which conclusions are supported.', objectives: ['Separate facts from assumptions', 'Chain constraints carefully', 'Rule out contradictions'], durationMinutes: 55, xp: 100 },
      { id: 'logic-puzzle', title: 'Logic Puzzle', description: 'Solve a multi-clue puzzle by combining deduction and systematic checking.', objectives: ['Create a compact clue table', 'Narrow the valid possibilities', 'Explain the final solution'], durationMinutes: 65, xp: 120 },
    ],
  },
];

const initialCompleted: Record<JourneySubjectId, string[]> = {
  coding: ['fundamentals', 'variables', 'conditionals'],
  aptitude: ['number-sense', 'percentages'],
  logic: ['patterns', 'analogies', 'classification', 'syllogisms'],
};

const levelThresholds = [
  { level: 1, title: 'New learner', xp: 0 },
  { level: 2, title: 'Explorer', xp: 600 },
  { level: 3, title: 'Builder', xp: 1400 },
  { level: 4, title: 'Pathfinder', xp: 2500 },
] as const;

function getMilestoneStatus(milestoneId: string, milestones: LearningMilestone[], completed: string[]) {
  if (completed.includes(milestoneId)) return 'completed' as const;
  const currentId = milestones.find((item) => !completed.includes(item.id))?.id;
  return currentId === milestoneId ? 'current' as const : 'locked' as const;
}

function getDemoXp(progress: JourneyDemoProgress) {
  const milestoneXp = new Map<string, number>(
    journeys.flatMap((journey) => journey.milestones.map((milestone) => [
      `${journey.id}:${milestone.id}`,
      milestone.xp,
    ] as const)),
  );
  return progress.awardedMilestones.reduce((total, awardId) => total + (milestoneXp.get(awardId) ?? 0), 0);
}

function getLevel(xp: number) {
  return [...levelThresholds].reverse().find((level) => xp >= level.xp) ?? levelThresholds[0];
}

export function LearningJourneyPage() {
  const [demoMode, setDemoMode] = useState(false);
  const [demoProgress, setDemoProgress] = useState<JourneyDemoProgress | null>(null);
  const [activeSubject, setActiveSubject] = useState<JourneySubjectId>('coding');
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null);
  const [pathReady, setPathReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [demoError, setDemoError] = useState('');
  const [xpReward, setXpReward] = useState<number | null>(null);
  const [levelUp, setLevelUp] = useState<{ level: number; title: string } | null>(null);

  const activeJourney = journeys.find((journey) => journey.id === activeSubject) ?? journeys[0];
  const completed = demoProgress?.completed[activeSubject] ?? [];
  const currentMilestone = activeJourney.milestones.find((item) => !completed.includes(item.id));
  const completedCount = completed.length;
  const completionPercent = Math.round((completedCount / activeJourney.milestones.length) * 100);
  const demoXp = demoProgress ? getDemoXp(demoProgress) : 0;
  const demoLevel = getLevel(demoXp);

  const subjectStats = useMemo(() => journeys.map((journey) => ({
    ...journey,
    completedCount: demoProgress?.completed[journey.id].length ?? 0,
  })), [demoProgress]);

  useEffect(() => {
    setPathReady(false);
    const frame = window.requestAnimationFrame(() => setPathReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, [activeSubject, demoMode]);

  useEffect(() => {
    if (xpReward === null) return;
    const timeout = window.setTimeout(() => setXpReward(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [xpReward]);

  function startDemo() {
    try {
      const progress = learningJourneyDemoService.startDemo(initialCompleted);
      setDemoProgress(progress);
      setDemoMode(true);
      setActiveSubject('coding');
      setDemoError('');
      setNotice('');
      const firstCurrent = journeys[0].milestones.find((item) => !progress.completed.coding.includes(item.id));
      setExpandedMilestone(firstCurrent?.id ?? null);
    } catch (caught) {
      setDemoError(caught instanceof Error ? caught.message : 'Demo mode could not be started.');
    }
  }

  function resetDemo() {
    try {
      const progress = learningJourneyDemoService.resetDemo(initialCompleted);
      setDemoProgress(progress);
      setExpandedMilestone(null);
      setNotice('Demo progress is back to its starting point.');
      setDemoError('');
      setXpReward(null);
      setLevelUp(null);
    } catch (caught) {
      setDemoError(caught instanceof Error ? caught.message : 'Demo progress could not be reset.');
    }
  }

  function completeMilestone(milestone: LearningMilestone) {
    try {
      const previousXp = demoXp;
      const result = learningJourneyDemoService.completeMilestone(
        activeSubject,
        milestone.id,
        activeJourney.milestones.map((item) => item.id),
      );
      setDemoProgress(result.progress);
      setDemoError('');
      setExpandedMilestone(milestone.id);
      if (!result.awarded) {
        setNotice('This milestone has already been completed. No additional XP was awarded.');
        return;
      }

      setNotice('');
      setXpReward(milestone.xp);
      const previousLevel = getLevel(previousXp);
      const nextLevel = getLevel(getDemoXp(result.progress));
      if (nextLevel.level > previousLevel.level) {
        setXpReward(null);
        setLevelUp(nextLevel);
      }
    } catch (caught) {
      setDemoError(caught instanceof Error ? caught.message : 'Milestone completion could not be saved.');
    }
  }

  return (
    <div className="learning-journey-page">
      <header className="journey-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow__line" /> YOUR LEARNING, WITH DIRECTION</div>
          <h1>Learning <span>journey.</span></h1>
          <p>Every milestone is a small step toward skills you can put to work.</p>
        </div>
        {demoMode && (
          <button type="button" className="button button--outline journey-reset-button" onClick={resetDemo}>
            <RotateCcw size={14} /> Reset demo
          </button>
        )}
      </header>

      {!demoMode ? (
        <section className="journey-empty-panel">
          <span className="journey-empty-panel__icon"><Milestone size={21} /></span>
          <span className="journey-demo-label">OPTIONAL INTERACTIVE PREVIEW</span>
          <h2>Your learning path starts here.</h2>
          <p>Your assigned journey will appear here when it is available. Preview the interactive demo to explore sample milestones; demo progress and XP stay separate from your student account.</p>
          <button type="button" className="button button--dark" onClick={startDemo}>Preview demo journey <ArrowRight size={15} /></button>
          {demoError && <p className="journey-error" role="alert">{demoError}</p>}
        </section>
      ) : (
        <>
          <section className="journey-demo-banner" aria-label="Demo mode">
            <div className="journey-demo-banner__mark"><Sparkles size={16} /></div>
            <div className="journey-demo-banner__copy">
              <strong>DEMO MODE</strong>
              <span>Sample milestones · progress and XP are stored separately from your student account.</span>
            </div>
            <button type="button" className="journey-demo-exit" onClick={() => { setDemoMode(false); setDemoError(''); setNotice(''); }}>
              Exit demo
            </button>
          </section>

          <section className="journey-overview">
            <div className="journey-overview__identity">
              <span className="journey-overview__icon"><Trophy size={18} /></span>
              <div><span className="journey-overview__eyebrow">DEMO LEVEL {demoLevel.level}</span><strong>{demoLevel.title}</strong></div>
            </div>
            <div className="journey-overview__xp">
              <div className="journey-overview__xp-label"><span>Demo XP</span><strong>{demoXp.toLocaleString()} XP</strong></div>
              <div className="journey-overview__track" role="progressbar" aria-label="Demo XP progress to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={demoLevel.level === levelThresholds.at(-1)?.level ? 100 : Math.round(((demoXp - demoLevel.xp) / ((levelThresholds.find((item) => item.level === demoLevel.level + 1)?.xp ?? demoLevel.xp + 1) - demoLevel.xp)) * 100)}>
                <span style={{ width: `${demoLevel.level === levelThresholds.at(-1)?.level ? 100 : Math.min(100, Math.round(((demoXp - demoLevel.xp) / ((levelThresholds.find((item) => item.level === demoLevel.level + 1)?.xp ?? demoLevel.xp + 1) - demoLevel.xp)) * 100))}%` }} />
              </div>
              <small>{demoLevel.level === levelThresholds.at(-1)?.level ? 'Top demo level' : `${(levelThresholds.find((item) => item.level === demoLevel.level + 1)?.xp ?? 0) - demoXp} XP to level ${demoLevel.level + 1}`}</small>
            </div>
            <div className="journey-overview__subjects">
              {subjectStats.map((subject) => {
                const Icon = subject.icon;
                return <span key={subject.id}><Icon size={13} /> {subject.completedCount}/{subject.milestones.length}</span>;
              })}
            </div>
          </section>

          <section className="journey-path-panel">
            <div className="journey-subject-tabs" role="tablist" aria-label="Learning subjects">
              {journeys.map((journey) => {
                const Icon = journey.icon;
                const isActive = journey.id === activeSubject;
                return (
                  <button
                    key={journey.id}
                    type="button"
                    role="tab"
                    id={`journey-tab-${journey.id}`}
                    aria-selected={isActive}
                    aria-controls={`journey-panel-${journey.id}`}
                    className={`journey-subject-tab${isActive ? ' is-active' : ''}`}
                    onClick={() => { setActiveSubject(journey.id); setExpandedMilestone(null); setNotice(''); setDemoError(''); }}
                  >
                    <Icon size={16} /><span>{journey.shortTitle}</span><small>{demoProgress?.completed[journey.id].length ?? 0}/{journey.milestones.length}</small>
                  </button>
                );
              })}
            </div>

            <section
              key={activeJourney.id}
              id={`journey-panel-${activeJourney.id}`}
              role="tabpanel"
              aria-labelledby={`journey-tab-${activeJourney.id}`}
              className="journey-subject-panel"
            >
              <div className="journey-subject-heading">
                <div><span className="journey-subject-heading__eyebrow">YOUR {activeJourney.title.toUpperCase()} PATH</span><h2>{activeJourney.title}</h2><p>{activeJourney.description}</p></div>
                <div className="journey-subject-heading__progress"><strong>{completionPercent}%</strong><span>{completedCount} of {activeJourney.milestones.length} milestones</span></div>
              </div>
              <div className="journey-progress-track" role="progressbar" aria-label={`${activeJourney.title} path progress`} aria-valuemin={0} aria-valuemax={activeJourney.milestones.length} aria-valuenow={completedCount}>
                <span style={{ width: `${completionPercent}%` }} />
              </div>

              {demoError && <p className="journey-error" role="alert">{demoError}</p>}
              {notice && <p className="journey-notice" role="status">{notice}</p>}
              <ol className={`journey-timeline${pathReady ? ' is-drawn' : ''}`}>
                {activeJourney.milestones.map((milestone, index) => {
                  const status = getMilestoneStatus(milestone.id, activeJourney.milestones, completed);
                  const isExpanded = expandedMilestone === milestone.id;
                  const isCompleted = status === 'completed';
                  const statusLabel = status === 'completed' ? 'Completed' : status === 'current' ? 'Current milestone' : 'Locked';

                  return (
                    <li
                      key={milestone.id}
                      className={`journey-step journey-step--${status}${isExpanded ? ' is-expanded' : ''}`}
                      style={{ '--step-index': index } as React.CSSProperties}
                    >
                      {index < activeJourney.milestones.length - 1 && (
                        <span className={`journey-connector${index < completedCount - 1 ? ' is-complete' : ''}`} aria-hidden="true" />
                      )}
                      <article className="journey-card">
                        <button
                          type="button"
                          className="journey-card__toggle"
                          aria-expanded={isExpanded}
                          onClick={() => { setExpandedMilestone(isExpanded ? null : milestone.id); setNotice(''); }}
                        >
                          <span className="journey-card__meta"><span>STEP {String(index + 1).padStart(2, '0')}</span><span className={`journey-status journey-status--${status}`}>{statusLabel}</span></span>
                          <strong>{milestone.title}</strong>
                          <span className="journey-card__summary">{milestone.description}</span>
                        </button>
                        <div className={`journey-card__details${isExpanded ? ' is-open' : ''}`} aria-hidden={!isExpanded} inert={!isExpanded}>
                          <div className="journey-card__details-inner">
                            <p>{milestone.description}</p>
                            <div className="journey-objectives">
                              <strong>Learning objectives</strong>
                              <ul>{milestone.objectives.map((objective) => <li key={objective}><Check size={12} />{objective}</li>)}</ul>
                            </div>
                            <div className="journey-card__facts">
                              <span><Clock3 size={13} /> {milestone.durationMinutes} min</span>
                              <span><Sparkles size={13} /> {milestone.xp} demo XP</span>
                              <span>{statusLabel}</span>
                            </div>
                            <div className="journey-card__action-row">
                              {status === 'locked' ? (
                                <button type="button" className="button button--outline journey-card__action" disabled><LockKeyhole size={13} /> Complete earlier steps</button>
                              ) : (
                                <button
                                  type="button"
                                  className={`button ${isCompleted ? 'button--outline' : 'button--dark'} journey-card__action`}
                                  onClick={() => isCompleted ? setNotice(`${milestone.title} is complete. Review the objectives above any time.`) : completeMilestone(milestone)}
                                >
                                  {isCompleted ? <><CheckCircle2 size={14} /> Review milestone</> : <><ArrowRight size={14} /> Start learning</>}
                                </button>
                              )}
                              {status === 'current' && <small>Demo lesson · completion is simulated</small>}
                            </div>
                          </div>
                        </div>
                      </article>
                      <button
                        type="button"
                        className={`journey-node journey-node--${status}`}
                        aria-label={`${milestone.title}: ${statusLabel}. ${isExpanded ? 'Collapse' : 'View'} details`}
                        aria-expanded={isExpanded}
                        onClick={() => { setExpandedMilestone(isExpanded ? null : milestone.id); setNotice(''); }}
                      >
                        {isCompleted ? <Check size={17} /> : status === 'current' ? <span className="journey-node__current" /> : <LockKeyhole size={14} />}
                      </button>
                    </li>
                  );
                })}
              </ol>
              {!currentMilestone && <div className="journey-finish-state"><CheckCircle2 size={17} /><span><strong>Path complete.</strong> You have reached the end of this demo journey.</span></div>}
            </section>
          </section>
          <p className="journey-footnote"><Lightbulb size={14} /> This is a presentation demo. Milestones, progress and XP are saved only in a dedicated demo record on this device.</p>

          {xpReward !== null && (
            <div className="journey-xp-reward" role="status" aria-live="polite">
              <span><Sparkles size={17} /></span><strong>+{xpReward} demo XP</strong><small>Milestone completed</small>
            </div>
          )}
        </>
      )}

      {levelUp && demoMode && (
        <div className="journey-levelup-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLevelUp(null); }}>
          <section className="journey-levelup-dialog" role="dialog" aria-modal="true" aria-labelledby="journey-levelup-title" aria-describedby="journey-levelup-description">
            <button type="button" className="icon-button journey-levelup-close" onClick={() => setLevelUp(null)} aria-label="Close level-up message"><X size={16} /></button>
            <span className="journey-levelup-medal"><Trophy size={28} /></span>
            <span className="journey-levelup-label"><Sparkles size={13} /> DEMO LEVEL UP</span>
            <h2 id="journey-levelup-title">A new step forward.</h2>
            <p id="journey-levelup-description">Your demo progress reached level {levelUp.level} — {levelUp.title}.</p>
            <button type="button" className="button button--dark" onClick={() => setLevelUp(null)}>Continue learning <Check size={14} /></button>
          </section>
        </div>
      )}
    </div>
  );
}
