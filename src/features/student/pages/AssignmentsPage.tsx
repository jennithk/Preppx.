import { useEffect, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Clock3, FileUp, Send } from 'lucide-react';
import { studentApi } from '../services/studentApi';

type Assignment = {
  id: string;
  title: string;
  instructions: string;
  subject: string;
  course_title: string | null;
  due_at: string | null;
  max_marks: number | null;
  response_text: string | null;
  submission_status: string | null;
  student_status: 'pending' | 'overdue' | 'submitted' | 'reviewed';
  score: number | null;
  feedback: string | null;
  submitted_at: string | null;
};

export function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    const result = await studentApi<{ assignments: Assignment[] }>('/assignments');
    setAssignments(result.assignments);
    setResponses(Object.fromEntries(result.assignments.map((item) => [item.id, item.response_text ?? ''])));
  }

  useEffect(() => {
    let active = true;
    studentApi<{ assignments: Assignment[] }>('/assignments')
      .then(({ assignments: items }) => {
        if (!active) return;
        setAssignments(items);
        setResponses(Object.fromEntries(items.map((item) => [item.id, item.response_text ?? ''])));
      })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : 'Assignments could not be loaded.'); });
    return () => { active = false; };
  }, []);

  async function submit(assignment: Assignment) {
    setBusyId(assignment.id);
    setError('');
    setNotice('');
    try {
      const file = files[assignment.id];
      if (file) {
        const form = new FormData();
        form.append('file', file);
        await studentApi(`/assignments/${assignment.id}/attachment`, { method: 'POST', body: form });
      } else {
        await studentApi(`/assignments/${assignment.id}/submissions`, {
          method: 'POST',
          body: JSON.stringify({ responseText: responses[assignment.id] ?? '' }),
        });
      }
      await load();
      setFiles((current) => ({ ...current, [assignment.id]: undefined }));
      setNotice('Your submission was saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your submission could not be saved.');
    } finally {
      setBusyId('');
    }
  }

  return <div className="feature-page">
    <div className="feature-heading"><div><div className="eyebrow"><span className="eyebrow__line" /> YOUR LEARNING</div><div className="feature-heading__title-row"><div className="feature-heading__icon"><Send size={21} /></div><h1>Assignments</h1></div><p>Published work, submission status, and instructor feedback.</p></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="form-success" role="status">{notice}</p>}
    {assignments.map((assignment) => {
      const completed = assignment.student_status === 'submitted' || assignment.student_status === 'reviewed';
      const isPastDeadline = assignment.student_status === 'overdue';
      return <section className="feature-panel assignment-panel" key={assignment.id}>
        <div className="feature-section-heading"><div><span className="section-kicker">{assignment.subject}{assignment.course_title ? ` · ${assignment.course_title}` : ''}</span><h2>{assignment.title}</h2></div><span className={`feature-chip ${completed ? 'feature-chip--success' : isPastDeadline ? 'feature-chip--muted' : 'feature-chip--neutral'}`}>{assignment.student_status}</span></div>
        <p>{assignment.instructions}</p>
        <div className="resource-meta"><span><Clock3 size={14} /> {assignment.due_at ? `Due ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(assignment.due_at))}` : 'No deadline'}</span>{assignment.max_marks !== null && <span>{assignment.max_marks} marks</span>}</div>
        {assignment.student_status === 'reviewed' && <div className="assignment-feedback"><strong>Feedback{assignment.score !== null && assignment.max_marks ? ` · ${assignment.score}/${assignment.max_marks}` : ''}</strong><p>{assignment.feedback || 'Your submission has been reviewed.'}</p></div>}
        {!completed && !isPastDeadline && <div className="assignment-submit"><label className="form-field"><span>Your response</span><textarea rows={4} value={responses[assignment.id] ?? ''} onChange={(event) => setResponses((current) => ({ ...current, [assignment.id]: event.target.value }))} placeholder="Write your response, or attach a supported file below." /></label><label className="upload-field"><FileUp size={17} /><span><strong>{files[assignment.id]?.name ?? 'Attach a file (optional)'}</strong><small>PDF, video, document or presentation · max 50 MB</small></span><input type="file" onChange={(event) => setFiles((current) => ({ ...current, [assignment.id]: event.target.files?.[0] }))} /></label><button className="button button--dark" disabled={busyId === assignment.id || (!files[assignment.id] && !(responses[assignment.id] ?? '').trim())} onClick={() => void submit(assignment)}>{busyId === assignment.id ? 'Submitting…' : 'Submit assignment'} <ArrowUpRight size={14} /></button></div>}
        {completed && <div className="assignment-submitted"><CheckCircle2 size={16} /> Submitted{assignment.submitted_at ? ` · ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(assignment.submitted_at))}` : ''}</div>}
      </section>;
    })}
    {!assignments.length && !error && <section className="feature-panel"><div className="feature-empty"><Send size={22} /><strong>No assignments published yet</strong><span>Published assignments will appear here with their instructions and deadlines.</span></div></section>}
  </div>;
}
