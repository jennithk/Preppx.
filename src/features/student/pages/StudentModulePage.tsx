import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowRight, ArrowUpRight, Bell, BookOpen, Check, CheckCircle2, Code2,
  ChevronLeft, ChevronRight, Clock3, FileVideo, GraduationCap,
  Info, Play, Radio, RotateCcw, Save, Search, Timer, Video, X, ImagePlus, UserRound,
} from 'lucide-react';
import type { StudentModule } from '../../../app/studentModules';
import { authService } from '../../auth/services/authService';
import { LevelProgressCard } from '../../../components/gamification/LevelProgressCard';
import { LearningJourneyPage } from './LearningJourneyPage';
import { CoursesPage } from './CoursesPage';
import { AssignmentsPage } from './AssignmentsPage';
import { LiveClassesPage } from './LiveClassesPage';
import { PublishedAssessmentsPage } from './PublishedAssessmentsPage';
import { ClassroomsPage } from './ClassroomsPage';
import { studentApi } from '../services/studentApi';
import type { LearningInterest } from '../../auth/types/auth';
import {
  learningService,
  type AptitudeProgress,
  type AptitudeQuestion,
  type Assessment,
  type AssessmentAttempt,
  type CodingChallenge,
  type Difficulty,
  type LearningResource,
  type StudentNotification,
} from '../services/learningService';

type StudentModulePageProps = { module: StudentModule };

function PageHeading({ module, action }: { module: StudentModule; action?: ReactNode }) {
  const Icon = module.icon;
  return (
    <div className="feature-heading">
      <div>
        <div className="eyebrow"><span className="eyebrow__line" /> {module.eyebrow}</div>
        <div className="feature-heading__title-row">
          <div className="feature-heading__icon"><Icon size={21} /></div>
          <h1>{module.label}</h1>
        </div>
        <p>{module.description}</p>
      </div>
      {action}
    </div>
  );
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`feature-panel ${className}`}>{children}</section>;
}

function SectionHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="feature-section-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}

function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'muted' }) {
  return <span className={`feature-chip feature-chip--${tone}`}>{children}</span>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="feature-empty"><BookOpen size={22} /><strong>{title}</strong><span>{detail}</span></div>;
}

function ModuleShell({ module, children, action }: { module: StudentModule; children: ReactNode; action?: ReactNode }) {
  return <div className="feature-page"><PageHeading module={module} action={action} />{children}</div>;
}

const difficultyTone = (difficulty: Difficulty) => difficulty === 'Beginner' ? 'muted' : difficulty === 'Advanced' ? 'success' : 'neutral';

function CodingPage({ module }: { module: StudentModule }) {
  const [challenges, setChallenges] = useState<CodingChallenge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState<'All' | Difficulty>('All');
  const [language, setLanguage] = useState('');
  const [code, setCode] = useState('');
  const [showHints, setShowHints] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    let active = true;
    learningService.getCodingChallenges().then((items) => {
      if (!active) return;
      setChallenges(items);
      setSelectedId(items[0]?.id ?? null);
    });
    return () => { active = false; };
  }, []);

  const solvedIds = learningService.getSolvedCodingIds();
  const filtered = challenges.filter((item) => {
    const matchesDifficulty = difficulty === 'All' || item.difficulty === difficulty;
    const matchesQuery = `${item.title} ${item.topic} ${item.description}`.toLowerCase().includes(query.toLowerCase());
    return matchesDifficulty && matchesQuery;
  });
  const selected = challenges.find((item) => item.id === selectedId) ?? null;
  const languages = selected ? Object.keys(selected.starterCode) : [];

  useEffect(() => {
    if (!selected) {
      setLanguage('');
      setCode('');
      return;
    }
    const firstLanguage = Object.keys(selected.starterCode)[0] ?? '';
    setLanguage(firstLanguage);
    setCode(learningService.getCodingDraft(`${selected.id}:${firstLanguage}`) || selected.starterCode[firstLanguage] || '');
    setShowHints(false);
    setSavedMessage('');
  }, [selected?.id]);

  function chooseLanguage(nextLanguage: string) {
    if (!selected) return;
    setLanguage(nextLanguage);
    setCode(learningService.getCodingDraft(`${selected.id}:${nextLanguage}`) || selected.starterCode[nextLanguage] || '');
    setSavedMessage('');
  }

  function saveDraft() {
    if (!selected || !language) return;
    try {
      learningService.saveCodingDraft(`${selected.id}:${language}`, code);
      setSavedMessage('Your draft has been saved in this browser.');
    } catch (caught) {
      setSavedMessage(caught instanceof Error ? caught.message : 'Your draft could not be saved.');
    }
  }

  return <ModuleShell module={module}>
    <div className="module-stat-strip">
      <div><span>Assigned challenges</span><strong>{challenges.length}</strong><small>Available to your account</small></div>
      <div><span>Completed challenges</span><strong>{solvedIds.filter((id) => challenges.some((item) => item.id === id)).length}</strong><small>Recorded completions</small></div>
      <div><span>Available difficulty levels</span><strong>{new Set(challenges.map((item) => item.difficulty)).size}</strong><small>Based on assigned challenges</small></div>
    </div>

    <div className="coding-workspace">
      <Panel className="coding-library">
        <SectionHeading title="Challenge library" subtitle={`${challenges.length} challenge${challenges.length === 1 ? '' : 's'} assigned`} />
        <label className="feature-search"><Search size={15} /><input aria-label="Search coding challenges" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search challenges or topics" /></label>
        <div className="feature-filter-row" aria-label="Filter by difficulty">
          {(['All', 'Beginner', 'Intermediate', 'Advanced'] as const).map((item) => <button key={item} type="button" className={`filter-chip ${difficulty === item ? 'is-selected' : ''}`} onClick={() => setDifficulty(item)}>{item}</button>)}
        </div>
        {filtered.length ? <div className="challenge-list">{filtered.map((item) => <button key={item.id} type="button" className={`challenge-list__item ${selectedId === item.id ? 'is-active' : ''}`} onClick={() => setSelectedId(item.id)}><span className="challenge-list__status">{solvedIds.includes(item.id) ? <CheckCircle2 size={15} /> : <Code2 size={15} />}</span><span className="challenge-list__copy"><strong>{item.title}</strong><small>{item.topic} · {item.difficulty} · {item.estimatedMinutes} min</small></span></button>)}</div> : <EmptyState title={challenges.length ? 'No matching challenges' : 'No challenges assigned yet'} detail={challenges.length ? 'Try another search term or difficulty filter.' : 'Your coding workspace is ready. Assigned challenges will appear here when they are published for your account.'} />}
      </Panel>

      {selected ? <div className="coding-main-column">
        <Panel>
          <div className="challenge-title-row"><div><div className="feature-overline">{selected.topic.toUpperCase()}</div><h2>{selected.title}</h2><div className="feature-inline-meta"><span><Chip tone={difficultyTone(selected.difficulty)}>{selected.difficulty}</Chip></span><span><Clock3 size={13} /> {selected.estimatedMinutes} min</span></div></div>{solvedIds.includes(selected.id) && <Chip tone="success"><CheckCircle2 size={12} /> Completed</Chip>}</div>
          <p className="challenge-description">{selected.description}</p>
          <div className="example-block"><span>INPUT</span><span>EXPECTED OUTPUT</span><code>{selected.input || 'No sample input supplied'}</code><code>{selected.output || 'No expected output supplied'}</code></div>
          {selected.constraints.length > 0 && <div className="challenge-constraints"><strong>Constraints</strong><ul>{selected.constraints.map((constraint) => <li key={constraint}>{constraint}</li>)}</ul></div>}
          {selected.hints.length > 0 && <><button type="button" className="text-action" onClick={() => setShowHints((value) => !value)}>{showHints ? 'Hide hints' : 'Show hints'} <ArrowUpRight size={13} /></button>{showHints && <ul className="hint-list">{selected.hints.map((hint, index) => <li key={`${selected.id}-hint-${index}`}>{hint}</li>)}</ul>}</>}
        </Panel>
        <Panel className="code-editor-panel">
          <div className="editor-toolbar"><div><span className="editor-dots"><i /><i /><i /></span><strong>Code workspace</strong></div><div><label className="visually-hidden" htmlFor="coding-language">Programming language</label><select id="coding-language" value={language} onChange={(event) => chooseLanguage(event.target.value)}>{languages.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></div>
          <textarea className="code-editor" spellCheck={false} aria-label="Your code" value={code} onChange={(event) => { setCode(event.target.value); setSavedMessage(''); }} placeholder="Write your solution here…" />
          <div className="editor-footer"><span>{savedMessage || 'Save a draft to keep your work in this browser. Code execution will be connected later.'}</span><div><button type="button" className="button button--outline" onClick={() => { setCode(selected.starterCode[language] ?? ''); setSavedMessage('Starter code restored.'); }}><RotateCcw size={13} /> Reset</button><button type="button" className="button button--dark" onClick={saveDraft}><Save size={13} /> Save draft</button></div></div>
        </Panel>
        <p className="feature-note"><Info size={14} /> Code execution and submission are not enabled in this frontend milestone. Your draft is stored only in this browser.</p>
      </div> : <div className="coding-main-column"><Panel><EmptyState title="Your coding workspace is ready" detail="Select an assigned challenge from the library to view its problem statement and editor." /></Panel></div>}
    </div>
  </ModuleShell>;
}

function AptitudePage({ module }: { module: StudentModule }) {
  const [questions, setQuestions] = useState<AptitudeQuestion[]>([]);
  const [progress, setProgress] = useState<AptitudeProgress>(() => learningService.getAptitudeProgress());
  const [topic, setTopic] = useState('All topics');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    learningService.getAptitudeQuestions().then((items) => { if (active) setQuestions(items); });
    return () => { active = false; };
  }, []);

  const topics = ['All topics', ...Array.from(new Set(questions.map((item) => item.topic)))];
  const filtered = questions.filter((item) => topic === 'All topics' || item.topic === topic);
  const current = filtered[questionIndex] ?? null;
  const answeredCount = Object.keys(progress).length;
  const correctCount = Object.values(progress).filter((item) => item.correct).length;
  const accuracy = answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0;

  useEffect(() => {
    if (!current) {
      setSelectedAnswer(null);
      setSubmitted(false);
      return;
    }
    const saved = progress[current.id];
    setSelectedAnswer(saved?.selectedIndex ?? null);
    setSubmitted(Boolean(saved));
  }, [current?.id]);

  function submitAnswer() {
    if (!current || selectedAnswer === null || submitted) return;
    const correct = selectedAnswer === current.answerIndex;
    learningService.submitAptitudeAnswer(current.id, selectedAnswer, correct);
    setProgress(learningService.getAptitudeProgress());
    setSubmitted(true);
  }

  function moveQuestion(nextIndex: number) {
    setQuestionIndex(nextIndex);
    const next = filtered[nextIndex];
    const saved = next ? learningService.getAptitudeProgress()[next.id] : undefined;
    setSelectedAnswer(saved?.selectedIndex ?? null);
    setSubmitted(Boolean(saved));
  }

  return <ModuleShell module={module}>
    <div className="module-stat-strip">
      <div><span>Questions answered</span><strong>{answeredCount}</strong><small>Your submitted answers</small></div>
      <div><span>Correct answers</span><strong>{correctCount}</strong><small>Based on published questions</small></div>
      <div><span>Accuracy</span><strong>{answeredCount ? `${accuracy}%` : '—'}</strong><small>Calculated from your answers</small></div>
    </div>
    <Panel>
      <div className="practice-toolbar"><div><SectionHeading title="Aptitude and reasoning" subtitle="Work through questions assigned to your student account." /></div>{questions.length > 0 && <Chip>{filtered.length} question{filtered.length === 1 ? '' : 's'}</Chip>}</div>
      {questions.length > 0 ? <>
        <div className="feature-filter-row" aria-label="Filter aptitude questions by topic">{topics.map((item) => <button type="button" key={item} className={`filter-chip ${topic === item ? 'is-selected' : ''}`} onClick={() => { setTopic(item); setQuestionIndex(0); }}>{item}</button>)}</div>
        {current ? <div className="question-card">
          <div className="question-card__top"><span>QUESTION {questionIndex + 1} OF {filtered.length}</span><div><Chip>{current.topic}</Chip><Chip tone={difficultyTone(current.difficulty)}>{current.difficulty}</Chip></div></div>
          <h2>{current.question}</h2>
          <div className="answer-options">{current.options.map((option, optionIndex) => {
            const isChosen = selectedAnswer === optionIndex;
            const isCorrect = submitted && optionIndex === current.answerIndex;
            const isWrong = submitted && isChosen && optionIndex !== current.answerIndex;
            return <button key={`${current.id}-${optionIndex}`} type="button" disabled={submitted} className={`answer-option ${isChosen ? 'is-chosen' : ''} ${isCorrect ? 'is-correct' : ''} ${isWrong ? 'is-wrong' : ''}`} onClick={() => setSelectedAnswer(optionIndex)}><span className="answer-option__letter">{String.fromCharCode(65 + optionIndex)}</span>{option}{isCorrect && <CheckCircle2 size={15} />}</button>;
          })}</div>
          {submitted && <div className="answer-explanation"><strong>{progress[current.id]?.correct ? 'Correct answer' : 'Answer saved'}</strong><p>{current.explanation}</p></div>}
          <div className="question-actions"><span className="feature-muted">{submitted ? 'Your answer is saved on this device.' : 'Choose one answer, then submit.'}</span><div className="auth-form__actions"><button type="button" className="button button--outline" disabled={questionIndex === 0} onClick={() => moveQuestion(questionIndex - 1)}><ChevronLeft size={14} /> Previous</button>{!submitted ? <button type="button" className="button button--dark" disabled={selectedAnswer === null} onClick={submitAnswer}>Submit answer <Check size={14} /></button> : <button type="button" className="button button--dark" disabled={questionIndex >= filtered.length - 1} onClick={() => moveQuestion(questionIndex + 1)}>Next question <ChevronRight size={14} /></button>}</div></div>
        </div> : <EmptyState title="No questions in this topic" detail="Choose another topic to continue." />}
      </> : <EmptyState title="No practice questions published yet" detail="Your trainer has not published aptitude or reasoning questions for your account yet. This workspace will show your assigned questions here." />}
    </Panel>
    <p className="feature-note"><Info size={14} /> Your submitted practice answers are saved in this browser preview. Official question content and evaluation will come from the connected learning platform.</p>
  </ModuleShell>;
}

export function AssessmentsPage({ module }: { module: StudentModule }) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [attempts, setAttempts] = useState<AssessmentAttempt[]>(learningService.getAssessmentAttempts());
  const [active, setActive] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [result, setResult] = useState<AssessmentAttempt | null>(null);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => { learningService.getAssessments().then(setAssessments); }, []);
  useEffect(() => {
    if (!started) return;
    const timer = window.setInterval(() => setSecondsLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [started]);

  const currentQuestion = active?.questions[questionIndex];
  const answered = active ? Object.keys(answers).filter((id) => active.questions.some((item) => item.id === id)).length : 0;

  function begin(test: Assessment) {
    setActive(test);
    setAnswers({});
    setQuestionIndex(0);
    setResult(null);
    setShowReview(false);
    setSecondsLeft(test.durationMinutes * 60);
    setStarted(true);
  }

  function finish() {
    if (!active || result) return;
    const correct = active.questions.filter((question) => answers[question.id] === question.answerIndex).length;
    const attempt: AssessmentAttempt = {
      id: `attempt-${Date.now()}`, assessmentId: active.id, title: active.title,
      score: Math.round((correct / active.questions.length) * 100), total: active.totalMarks,
      correct, completedAt: new Date().toISOString(),
    };
    learningService.saveAssessmentAttempt(attempt);
    setAttempts(learningService.getAssessmentAttempts());
    setResult(attempt);
    setStarted(false);
  }

  useEffect(() => {
    if (started && secondsLeft === 0 && active && !result) finish();
    // finish is intentionally invoked only when the countdown reaches zero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, started, active, result]);

  function closeTest() {
    setActive(null);
    setStarted(false);
    setResult(null);
    setAnswers({});
  }

  if (active && result) {
    return <ModuleShell module={module}>
      <Panel className="assessment-result">
        <div className="assessment-result__icon"><GraduationCap size={25} /></div>
        <div className="feature-overline">ASSESSMENT COMPLETED</div>
        <h2>{result.score}%</h2>
        <p>You answered {result.correct} out of {active.questions.length} questions correctly in <strong>{active.title}</strong>.</p>
        <div className="result-stat-row"><div><span>Correct</span><strong>{result.correct}</strong></div><div><span>Total questions</span><strong>{active.questions.length}</strong></div><div><span>Score</span><strong>{result.score}%</strong></div></div>
        <div className="assessment-result__actions"><button className="button button--outline" onClick={() => setShowReview((value) => !value)}>{showReview ? 'Hide review' : 'Review answers'}</button><button className="button button--dark" onClick={closeTest}>Back to test papers</button></div>
        {showReview && <div className="review-answer-list">{active.questions.map((question, itemIndex) => <div key={question.id}><strong>{itemIndex + 1}. {question.question}</strong><p>Your answer: {answers[question.id] === undefined ? 'Not answered' : question.options[answers[question.id]]}</p><p>Correct answer: {question.options[question.answerIndex]}</p><small>{question.explanation}</small></div>)}</div>}
      </Panel>
    </ModuleShell>;
  }

  if (active && currentQuestion) {
    const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
    const seconds = (secondsLeft % 60).toString().padStart(2, '0');
    return <ModuleShell module={module} action={<button className="button button--outline" onClick={() => { if (window.confirm('Submit this assessment now?')) finish(); }}>Submit test</button>}>
      <Panel className="test-taking-panel">
        <div className="test-taking-top"><div><div className="feature-overline">{active.category.toUpperCase()}</div><h2>{active.title}</h2></div><div className="test-timer"><Timer size={16} /><strong>{minutes}:{seconds}</strong><span>remaining</span></div></div>
        <div className="test-progress-row"><span>{answered} of {active.questions.length} answered</span><span>Question {questionIndex + 1} / {active.questions.length}</span></div>
        <div className="test-progress-track"><span style={{ width: `${(answered / active.questions.length) * 100}%` }} /></div>
        <div className="test-question"><span className="feature-overline">QUESTION {questionIndex + 1}</span><h2>{currentQuestion.question}</h2><div className="answer-options">{currentQuestion.options.map((option, optionIndex) => <button key={option} className={`answer-option ${answers[currentQuestion.id] === optionIndex ? 'is-chosen' : ''}`} onClick={() => setAnswers((current) => ({ ...current, [currentQuestion.id]: optionIndex }))}><span className="answer-option__letter">{String.fromCharCode(65 + optionIndex)}</span>{option}</button>)}</div></div>
        <div className="test-navigation"><button className="button button--outline" disabled={questionIndex === 0} onClick={() => setQuestionIndex((current) => current - 1)}><ChevronLeft size={15} /> Previous</button><div>{active.questions.map((question, itemIndex) => <button key={question.id} aria-label={`Go to question ${itemIndex + 1}`} className={`test-dot ${questionIndex === itemIndex ? 'is-current' : ''} ${answers[question.id] !== undefined ? 'is-answered' : ''}`} onClick={() => setQuestionIndex(itemIndex)}>{itemIndex + 1}</button>)}</div><button className="button button--dark" onClick={() => questionIndex === active.questions.length - 1 ? (window.confirm('Submit your answers?') && finish()) : setQuestionIndex((current) => current + 1)}>{questionIndex === active.questions.length - 1 ? 'Finish' : 'Next'} <ChevronRight size={15} /></button></div>
        <p className="feature-note"><Info size={14} /> Assessment history is associated with your account in this browser preview. Official results will be provided by the connected platform.</p>
      </Panel>
    </ModuleShell>;
  }

  return <ModuleShell module={module}>
    <div className="module-stat-strip"><div><span>Tests available</span><strong>{assessments.length}</strong><small>Practice assessments</small></div><div><span>Completed attempts</span><strong>{attempts.length}</strong><small>Saved on this device</small></div><div><span>Average score</span><strong>{attempts.length ? `${Math.round(attempts.reduce((sum, item) => sum + item.score, 0) / attempts.length)}%` : '—'}</strong><small>Across completed attempts</small></div></div>
    <Panel><SectionHeading title="Available test papers" subtitle="Assessments assigned to your account will appear here." />{assessments.length ? <div className="assessment-grid">{assessments.map((test) => <article className="assessment-card" key={test.id}><div className="assessment-card__top"><span className="resource-icon"><ClipboardIcon /></span><Chip tone={difficultyTone(test.difficulty)}>{test.difficulty}</Chip></div><div className="feature-overline">{test.category.toUpperCase()}</div><h3>{test.title}</h3><p>{test.description}</p><div className="resource-meta"><span><Clock3 size={13} /> {test.durationMinutes} min</span><span><BookOpen size={13} /> {test.questions.length} questions</span><span>{test.totalMarks} marks</span></div><button className="button button--dark button--full" onClick={() => begin(test)}>Start assessment <ArrowRight size={14} /></button></article>)}</div> : <EmptyState title="No test papers published yet" detail="Assessments will appear here once they are assigned to your student account." />}</Panel>
    {attempts.length > 0 && <Panel><SectionHeading title="Previous attempts" subtitle="Your completed assessment attempts." /><div className="table-scroll"><table className="feature-table"><thead><tr><th>Assessment</th><th>Score</th><th>Correct</th><th>Completed</th></tr></thead><tbody>{attempts.map((attempt) => <tr key={attempt.id}><td>{attempt.title}</td><td><strong>{attempt.score}%</strong></td><td>{attempt.correct}/{attempt.total}</td><td>{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(attempt.completedAt))}</td></tr>)}</tbody></table></div></Panel>}
  </ModuleShell>;
}

function ClipboardIcon() { return <BookOpen size={18} />; }

function ResourceDialog({ resource, onClose, onComplete, completed }: { resource: LearningResource; onClose: () => void; onComplete: () => void; completed: boolean }) {
  return <div className="feature-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="feature-dialog" role="dialog" aria-modal="true" aria-labelledby="resource-dialog-title"><div className="feature-dialog__top"><Chip>{resource.kind === 'video' ? 'VIDEO RESOURCE' : 'CLASS RECORDING'}</Chip><button className="icon-button" onClick={onClose} aria-label="Close details"><X size={17} /></button></div><div className="resource-preview"><div className="resource-preview__pattern"><span>PREPPX</span><div className="resource-preview__play"><Play size={24} fill="currentColor" /></div></div><p><Info size={14} /> The media player will be available when this resource is published with its playback link.</p></div><h2 id="resource-dialog-title">{resource.title}</h2><p className="feature-muted">{resource.description}</p><div className="session-dialog__details"><div><GraduationCap size={15} /> {resource.trainer}</div><div><Clock3 size={15} /> {resource.duration}</div><div><BookOpen size={15} /> {resource.category}{resource.day ? ` · ${resource.day}` : ''}</div></div><div className="feature-dialog__actions"><button className="button button--outline" onClick={onClose}>Close</button><button className="button button--dark" onClick={onComplete} disabled={completed}>{completed ? <><Check size={14} /> Marked reviewed</> : <><CheckCircle2 size={14} /> Mark as reviewed</>}</button></div></section></div>;
}

function ResourcesPage({ module, kind }: { module: StudentModule; kind: 'video' | 'recording' }) {
  const [items, setItems] = useState<LearningResource[]>([]);
  const [selected, setSelected] = useState<LearningResource | null>(null);
  const [completed, setCompleted] = useState<string[]>(learningService.getCompletedResourceIds());
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  useEffect(() => { (kind === 'video' ? learningService.getVideos() : learningService.getRecordings()).then(setItems); }, [kind]);
  const categories = ['All', ...Array.from(new Set(items.map((item) => item.category)))];
  const filtered = items.filter((item) => (category === 'All' || item.category === category) && `${item.title} ${item.description}`.toLowerCase().includes(query.toLowerCase()));
  function markComplete(item: LearningResource) { learningService.markResourceCompleted(item.id); setCompleted(learningService.getCompletedResourceIds()); }
  return <ModuleShell module={module}>
    <Panel>
      {items.length > 0 ? <>
        <div className="resource-toolbar"><label className="feature-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${kind === 'video' ? 'videos' : 'class recordings'}`} /></label><div className="feature-filter-row">{categories.map((item) => <button key={item} className={`filter-chip ${category === item ? 'is-selected' : ''}`} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
        <div className="resource-grid">{filtered.map((item, index) => <article className="resource-card" key={item.id}><button className={`resource-card__cover resource-card__cover--${(index % 4) + 1}`} onClick={() => setSelected(item)} aria-label={`View ${item.title}`}><span className="resource-card__cover-brand">PREPPX / {item.kind === 'video' ? 'LEARN' : item.day?.toUpperCase()}</span><span className="resource-card__cover-icon">{kind === 'video' ? <Video size={27} /> : <FileVideo size={27} />}</span><span className="resource-card__duration"><Play size={11} /> {item.duration}</span></button><div className="resource-card__body"><div className="resource-card__meta"><Chip>{item.category}</Chip>{completed.includes(item.id) && <Chip tone="success"><Check size={11} /> Reviewed</Chip>}</div><h3>{item.title}</h3><p>{item.description}</p><div className="resource-card__footer"><span>{item.trainer}</span><button className="text-action" onClick={() => setSelected(item)}>View details <ArrowUpRight size={13} /></button></div></div></article>)}</div>
        {filtered.length === 0 && <EmptyState title="No matching resources" detail="Try another search term or category." />}
      </> : <EmptyState title={kind === 'video' ? 'No learning videos published yet' : 'No class recordings published yet'} detail={kind === 'video' ? 'Videos assigned to your account will appear here.' : 'Your completed class recordings will appear here once they are shared with you.'} />}
    </Panel>
    {selected && <ResourceDialog resource={selected} onClose={() => setSelected(null)} onComplete={() => markComplete(selected)} completed={completed.includes(selected.id)} />}
  </ModuleShell>;
}

function SessionDetails({ session, onClose }: { session: import('../../../types/student').UpcomingSession; onClose: () => void }) {
  return <div className="feature-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="feature-dialog" role="dialog" aria-modal="true" aria-labelledby="session-detail-title"><div className="feature-dialog__top"><Chip>{session.format}</Chip><button className="icon-button" onClick={onClose} aria-label="Close session details"><X size={17} /></button></div><h2 id="session-detail-title">{session.title}</h2><p className="feature-muted">{session.description}</p><div className="session-dialog__details"><div><CalendarDaysIcon /> {session.dateLabel} · {session.dateKey}</div><div><Clock3 size={15} /> {session.timeLabel}</div><div><GraduationCap size={15} /> {session.trainer}</div><div><BookOpen size={15} /> {session.topic}</div></div><div className="feature-note"><Info size={14} /> Meeting links and attendance information will appear when the session is published for your account.</div><div className="feature-dialog__actions"><button className="button button--dark" onClick={onClose}>Done</button></div></section></div>;
}

function CalendarDaysIcon() { return <Clock3 size={15} />; }

export function LiveSessionsPage({ module }: { module: StudentModule }) {
  const [sessions, setSessions] = useState<import('../../../types/student').UpcomingSession[]>([]);
  const [selected, setSelected] = useState<import('../../../types/student').UpcomingSession | null>(null);
  const [filter, setFilter] = useState('All');
  useEffect(() => { learningService.getSessions().then(setSessions); }, []);
  const filtered = sessions.filter((item) => filter === 'All' || (filter === 'Today' ? item.dateLabel === 'Today' : item.dateLabel !== 'Today'));
  return <ModuleShell module={module}>
    <Panel><SectionHeading title="Your live learning schedule" subtitle="Review the upcoming instructor-led learning sessions." action={<Radio size={18} className="feature-muted" />} /><div className="feature-filter-row">{['All', 'Today', 'Later'].map((item) => <button key={item} className={`filter-chip ${filter === item ? 'is-selected' : ''}`} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="session-feature-list">{filtered.map((item) => <article className="session-feature-card" key={item.id}><div className="session-feature-card__date"><span>{item.dateLabel}</span><strong>{item.dayOfMonth}</strong></div><div className="session-feature-card__main"><div className="feature-overline">{item.topic.toUpperCase()}</div><h3>{item.title}</h3><p>{item.timeLabel} · {item.durationMinutes} minutes</p><span className="feature-muted">Trainer: {item.trainer}</span></div><div className="session-feature-card__actions"><Chip>{item.format}</Chip><button className="button button--outline" onClick={() => setSelected(item)}>Session details <ArrowUpRight size={13} /></button></div></article>)}{filtered.length === 0 && <EmptyState title="No sessions in this view" detail="Try another filter to see your schedule." />}</div></Panel>
    <div className="feature-callout"><Radio size={19} /><div><strong>Live learning</strong><p>Published live sessions and joining details will appear here when they are assigned to your account.</p></div></div>
    {selected && <SessionDetails session={selected} onClose={() => setSelected(null)} />}
  </ModuleShell>;
}

function SessionsPage({ module }: { module: StudentModule }) {
  const [upcoming, setUpcoming] = useState<import('../../../types/student').UpcomingSession[]>([]);
  const [past, setPast] = useState<import('../../../types/student').UpcomingSession[]>([]);
  const [selected, setSelected] = useState<import('../../../types/student').UpcomingSession | null>(null);
  const [filter, setFilter] = useState('Upcoming');
  useEffect(() => { learningService.getSessions().then(setUpcoming); learningService.getPastSessions().then(setPast); }, []);
  const visible = filter === 'Past' ? past : filter === 'Today' ? upcoming.filter((item) => item.dateLabel === 'Today') : filter === 'Day-wise' ? upcoming : upcoming;
  const grouped = filter === 'Day-wise' ? visible.reduce<Record<string, typeof visible>>((groups, item) => { const key = item.dateLabel === 'Today' ? 'Today' : item.dateLabel === 'Tomorrow' ? 'Tomorrow' : 'Upcoming days'; (groups[key] ??= []).push(item); return groups; }, {}) : { [filter === 'Past' ? 'Past sessions' : filter === 'Today' ? 'Today' : 'Upcoming sessions']: visible };
  return <ModuleShell module={module}>
    <Panel><SectionHeading title="Training calendar" subtitle="A single view of your daily, upcoming and completed sessions." /><div className="feature-filter-row">{['Upcoming', 'Today', 'Day-wise', 'Past'].map((item) => <button key={item} className={`filter-chip ${filter === item ? 'is-selected' : ''}`} onClick={() => setFilter(item)}>{item}</button>)}</div>{Object.entries(grouped).map(([group, items]) => <div className="session-group" key={group}><h3>{group}</h3>{items.map((item) => <button className="session-feature-card session-feature-card--button" key={item.id} onClick={() => setSelected(item)}><div className="session-feature-card__date"><span>{item.dateLabel}</span><strong>{item.dayOfMonth}</strong></div><div className="session-feature-card__main"><div className="feature-overline">{item.topic.toUpperCase()}</div><h3>{item.title}</h3><p>{item.timeLabel} · {item.trainer}</p></div><div className="session-feature-card__actions"><Chip tone={item.status === 'Completed' ? 'muted' : 'neutral'}>{item.status}</Chip><ArrowUpRight size={16} /></div></button>)}{items.length === 0 && <EmptyState title="Nothing scheduled here" detail="There are no sessions in this category yet." />}</div>)}</Panel>
    {selected && <SessionDetails session={selected} onClose={() => setSelected(null)} />}
  </ModuleShell>;
}

function NotificationsPage({ module }: { module: StudentModule }) {
  const [items, setItems] = useState<StudentNotification[]>([]);
  const [filter, setFilter] = useState('All');
  const [error, setError] = useState('');
  async function refresh() {
    try {
      const { announcements } = await studentApi<{ announcements: { id: string; title: string; body: string; published_at: string; read: boolean }[] }>('/announcements');
      setItems(announcements.map((item) => ({ id: item.id, title: item.title, message: item.body, category: 'Platform', createdAt: item.published_at, read: item.read })));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Announcements could not be loaded.');
    }
  }
  useEffect(() => { void refresh(); }, []);
  async function markRead(id: string) {
    try {
      await studentApi<void>(`/announcements/${id}/read`, { method: 'POST', body: '{}' });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The announcement could not be marked as read.');
    }
  }
  async function markAll() {
    try {
      await Promise.all(items.filter((item) => !item.read).map((item) => studentApi<void>(`/announcements/${item.id}/read`, { method: 'POST', body: '{}' })));
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Announcements could not be marked as read.');
    }
  }
  const visible = items.filter((item) => filter === 'All' || (filter === 'Unread' ? !item.read : item.category === filter));
  const unread = items.filter((item) => !item.read).length;
  return <ModuleShell module={module} action={unread > 0 ? <button className="button button--outline" onClick={markAll}>Mark all read <Check size={14} /></button> : undefined}>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="module-stat-strip"><div><span>Total notifications</span><strong>{items.length}</strong><small>Platform updates</small></div><div><span>Unread</span><strong>{unread}</strong><small>Need your attention</small></div><div><span>Read</span><strong>{items.length - unread}</strong><small>Already reviewed</small></div></div>
    <Panel><div className="feature-filter-row">{['All', 'Unread', 'Sessions', 'Learning', 'Platform'].map((item) => <button key={item} className={`filter-chip ${filter === item ? 'is-selected' : ''}`} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="notification-list">{visible.map((item) => <article key={item.id} className={`notification-item ${item.read ? '' : 'notification-item--unread'}`}><div className="notification-item__icon"><Bell size={17} /></div><div className="notification-item__main"><div className="notification-item__meta"><Chip>{item.category}</Chip><span>{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</span></div><h3>{item.title}</h3><p>{item.message}</p></div>{!item.read && <button className="button button--outline" onClick={() => markRead(item.id)}>Mark read</button>}</article>)}{visible.length === 0 && <EmptyState title="You're all caught up" detail="There are no notifications in this filter." />}</div></Panel>
  </ModuleShell>;
}

const interestOptions: LearningInterest[] = ['Coding and programming', 'Non-coding activities', 'Technical subjects', 'Non-technical subjects'];

function formatAccountDate(value?: string) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date);
}

function ProfilePage({ module }: { module: StudentModule }) {
  const initialProfile = authService.getCurrentStudentProfile();
  const [profile, setProfile] = useState(initialProfile);
  const [fullName, setFullName] = useState(initialProfile?.fullName ?? '');
  const [phone, setPhone] = useState(initialProfile?.phone ?? '');
  const [interests, setInterests] = useState<LearningInterest[]>(initialProfile?.interests ?? []);
  const [profileImageName, setProfileImageName] = useState(initialProfile?.profileImageName ?? '');
  const [profileImageDataUrl, setProfileImageDataUrl] = useState(initialProfile?.profileImageDataUrl ?? '');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  function toggleInterest(item: LearningInterest) {
    setInterests((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  }

  function handlePhoto(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPG, PNG or WEBP image.');
      return;
    }
    if (file.size > 1_500_000) {
      setError('Choose an image smaller than 1.5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProfileImageName(file.name);
      setProfileImageDataUrl(String(reader.result));
      setError('');
    };
    reader.onerror = () => setError('The selected image could not be read.');
    reader.readAsDataURL(file);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    setError('');
    if (fullName.trim().length < 2) return setError('Enter your full name.');
    if (!/^\+?[0-9\s()-]{10,16}$/.test(phone.trim())) return setError('Enter a valid phone number.');
    if (interests.length === 0) return setError('Select at least one learning interest.');
    try {
      const updated = await authService.updateCurrentStudentProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
        interests,
        profileImageName,
        profileImageDataUrl: profileImageDataUrl || undefined,
      });
      setProfile(updated);
      setNotice('Your account details have been saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your account details.');
    }
  }

  const initials = fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'S';
  const photo = profileImageDataUrl || profile?.profileImageDataUrl;

  return <ModuleShell module={module}>
    <div className="profile-layout">
      <Panel>
        <SectionHeading title="My account details" subtitle="These details come from the information you entered during registration. You can update them here." />
        {profile ? <form className="profile-form" onSubmit={save}>
          <div className="profile-identity">
            <div className="profile-identity__avatar">{photo ? <img src={photo} alt="Your profile" /> : initials}</div>
            <div><strong>{profile.fullName}</strong><small>{profile.email}</small></div>
          </div>
          <label className="upload-field profile-photo-upload"><span className="upload-field__icon">{photo ? <img className="registration-avatar-preview" src={photo} alt="Selected profile" /> : <ImagePlus size={18} />}</span><span><strong>{profileImageName || 'Add or update profile picture'}</strong><small>Optional · JPG, PNG or WEBP · up to 1.5 MB</small></span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handlePhoto(event.target.files?.[0])} /></label>
          <label className="form-field"><span className="form-field__label-row">Full name</span><input className="feature-input" autoComplete="name" required minLength={2} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
          <label className="form-field"><span className="form-field__label-row">Email address</span><input className="feature-input" type="email" value={profile.email} readOnly aria-readonly="true" /><small className="field-help">Your registered email is used as your account identity.</small></label>
          <label className="form-field"><span className="form-field__label-row">Phone number</span><input className="feature-input" type="tel" autoComplete="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
          <fieldset className="interest-fieldset"><legend>Learning interests</legend><div className="profile-interest-grid">{interestOptions.map((item) => <label key={item} className={`profile-interest ${interests.includes(item) ? 'is-selected' : ''}`}><input type="checkbox" checked={interests.includes(item)} onChange={() => toggleInterest(item)} /><span>{item}</span>{interests.includes(item) && <Check size={14} />}</label>)}</div></fieldset>
          {error && <div className="form-error" role="alert">{error}</div>}
          {notice && <div className="form-success" role="status">{notice}</div>}
          <button className="button button--dark" type="submit">Save account details <Check size={14} /></button>
        </form> : <EmptyState title="No account details found" detail="Please sign in with the student account you registered on this browser." />}
      </Panel>
      <Panel className="profile-summary">
        <div className="profile-summary__icon">{photo ? <img src={photo} alt="" /> : <UserRound size={20} />}</div>
        <div className="feature-overline">MY ACCOUNT</div>
        <h2>{profile?.fullName || 'Student account'}</h2>
        <p>{profile?.email || 'Your registered email address will appear here.'}</p>
        <div className="profile-summary__row"><span>Phone</span><strong>{profile?.phone || 'Not provided'}</strong></div>
        <div className="profile-summary__row"><span>Learning interests</span><strong>{interests.length}</strong></div>
        <div className="profile-summary__row"><span>Account created</span><strong>{formatAccountDate(profile?.createdAt)}</strong></div>
        <div className="feature-note"><Info size={14} /> Your name, phone number and learning interests are saved to your PREPPX account. Profile photos remain on this device.</div>
      </Panel>
    </div>
  </ModuleShell>;
}

function ProgressPage({ module }: { module: StudentModule }) {
  const [progress, setProgress] = useState<{
    totalXp: number;
    level: number;
    levelName: string;
    courses: { id: string; title: string; subject: string; lessons_total: number; lessons_completed: number }[];
    activity: { activity_type: string; subject: string | null; occurred_at: string }[];
    assessmentAttempts: { id: string; title: string; score: number | null; total_marks: number | null; submitted_at: string | null; feedback: string | null }[];
    assignmentSubmissions: { id: string; title: string; status: string; score: number | null; max_marks: number | null; feedback: string; submitted_at: string }[];
  } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const update = () => studentApi<typeof progress extends infer T ? NonNullable<T> : never>('/progress')
      .then((result) => { if (active) { setProgress(result); setError(''); } })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : 'Learning progress could not be loaded.'); });
    void update();
    window.addEventListener('focus', update);
    return () => { active = false; window.removeEventListener('focus', update); };
  }, []);
  const lessonsTotal = progress?.courses.reduce((sum, course) => sum + course.lessons_total, 0) ?? 0;
  const lessonsCompleted = progress?.courses.reduce((sum, course) => sum + course.lessons_completed, 0) ?? 0;
  const submittedAttempts = progress?.assessmentAttempts.filter((attempt) => attempt.submitted_at) ?? [];
  const subjectProgress = Object.values((progress?.courses ?? []).reduce<Record<string, { subject: string; done: number; total: number }>>((result, course) => {
    const subject = result[course.subject] ?? { subject: course.subject, done: 0, total: 0 };
    subject.done += course.lessons_completed;
    subject.total += course.lessons_total;
    result[course.subject] = subject;
    return result;
  }, {}));
  return <ModuleShell module={module}>
    <LevelProgressCard />
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="module-stat-strip"><div><span>Lessons completed</span><strong>{lessonsCompleted}</strong><small>{lessonsTotal} available in your courses</small></div><div><span>Assessment attempts</span><strong>{submittedAttempts.length}</strong><small>Submitted to the server</small></div><div><span>Assignments</span><strong>{progress?.assignmentSubmissions.length ?? 0}</strong><small>Submissions recorded</small></div></div>
    <Panel><SectionHeading title="Course progress" subtitle="Completion calculated from published lessons and your recorded activity." />{subjectProgress.length ? subjectProgress.map((item) => { const percent = item.total ? Math.round((item.done / item.total) * 100) : 0; return <div className="progress-detail" key={item.subject}><div className="progress-detail__top"><div><BookOpen size={17} /><strong>{item.subject}</strong></div><span>{item.done} / {item.total}</span></div><div className="progress-detail__track"><span style={{ width: `${percent}%` }} /></div><small>{percent}% completed</small></div>; }) : <EmptyState title="No learning progress yet" detail="Your course progress appears after you open an available course." />}</Panel>
    <Panel><SectionHeading title="Assessment attempts" subtitle="Scores are calculated or reviewed by the server." />{submittedAttempts.length ? <div className="table-scroll"><table className="feature-table"><thead><tr><th>Assessment</th><th>Result</th><th>Feedback</th></tr></thead><tbody>{submittedAttempts.map((attempt) => <tr key={attempt.id}><td>{attempt.title}</td><td><strong>{attempt.score === null ? 'Awaiting review' : `${attempt.score}/${attempt.total_marks}`}</strong></td><td>{attempt.feedback || '—'}</td></tr>)}</tbody></table></div> : <EmptyState title="No assessment attempts yet" detail="Submitted assessment attempts will appear here." />}</Panel>
    <Panel><SectionHeading title="Assignment submissions" subtitle="Your submission and evaluation status." />{progress?.assignmentSubmissions.length ? progress.assignmentSubmissions.map((item) => <div className="course-material" key={item.id}><div><strong>{item.title}</strong><small>{item.status}{item.score !== null && item.max_marks !== null ? ` · ${item.score}/${item.max_marks}` : ''}{item.feedback ? ` · ${item.feedback}` : ''}</small></div></div>) : <EmptyState title="No submissions yet" detail="Submit a published assignment to see its status here." />}</Panel>
    <p className="feature-note"><Info size={14} /> Progress reflects PostgreSQL activity for your signed-in account. Legacy browser data is not included in official XP, grades, or progress totals.</p>
  </ModuleShell>;
}

export function StudentModulePage({ module }: StudentModulePageProps) {
  switch (module.path) {
    case 'assignments': return <AssignmentsPage />;
    case 'courses': return <CoursesPage />;
    case 'journey': return <LearningJourneyPage />;
    case 'coding': return <CodingPage module={module} />;
    case 'aptitude': return <AptitudePage module={module} />;
    case 'assessments': return <PublishedAssessmentsPage />;
    case 'videos': return <ResourcesPage module={module} kind="video" />;
    case 'recordings': return <ResourcesPage module={module} kind="recording" />;
    case 'live-sessions': return <LiveClassesPage />;
    case 'sessions': return <SessionsPage module={module} />;
    case 'notifications': return <NotificationsPage module={module} />;
    case 'profile': return <ProfilePage module={module} />;
    case 'progress': return <ProgressPage module={module} />;
    case 'classrooms': return <ClassroomsPage />;
    default: return <ModuleShell module={module}><EmptyState title="Module not found" detail="Choose a module from the student navigation." /></ModuleShell>;
  }
}
