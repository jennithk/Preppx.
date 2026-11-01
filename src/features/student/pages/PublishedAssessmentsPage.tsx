import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { studentApi } from '../services/studentApi';

type AssessmentSummary = { id: string; title: string; description: string; subject: string; course_title: string | null; duration_minutes: number | null; question_count: number; attempts: number };
type Question = { id: string; question_type: 'multiple_choice' | 'short_answer' | 'long_answer'; prompt: string; options: string[]; marks: number; position: number };
type Attempt = { id: string; assessment_id: string; title: string; subject: string; score: number | null; total_marks: number | null; feedback: string | null; reviewed_at: string | null; started_at: string; submitted_at: string | null };

export function PublishedAssessmentsPage() {
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [active, setActive] = useState<{ id: string; assessmentId: string; title: string; questions: Question[] } | null>(null);
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [result, setResult] = useState<{ score: number | null; totalMarks: number; pendingReview: boolean } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const autoSubmitted = useRef(false);

  const refresh = useCallback(async () => {
    const [available, previous] = await Promise.all([
      studentApi<{ assessments: AssessmentSummary[] }>('/assessments'),
      studentApi<{ attempts: Attempt[] }>('/assessments/attempts'),
    ]);
    setAssessments(available.assessments);
    setAttempts(previous.attempts);
  }, []);
  useEffect(() => {
    let activeEffect = true;
    Promise.all([
      studentApi<{ assessments: AssessmentSummary[] }>('/assessments'),
      studentApi<{ attempts: Attempt[] }>('/assessments/attempts'),
    ]).then(([available, previous]) => {
      if (!activeEffect) return;
      setAssessments(available.assessments);
      setAttempts(previous.attempts);
    }).catch((caught: unknown) => { if (activeEffect) setError(caught instanceof Error ? caught.message : 'Assessments could not be loaded.'); });
    return () => { activeEffect = false; };
  }, []);

  async function begin(test: AssessmentSummary) {
    setBusy(true);
    setError('');
    try {
      const response = await studentApi<{ attemptId: string; startedAt: string; durationMinutes: number | null; questions: Question[] }>(`/assessments/${test.id}/attempts`, { method: 'POST', body: '{}' });
      setActive({ id: response.attemptId, assessmentId: test.id, title: test.title, questions: response.questions });
      setAnswers({});
      setResult(null);
      autoSubmitted.current = false;
      setSecondsLeft(response.durationMinutes === null ? null : Math.max(0, response.durationMinutes * 60 - Math.floor((Date.now() - Date.parse(response.startedAt)) / 1000)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This assessment could not be started.');
    } finally {
      setBusy(false);
    }
  }

  const submit = useCallback(async () => {
    if (!active) return;
    autoSubmitted.current = true;
    setBusy(true);
    setError('');
    try {
      const previous = await studentApi<{ totalXp: number; level: number }>('/progress');
      const response = await studentApi<{ submitted: true; score: number | null; totalMarks: number; pendingReview: boolean }>(`/assessments/attempts/${active.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers: active.questions.map((question) => ({
          questionId: question.id,
          selectedOption: question.question_type === 'multiple_choice' ? (answers[question.id] as number | undefined) ?? null : null,
          answerText: question.question_type === 'multiple_choice' ? null : String(answers[question.id] ?? ''),
        })) }),
      });
      setResult(response);
      setActive(null);
      await refresh();
      if (!response.pendingReview) {
        const progress = await studentApi<{ totalXp: number; level: number; levelName: string }>('/progress');
        const points = progress.totalXp - previous.totalXp;
        if (points > 0) {
          window.dispatchEvent(new CustomEvent('preppx:xp-awarded', { detail: { id: `assessment:${active.id}`, points, reason: 'Assessment completed', createdAt: new Date().toISOString() } }));
          window.dispatchEvent(new CustomEvent('preppx:xp-updated'));
        }
        if (progress.level > previous.level) {
          window.dispatchEvent(new CustomEvent('preppx:level-up', { detail: { previousLevel: previous.level, currentLevel: progress.level, levelName: progress.levelName, totalXp: progress.totalXp, xpGained: points, reason: 'Assessment completed' } }));
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your answers could not be submitted.');
    } finally {
      setBusy(false);
    }
  }, [active, answers, refresh]);

  const timerRunning = active !== null && secondsLeft !== null && secondsLeft > 0;
  useEffect(() => {
    if (!timerRunning) return;
    const timer = window.setInterval(() => setSecondsLeft((current) => current === null ? null : Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning]);

  useEffect(() => {
    if (active && secondsLeft === 0 && !busy && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void submit();
    }
  }, [active, secondsLeft, busy, submit]);

  return <div className="feature-page">
    <div className="feature-heading"><div><div className="eyebrow"><span className="eyebrow__line" /> YOUR LEARNING</div><div className="feature-heading__title-row"><div className="feature-heading__icon"><ClipboardCheck size={21} /></div><h1>Assessments</h1></div><p>Attempts are saved by the server; objective answers are graded securely.</p></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {result && <section className="feature-panel" role="status"><div className="feature-section-heading"><div><span className="section-kicker">SUBMISSION RECEIVED</span><h2>{result.pendingReview ? 'Pending instructor review' : `Score: ${result.score}/${result.totalMarks}`}</h2><p>{result.pendingReview ? 'Your responses include written answers. Results will be available after instructor review.' : 'Your result was calculated by the server.'}</p></div><CheckCircle2 size={22} /></div><button className="button button--outline" onClick={() => setResult(null)}>Continue</button></section>}
    {active ? <section className="feature-panel"><div className="feature-section-heading"><div><span className="section-kicker">ASSESSMENT</span><h2>{active.title}</h2></div><div>{secondsLeft !== null && <strong className="assessment-countdown" role="timer">{Math.floor(secondsLeft / 60).toString().padStart(2, '0')}:{(secondsLeft % 60).toString().padStart(2, '0')} remaining</strong>}<button className="button button--dark" disabled={busy} onClick={() => void submit()}>{busy ? 'Submitting…' : 'Submit answers'}</button></div></div>{active.questions.map((question, index) => <article className="question-card" key={question.id}><span className="feature-overline">QUESTION {index + 1} · {question.marks} MARKS</span><h3>{question.prompt}</h3>{question.question_type === 'multiple_choice' ? <div className="answer-options">{question.options.map((option, optionIndex) => <button key={`${question.id}-${optionIndex}`} className={`answer-option ${answers[question.id] === optionIndex ? 'is-chosen' : ''}`} onClick={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}><span className="answer-option__letter">{String.fromCharCode(65 + optionIndex)}</span>{option}</button>)}</div> : <label className="form-field"><span>Your written response</span><textarea rows={4} value={String(answers[question.id] ?? '')} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} /></label>}</article>)}</section> : <section className="assessment-grid">{assessments.map((test) => <article className="feature-panel assessment-card" key={test.id}><span className="section-kicker">{test.subject}{test.course_title ? ` · ${test.course_title}` : ''}</span><h2>{test.title}</h2><p>{test.description}</p><div className="resource-meta"><span>{test.question_count} questions</span><span>{test.duration_minutes ? `${test.duration_minutes} min` : 'Untimed'}</span><span>{test.attempts} previous attempts</span></div><button className="button button--dark" disabled={busy} onClick={() => void begin(test)}>Start assessment <ArrowRight size={14} /></button></article>)}{!assessments.length && <section className="feature-panel"><div className="feature-empty"><ClipboardCheck size={22} /><strong>No assessments available</strong><span>Published and currently available assessments appear here.</span></div></section>}</section>}
    {!active && attempts.length > 0 && <section className="feature-panel"><div className="feature-section-heading"><div><span className="section-kicker">YOUR HISTORY</span><h2>Assessment attempts</h2></div></div>{attempts.map((attempt) => <article className="course-material" key={attempt.id}><div><strong>{attempt.title}</strong><small>{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : 'In progress'} · {attempt.score === null ? 'Awaiting review' : `${attempt.score}/${attempt.total_marks}`}</small>{attempt.feedback && <small>{attempt.feedback}</small>}</div></article>)}</section>}
  </div>;
}
