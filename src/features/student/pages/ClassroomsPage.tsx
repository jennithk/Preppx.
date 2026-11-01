import { useEffect, useState, type FormEvent } from 'react';
import { BookOpen, CalendarDays, CheckCircle2, FileText, GraduationCap, MessageSquareText, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { studentApi } from '../services/studentApi';

type Row = Record<string, unknown>;
type Classroom = Row & { id: string; name: string; subject: string; course_title: string; section: string };
type Classwork = { assignments: Row[]; assessments: Row[]; materials: Row[]; links: Row[]; liveClasses: Row[]; topics: Row[] };
type ClassroomTab = 'stream' | 'classwork' | 'grades';

function text(row: Row, key: string, fallback = '') {
  const value = row[key];
  return value === null || value === undefined ? fallback : String(value);
}

function when(value: unknown) {
  if (!value) return 'No date';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? 'No date' : parsed.toLocaleString();
}

export function ClassroomsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [tab, setTab] = useState<ClassroomTab>('stream');
  const [posts, setPosts] = useState<Row[]>([]);
  const [classwork, setClasswork] = useState<Classwork>({ assignments: [], assessments: [], materials: [], links: [], liveClasses: [], topics: [] });
  const [grades, setGrades] = useState<{ assignments: Row[]; assessments: Row[] }>({ assignments: [], assessments: [] });
  const [draftResponses, setDraftResponses] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const selected = classrooms.find((item) => item.id === selectedId);

  async function loadClassrooms(preferredId?: string) {
    const result = await studentApi<{ classrooms: Classroom[] }>('/classrooms');
    setClassrooms(result.classrooms);
    setSelectedId((current) => {
      const desired = preferredId || current;
      return result.classrooms.some((item) => item.id === desired) ? desired : result.classrooms[0]?.id ?? '';
    });
  }

  useEffect(() => {
    let active = true;
    studentApi<{ classrooms: Classroom[] }>('/classrooms')
      .then(({ classrooms: items }) => { if (active) { setClassrooms(items); setSelectedId(items[0]?.id ?? ''); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Classrooms could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setPosts([]);
      setClasswork({ assignments: [], assessments: [], materials: [], links: [], liveClasses: [], topics: [] });
      setGrades({ assignments: [], assessments: [] });
      return;
    }
    let active = true;
    setError('');
    Promise.all([
      studentApi<{ posts: Row[] }>(`/classrooms/${selectedId}/posts`),
      studentApi<Classwork>(`/classrooms/${selectedId}/classwork`),
      studentApi<{ assignments: Row[]; assessments: Row[] }>(`/classrooms/${selectedId}/grades`),
    ]).then(([stream, work, gradeData]) => {
      if (!active) return;
      setPosts(stream.posts);
      setClasswork(work);
      setGrades(gradeData);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Classroom content could not be loaded.');
    });
    return () => { active = false; };
  }, [selectedId]);

  async function joinClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setNotice('');
    try {
      const result = await studentApi<{ classroomId: string }>('/classrooms/join', {
        method: 'POST', body: JSON.stringify({ joinCode: joinCode.trim() }),
      });
      await loadClassrooms(result.classroomId);
      setJoinCode('');
      setNotice('You joined the classroom.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not join this classroom.'); }
  }

  async function postComment(postId: string) {
    const body = comments[postId]?.trim();
    if (!body) return;
    try {
      await studentApi(`/classrooms/${selectedId}/posts/${postId}/comments`, {
        method: 'POST', body: JSON.stringify({ body }),
      });
      setComments({ ...comments, [postId]: '' });
      const result = await studentApi<{ posts: Row[] }>(`/classrooms/${selectedId}/posts`);
      setPosts(result.posts);
      setNotice('Comment added.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Comment could not be added.'); }
  }

  async function submitAssignment(assignmentId: string) {
    const responseText = draftResponses[assignmentId]?.trim();
    if (!responseText) { setError('Write a response before submitting.'); return; }
    try {
      await studentApi(`/assignments/${assignmentId}/submissions`, {
        method: 'POST', body: JSON.stringify({ responseText }),
      });
      setNotice('Assignment submitted.');
      const [work, gradeData] = await Promise.all([
        studentApi<Classwork>(`/classrooms/${selectedId}/classwork`),
        studentApi<{ assignments: Row[]; assessments: Row[] }>(`/classrooms/${selectedId}/grades`),
      ]);
      setClasswork(work); setGrades(gradeData);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Assignment could not be submitted.'); }
  }

  async function openMaterial(materialId: string) {
    try {
      const result = await studentApi<{ url: string }>(`/materials/${materialId}/download`);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Material could not be opened.'); }
  }

  if (loading) return <div className="feature-page"><p>Loading your classrooms…</p></div>;

  return <div className="feature-page student-classrooms">
    <div className="feature-heading"><div><div className="eyebrow"><span className="eyebrow__line" /> YOUR LEARNING SPACE</div><div className="feature-heading__title-row"><div className="feature-heading__icon"><Users size={21} /></div><h1>My classrooms</h1></div><p>Class updates, work, and feedback from your enrolled classes.</p></div></div>
    <form className="student-classrooms-join" onSubmit={(event) => void joinClass(event)}><label><span>Join a class</span><input aria-label="Class joining code" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="Enter joining code" required minLength={6} maxLength={32} /></label><button className="button button--dark">Join classroom</button></form>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
    {classrooms.length > 0 && <div className="student-classrooms-layout">
      <nav className="student-classrooms-list" aria-label="Your classrooms">{classrooms.map((item) => <button key={item.id} className={selectedId === item.id ? 'is-selected' : ''} onClick={() => { setSelectedId(item.id); setTab('stream'); }}><strong>{item.name}</strong><small>{item.subject} · {item.course_title}</small></button>)}</nav>
      {selected && <section className="student-classroom-content"><header className="student-classroom-header"><div><span>{selected.subject}{selected.section ? ` · ${selected.section}` : ''}</span><h2>{selected.name}</h2><p>{selected.course_title}</p></div><div className="student-classroom-tabs">{(['stream', 'classwork', 'grades'] as const).map((item) => <button key={item} className={tab === item ? 'is-selected' : ''} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div></header>
        {tab === 'stream' && <div className="student-classroom-feed">{posts.map((post) => <article className="feature-panel" key={String(post.id)}><div className="student-classroom-post-title"><div><h3>{text(post, 'title')}</h3><small>{when(post.created_at)}</small></div>{Boolean(post.is_pinned) && <span>Pinned</span>}</div><p>{text(post, 'body')}</p><div className="student-classroom-comments">{(Array.isArray(post.comments) ? post.comments as Row[] : []).map((comment) => <p key={String(comment.id)}><strong>{text(comment, 'student_name')}</strong> {text(comment, 'body')}</p>)}</div><form className="student-classroom-comment-form" onSubmit={(event) => { event.preventDefault(); void postComment(String(post.id)); }}><input aria-label={`Comment on ${text(post, 'title')}`} placeholder="Add a comment" value={comments[String(post.id)] ?? ''} onChange={(event) => setComments({ ...comments, [String(post.id)]: event.target.value })} /><button className="button button--outline">Comment</button></form></article>)}{posts.length === 0 && <div className="feature-empty"><MessageSquareText size={22} /><strong>No announcements yet</strong><span>Class updates will appear here.</span></div>}</div>}
        {tab === 'classwork' && <div className="student-classwork-list">
          {classwork.topics.map((topic) => <div className="student-classwork-topic" key={String(topic.id)}>{text(topic, 'title')}</div>)}
          {classwork.assignments.map((item) => <article className="feature-panel student-classwork-card" key={String(item.id)}><div className="student-classwork-card__heading"><FileText size={17} /><div><h3>{text(item, 'title')}</h3><small>{text(item, 'topic_title', 'Assignment')} · Due {when(item.due_at)}</small></div></div><p>{text(item, 'instructions')}</p>{item.submission_status === 'reviewed' ? <div className="student-classroom-grade"><CheckCircle2 size={15} /> Returned · {text(item, 'score')} / {text(item, 'max_marks')}<p>{text(item, 'feedback', 'No feedback provided.')}</p></div> : item.submission_id ? <p className="student-classroom-submitted">Submitted {when(item.submitted_at)} · awaiting review</p> : <div className="student-classroom-submit"><textarea rows={3} aria-label={`Response to ${text(item, 'title')}`} placeholder="Write your response" value={draftResponses[String(item.id)] ?? ''} onChange={(event) => setDraftResponses({ ...draftResponses, [String(item.id)]: event.target.value })} /><button className="button button--dark" onClick={() => void submitAssignment(String(item.id))}>Submit assignment</button></div>}</article>)}
          {classwork.assessments.map((item) => <article className="feature-panel student-classwork-card" key={String(item.id)}><div className="student-classwork-card__heading"><GraduationCap size={17} /><div><h3>{text(item, 'title')}</h3><small>{text(item, 'topic_title', 'Assessment')} · {item.duration_minutes ? `${item.duration_minutes} minutes` : 'No time limit'}</small></div></div><p>{text(item, 'description')}</p>{item.score !== null && item.score !== undefined ? <div className="student-classroom-grade"><CheckCircle2 size={15} /> Latest score {text(item, 'score')} / {text(item, 'total_marks')}<p>{text(item, 'feedback', 'No feedback provided.')}</p></div> : <Link className="button button--dark" to="/student/assessments">Open assessments</Link>}</article>)}
          {classwork.materials.map((item) => <article className="feature-panel student-classwork-card student-classwork-material" key={String(item.id)}><div className="student-classwork-card__heading"><BookOpen size={17} /><div><h3>{text(item, 'title')}</h3><small>{text(item, 'lesson_title', 'Learning material')}</small></div></div><p>{text(item, 'description')}</p><button className="button button--outline" onClick={() => void openMaterial(String(item.id))}>Open material</button></article>)}
          {classwork.links.map((item) => <article className="feature-panel student-classwork-card student-classwork-material" key={String(item.id)}><div className="student-classwork-card__heading"><FileText size={17} /><div><h3>{text(item, 'title')}</h3><small>{text(item, 'topic_title', 'External resource')}</small></div></div><p>{text(item, 'description')}</p><a className="button button--outline" href={text(item, 'external_url')} target="_blank" rel="noreferrer">Open resource</a></article>)}
          {classwork.liveClasses.map((item) => <article className="feature-panel student-classwork-card" key={`live-${String(item.id)}`}><div className="student-classwork-card__heading"><CalendarDays size={17} /><div><h3>{text(item, 'title')}</h3><small>{text(item, 'instructor')} · {when(item.starts_at)} – {when(item.ends_at)}</small></div></div><p>{text(item, 'description')}</p>{Boolean(item.meeting_url) && <a className="button button--dark" href={text(item, 'meeting_url')} target="_blank" rel="noreferrer">Join live class</a>}</article>)}
          {!classwork.assignments.length && !classwork.assessments.length && !classwork.materials.length && !classwork.links.length && !classwork.liveClasses.length && <div className="feature-empty"><BookOpen size={22} /><strong>No classwork available</strong><span>Published materials and assignments will appear here.</span></div>}
        </div>}
        {tab === 'grades' && <div className="student-classroom-grades">{grades.assignments.map((item) => <article className="feature-panel" key={`a-${String(item.id)}`}><div><h3>{text(item, 'title')}</h3><small>Assignment · {text(item, 'status', 'Not submitted')}</small></div><strong>{item.score === null || item.score === undefined ? '—' : `${text(item, 'score')} / ${text(item, 'max_marks')}`}</strong><p>{text(item, 'feedback', 'No feedback yet.')}</p></article>)}{grades.assessments.map((item) => <article className="feature-panel" key={`q-${String(item.id)}`}><div><h3>{text(item, 'title')}</h3><small>Assessment · {item.submitted_at ? 'Submitted' : 'Not attempted'}</small></div><strong>{item.score === null || item.score === undefined ? '—' : `${text(item, 'score')} / ${text(item, 'total_marks')}`}</strong><p>{text(item, 'feedback', 'No feedback yet.')}</p></article>)}{!grades.assignments.length && !grades.assessments.length && <div className="feature-empty"><GraduationCap size={22} /><strong>No grades available</strong><span>Grades and teacher feedback will appear here.</span></div>}</div>}
      </section>}
    </div>}
    {!classrooms.length && <div className="feature-empty"><CalendarDays size={22} /><strong>You have not joined a classroom yet</strong><span>Enter the joining code shared by your teacher to see class updates and work.</span></div>}
  </div>;
}
