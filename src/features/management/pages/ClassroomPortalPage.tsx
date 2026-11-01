import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpen, CalendarDays, ChevronRight, ClipboardCheck,
  Copy, FileText, GraduationCap, LayoutDashboard, LogOut, Menu,
  Plus, Search, Settings2, Users, X,
} from 'lucide-react';
import { Brand } from '../../../components/common/Brand';
import { PasswordInput } from '../../../components/ui/PasswordInput';
import { ThemeToggle } from '../../../components/ui/ThemeToggle';
import { getCourseNodeLabel, type CourseNodeSummary } from '../../../../shared/courseNodes';
import { managementApi, ManagementApiError, type ManagementRow, type ManagementUser } from '../services/managementApi';
import { SUPPORTED_SUBJECTS } from '../../../../shared/subjects';

type RecordData = Record<string, unknown>;
type PortalPage = 'dashboard' | 'classes' | 'calendar' | 'review' | 'students' | 'settings';
type Classroom = ManagementRow & {
  name: string; subject: string; course_id: string; course_title: string; section: string;
  description: string; join_code: string; status: string; student_count: number;
};
type ClassworkData = {
  assignments: ManagementRow[]; assessments: ManagementRow[]; materials: ManagementRow[];
  links: ManagementRow[]; liveClasses: ManagementRow[]; topics: ManagementRow[]; courseId: string; subject: string;
};
type DraftQuestion = { prompt: string; options: string; correctOption: number };

const navigation: Array<{ id: PortalPage; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'classes', label: 'Classes', icon: BookOpen },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'review', label: 'To Review', icon: ClipboardCheck },
  { id: 'students', label: 'Student Records', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

function value(record: RecordData, key: string, fallback = '') {
  const item = record[key];
  return item === null || item === undefined ? fallback : String(item);
}

function dateLabel(item: unknown) {
  if (!item) return 'No date';
  const date = new Date(String(item));
  return Number.isNaN(date.getTime()) ? 'No date' : date.toLocaleString();
}

function Heading({ title, note, action }: { title: string; note: string; action?: ReactNode }) {
  return <div className="classroom-heading"><div><span className="eyebrow"><span className="eyebrow__line" /> PREPPX MANAGEMENT</span><h1>{title}</h1><p>{note}</p></div>{action}</div>;
}

function Notice({ message, success = false }: { message: string; success?: boolean }) {
  return message ? <p className={success ? 'classroom-notice classroom-notice--success' : 'classroom-notice'} role={success ? 'status' : 'alert'}>{message}</p> : null;
}

function Login({ onLogin, initialError = '' }: { onLogin: (user: ManagementUser) => void; initialError?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { manager } = await managementApi.login(email, password);
      onLogin(manager);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Management sign in failed.');
    } finally {
      setBusy(false);
    }
  }
  return <main className="management-login"><header className="management-login__top"><Link to="/"><Brand /></Link><span>MANAGEMENT PORTAL</span></header><section className="management-login__card"><span className="eyebrow"><span className="eyebrow__line" /> SECURE WORKSPACE</span><h1>Management sign in</h1><p>Sign in with your pre-provisioned Management account.</p><Notice message={error} /><form className="management-form" onSubmit={(event) => void submit(event)}><label className="form-field"><span>Work email</span><input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><div className="form-field"><span>Password</span><PasswordInput aria-label="Password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div><button className="button button--dark button--full button--large" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'}</button></form><Link className="management-login__back" to="/login"><ArrowLeft size={14} /> Back to account selection</Link></section></main>;
}

function ClassroomForm({ courses, initial, onSave, onCancel }: {
  courses: ManagementRow[]; initial?: Classroom; onSave: (data: RecordData) => Promise<void>; onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [courseId, setCourseId] = useState(initial?.course_id ?? '');
  const [section, setSection] = useState(initial?.section ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const availableCourses = courses.filter((course) => course.subject === subject && course.status === 'published');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave({ name, subject, courseId, section, description });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Classroom could not be saved.');
    } finally {
      setBusy(false);
    }
  }
  return <form className="classroom-form" onSubmit={(event) => void submit(event)}>
    <div className="classroom-form__header"><h2>{initial ? 'Edit class details' : 'Create a classroom'}</h2><button type="button" className="icon-button" aria-label="Close form" onClick={onCancel}><X size={17} /></button></div>
    <label className="form-field"><span>Class name</span><input required minLength={2} maxLength={160} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Mathematics — Batch A" /></label>
    <label className="form-field"><span>Subject</span><select required value={subject} onChange={(event) => { setSubject(event.target.value); setCourseId(''); }}><option value="">Select a subject</option>{SUPPORTED_SUBJECTS.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label className="form-field"><span>Linked course</span><select required disabled={!subject} value={courseId} onChange={(event) => setCourseId(event.target.value)}><option value="">Select a published course</option>{availableCourses.map((course) => <option key={course.id} value={course.id}>{value(course, 'title')}</option>)}</select></label>
    {subject && availableCourses.length === 0 && <small className="classroom-muted">No published courses are available for this subject yet.</small>}
    <label className="form-field"><span>Section or batch</span><input maxLength={100} value={section} onChange={(event) => setSection(event.target.value)} placeholder="Optional" /></label>
    <label className="form-field"><span>Description</span><textarea rows={3} maxLength={4000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional class details" /></label>
    <Notice message={error} />
    <div className="classroom-form__actions"><button type="button" className="button button--outline" onClick={onCancel}>Cancel</button><button className="button button--dark" disabled={busy || availableCourses.length === 0}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Create class'}</button></div>
  </form>;
}

function ClassroomWorkspace({ classroom, onBack, onRefresh }: {
  classroom: Classroom; onBack: () => void; onRefresh: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const tabNames = ['stream', 'classwork', 'people', 'grades'] as const;
  type Tab = typeof tabNames[number];
  const requestedTab = new URLSearchParams(location.search).get('tab');
  const tab: Tab = tabNames.includes(requestedTab as Tab) ? requestedTab as Tab : 'stream';
  const setTab = (next: Tab) => navigate(`/management/classes/${classroom.id}?tab=${next}`);
  const [posts, setPosts] = useState<ManagementRow[]>([]);
  const [classwork, setClasswork] = useState<ClassworkData | null>(null);
  const [people, setPeople] = useState<ManagementRow[]>([]);
  const [availableStudents, setAvailableStudents] = useState<ManagementRow[]>([]);
  const [grades, setGrades] = useState<{ students: ManagementRow[]; submissions: ManagementRow[]; attempts: ManagementRow[] }>({ students: [], submissions: [], attempts: [] });
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementStatus, setAnnouncementStatus] = useState<'published' | 'draft'>('published');
  const [topicTitle, setTopicTitle] = useState('');
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [maxMarks, setMaxMarks] = useState('');
  const [assignmentStatus, setAssignmentStatus] = useState<'published' | 'draft'>('published');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [assessmentTitle, setAssessmentTitle] = useState('');
  const [assessmentDescription, setAssessmentDescription] = useState('');
  const [assessmentStartsAt, setAssessmentStartsAt] = useState('');
  const [assessmentEndsAt, setAssessmentEndsAt] = useState('');
  const [assessmentDuration, setAssessmentDuration] = useState('');
  const [assessmentQuestions, setAssessmentQuestions] = useState<DraftQuestion[]>([{ prompt: '', options: '', correctOption: 0 }]);
  const [assessmentStatus, setAssessmentStatus] = useState<'published' | 'draft'>('published');
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialDescription, setMaterialDescription] = useState('');
  const [materialNode, setMaterialNode] = useState('');
  const [courseNodes, setCourseNodes] = useState<ManagementRow[]>([]);
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [materialStatus, setMaterialStatus] = useState<'published' | 'draft'>('published');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceDescription, setResourceDescription] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceStatus, setResourceStatus] = useState<'published' | 'draft'>('published');
  const [liveTitle, setLiveTitle] = useState('');
  const [liveInstructor, setLiveInstructor] = useState('');
  const [liveStartsAt, setLiveStartsAt] = useState('');
  const [liveEndsAt, setLiveEndsAt] = useState('');
  const [liveMeetingUrl, setLiveMeetingUrl] = useState('');
  const [reviewScores, setReviewScores] = useState<Record<string, string>>({});
  const [reviewFeedback, setReviewFeedback] = useState<Record<string, string>>({});
  const [activeReview, setActiveReview] = useState<string | null>(null);
  const [reviewResponses, setReviewResponses] = useState<RecordData[]>([]);
  const [responseMarks, setResponseMarks] = useState<Record<string, string>>({});
  const [assessmentFeedback, setAssessmentFeedback] = useState('');

  async function loadWorkspace() {
    setError('');
    try {
      const [postData, work, roster, gradeData] = await Promise.all([
        managementApi.get<{ posts: ManagementRow[] }>(`/classrooms/${classroom.id}/posts`),
        managementApi.get<ClassworkData>(`/classrooms/${classroom.id}/classwork`),
        managementApi.get<{ students: ManagementRow[]; availableStudents: ManagementRow[] }>(`/classrooms/${classroom.id}/people?q=${encodeURIComponent(query)}`),
        managementApi.get<{ students: ManagementRow[]; submissions: ManagementRow[]; attempts: ManagementRow[] }>(`/classrooms/${classroom.id}/grades`),
      ]);
      setPosts(postData.posts);
      setClasswork(work);
      setPeople(roster.students);
      setAvailableStudents(roster.availableStudents);
      setGrades(gradeData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load classroom data.');
    }
  }

  useEffect(() => { void loadWorkspace(); }, [classroom.id, query]);
  useEffect(() => {
    managementApi.get<{ nodes: CourseNodeSummary[] }>(`/courses/${classroom.course_id}/nodes`)
      .then(({ nodes }) => setCourseNodes(nodes
        .filter((node) => node.node_type === 'topic' || node.node_type === 'lesson')
        .map((node) => ({ ...node, title: `${getCourseNodeLabel(node, nodes)} (${node.node_type})` }))))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load course topics.'));
  }, [classroom.course_id]);

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      await managementApi.post(`/classrooms/${classroom.id}/posts`, { title: announcementTitle, body: announcementBody, status: announcementStatus });
      setAnnouncementTitle(''); setAnnouncementBody(''); setNotice(announcementStatus === 'published' ? 'Announcement published.' : 'Announcement saved as a draft.'); await loadWorkspace();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Announcement could not be published.'); }
  }

  async function changePost(post: ManagementRow, change: RecordData) {
    try {
      await managementApi.patch(`/classrooms/${classroom.id}/posts/${post.id}`, change);
      setNotice('Announcement updated.'); await loadWorkspace();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Announcement could not be updated.'); }
  }

  async function createTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await managementApi.post(`/classrooms/${classroom.id}/topics`, { title: topicTitle, position: classwork?.topics.length ?? 0 });
      setTopicTitle(''); setNotice('Topic added.'); await loadWorkspace();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Topic could not be added.'); }
  }

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await managementApi.post(`/classrooms/${classroom.id}/assignments`, {
        title: assignmentTitle, instructions, topicId: selectedTopic || null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        maxMarks: maxMarks ? Number(maxMarks) : null, status: assignmentStatus,
      });
      setAssignmentTitle(''); setInstructions(''); setDueAt(''); setMaxMarks(''); setNotice(assignmentStatus === 'published' ? 'Assignment published.' : 'Assignment saved as a draft.'); await loadWorkspace();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Assignment could not be published.'); }
  }

  async function createAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await managementApi.post(`/classrooms/${classroom.id}/assessments`, {
        title: assessmentTitle, description: assessmentDescription, topicId: selectedTopic || null,
        startsAt: assessmentStartsAt ? new Date(assessmentStartsAt).toISOString() : null,
        endsAt: assessmentEndsAt ? new Date(assessmentEndsAt).toISOString() : null,
        durationMinutes: assessmentDuration ? Number(assessmentDuration) : null,
        status: assessmentStatus, questions: assessmentQuestions.map((question) => ({
          questionType: 'multiple_choice', prompt: question.prompt,
          options: question.options.split('\n').map((item) => item.trim()).filter(Boolean),
          correctOption: question.correctOption, marks: 1,
        })),
      });
      setAssessmentTitle(''); setAssessmentDescription(''); setAssessmentStartsAt(''); setAssessmentEndsAt(''); setAssessmentDuration(''); setAssessmentQuestions([{ prompt: '', options: '', correctOption: 0 }]); setNotice(assessmentStatus === 'published' ? 'Assessment published.' : 'Assessment saved as a draft.'); await loadWorkspace();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Assessment could not be published.'); }
  }

  async function createMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!materialFile) { setError('Choose a material file to upload.'); return; }
    const formData = new FormData();
    formData.set('title', materialTitle);
    formData.set('description', materialDescription);
    if (materialNode) formData.set('nodeId', materialNode);
    formData.set('status', materialStatus);
    formData.set('file', materialFile);
    try {
      await managementApi.upload(`/classrooms/${classroom.id}/materials`, formData);
      setMaterialTitle(''); setMaterialDescription(''); setMaterialNode(''); setMaterialFile(null); setNotice(materialStatus === 'published' ? 'Learning material published.' : 'Learning material saved as a draft.'); await loadWorkspace();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Material could not be uploaded.'); }
  }

  async function createLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await managementApi.post(`/classrooms/${classroom.id}/links`, {
        title: resourceTitle, description: resourceDescription, url: resourceUrl,
        topicId: selectedTopic || null, status: resourceStatus,
      });
      setResourceTitle(''); setResourceDescription(''); setResourceUrl(''); setNotice(resourceStatus === 'published' ? 'External resource published.' : 'External resource saved as a draft.'); await loadWorkspace();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'External resource could not be saved.'); }
  }

  async function createLiveClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await managementApi.post(`/classrooms/${classroom.id}/live-classes`, {
        title: liveTitle, instructor: liveInstructor,
        startsAt: new Date(liveStartsAt).toISOString(), endsAt: new Date(liveEndsAt).toISOString(),
        meetingUrl: liveMeetingUrl || null,
      });
      setLiveTitle(''); setLiveInstructor(''); setLiveStartsAt(''); setLiveEndsAt(''); setLiveMeetingUrl('');
      setNotice('Live class scheduled.'); await loadWorkspace();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Live class could not be scheduled.'); }
  }

  async function manageEnrollment(student: ManagementRow, enroll: boolean) {
    try {
      if (enroll) await managementApi.post(`/classrooms/${classroom.id}/people`, { studentId: student.id });
      else await managementApi.remove(`/classrooms/${classroom.id}/people/${student.id}`);
      setNotice(enroll ? 'Student added to the classroom.' : 'Student removed from the classroom.');
      await loadWorkspace();
      onRefresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Enrollment could not be changed.'); }
  }

  async function regenerateCode() {
    try {
      await managementApi.post(`/classrooms/${classroom.id}/join-code`, {});
      setNotice('A new class joining code is ready.'); onRefresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The joining code could not be changed.'); }
  }

  async function reviewSubmission(submission: ManagementRow) {
    try {
      await managementApi.patch(`/submissions/${submission.id}/review`, {
        score: reviewScores[String(submission.id)] === '' ? null : Number(reviewScores[String(submission.id)]),
        feedback: reviewFeedback[String(submission.id)] ?? '',
      });
      setNotice('Submission reviewed and returned.'); await loadWorkspace();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Submission review failed.'); }
  }

  async function openAssessmentReview(attempt: ManagementRow) {
    try {
      const result = await managementApi.get<{ responses: RecordData[] }>(`/assessment-attempts/${attempt.id}`);
      setReviewResponses(result.responses);
      setResponseMarks(Object.fromEntries(result.responses.map((item) => [String(item.question_id), String(item.awarded_marks ?? '')])));
      setAssessmentFeedback(value(attempt, 'feedback'));
      setActiveReview(String(attempt.id));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Assessment responses could not be loaded.'); }
  }

  async function saveAssessmentReview(attemptId: string) {
    try {
      await managementApi.patch(`/assessment-attempts/${attemptId}/review`, {
        feedback: assessmentFeedback,
        responses: reviewResponses.map((item) => ({
          questionId: item.question_id,
          awardedMarks: Number(responseMarks[String(item.question_id)] || 0),
          feedback: value(item, 'feedback'),
        })),
      });
      setActiveReview(null); setNotice('Assessment review saved.'); await loadWorkspace();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Assessment review failed.'); }
  }

  async function openAttachment(submissionId: string) {
    try {
      const result = await managementApi.get<{ url: string }>('/submissions/' + submissionId + '/attachment');
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Attachment could not be opened.'); }
  }

  async function openMaterial(materialId: string) {
    try {
      const result = await managementApi.get<{ url: string }>(`/materials/${materialId}/download`);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Material could not be opened.'); }
  }

  async function editWorkItem(path: string, title: string, descriptionKey: string, description: string) {
    const nextTitle = window.prompt('Edit title', title);
    if (nextTitle === null) return;
    const nextDescription = window.prompt('Edit description or instructions', description);
    if (nextDescription === null) return;
    try {
      await managementApi.patch(path, { title: nextTitle.trim(), [descriptionKey]: nextDescription.trim() });
      setNotice('Classwork updated.');
      await loadWorkspace();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Classwork could not be updated.'); }
  }

  async function changeWorkStatus(path: string, status: string) {
    try {
      await managementApi.patch(path, { status });
      await loadWorkspace();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Classwork status could not be updated.'); }
  }

  return <div className="classroom-workspace">
    <button className="classroom-back" onClick={onBack}><ArrowLeft size={15} /> All classes</button>
    <Heading title={classroom.name} note={`${classroom.subject} · ${classroom.course_title}${classroom.section ? ` · ${classroom.section}` : ''}`} action={<span className="classroom-join-code">Code <strong>{classroom.join_code}</strong></span>} />
    {error && <Notice message={error} />}{notice && <Notice message={notice} success />}
    <div className="classroom-tabs" role="tablist" aria-label="Classroom sections">{tabNames.map((name) => <button key={name} role="tab" aria-selected={tab === name} className={tab === name ? 'is-selected' : ''} onClick={() => setTab(name)}>{name[0].toUpperCase() + name.slice(1)}</button>)}</div>
    {tab === 'stream' && <section className="classroom-stream">
      <form className="classroom-panel classroom-post-form" onSubmit={(event) => void createPost(event)}><h2>Share with your class</h2><input required minLength={2} maxLength={180} placeholder="Announcement title" value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} /><textarea required rows={3} maxLength={10_000} placeholder="Write an announcement" value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} /><select aria-label="Announcement status" value={announcementStatus} onChange={(event) => setAnnouncementStatus(event.target.value as 'published' | 'draft')}><option value="published">Publish now</option><option value="draft">Save draft</option></select><button className="button button--dark"><Plus size={15} /> Post announcement</button></form>
      {posts.filter((post) => post.status !== 'archived').map((post) => <article className="classroom-panel classroom-post" key={post.id}>
        <header><div><h2>{value(post, 'title')}</h2><small>{value(post, 'status')} · {dateLabel(post.created_at)}</small></div><div className="classroom-post__actions">
          {post.status === 'published' && <button className="button button--outline" onClick={() => void changePost(post, { isPinned: !post.is_pinned })}>{post.is_pinned ? 'Unpin' : 'Pin'}</button>}
          <button className="button button--outline" onClick={() => { const body = window.prompt('Edit announcement', value(post, 'body')); if (body !== null) void changePost(post, { body }); }}>Edit</button>
          {post.status === 'draft' && <button className="button button--outline" onClick={() => void changePost(post, { status: 'published' })}>Publish</button>}
          <button className="button button--outline" onClick={() => void changePost(post, { status: 'archived' })}>Archive</button>
        </div></header><p>{value(post, 'body')}</p>
        {post.status === 'published' && <div className="classroom-comments">{(Array.isArray(post.comments) ? post.comments as RecordData[] : []).map((comment) => <p key={String(comment.id)}><strong>{value(comment, 'student_name')}</strong> {value(comment, 'body')}</p>)}</div>}
      </article>)}
      {!posts.some((post) => post.status !== 'archived') && <div className="classroom-empty">No announcements yet. Post an update for this class.</div>}
    </section>}
    {tab === 'classwork' && <section className="classroom-panel classroom-schedule-panel"><h2>Scheduled live classes</h2>{classwork?.liveClasses.map((item) => <div className="classroom-list-row" key={item.id}><CalendarDays size={17} /><div><strong>{value(item, 'title')}</strong><small>{value(item, 'instructor')} · {dateLabel(item.starts_at)} – {dateLabel(item.ends_at)}</small></div>{Boolean(item.meeting_url) && <a className="button button--outline" href={value(item, 'meeting_url')} target="_blank" rel="noreferrer">Open meeting</a>}<button className="button button--outline" onClick={() => void managementApi.post(`/live-classes/${item.id}/cancel`, {}).then(loadWorkspace).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Live class could not be cancelled.'))}>Cancel</button></div>)}{!classwork?.liveClasses.length && <p className="classroom-muted">No live classes scheduled for this classroom.</p>}</section>}
    {tab === 'classwork' && <div className="classwork-grid">
      <section className="classroom-panel"><h2>Topics</h2><form className="classroom-inline-form" onSubmit={(event) => void createTopic(event)}><input required minLength={1} placeholder="New topic" value={topicTitle} onChange={(event) => setTopicTitle(event.target.value)} /><button className="button button--outline"><Plus size={14} /> Add topic</button></form><div className="classroom-topic-list">{classwork?.topics.map((topic) => <span key={topic.id}>{value(topic, 'title')}</span>)}</div></section>
      <section className="classroom-panel"><h2>Publish an assignment</h2><form className="classroom-form classroom-form--compact" onSubmit={(event) => void createAssignment(event)}><input required minLength={2} placeholder="Assignment title" value={assignmentTitle} onChange={(event) => setAssignmentTitle(event.target.value)} /><textarea required rows={3} placeholder="Instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} /><select aria-label="Assignment topic" value={selectedTopic} onChange={(event) => setSelectedTopic(event.target.value)}><option value="">No topic</option>{classwork?.topics.map((topic) => <option key={topic.id} value={String(topic.id)}>{value(topic, 'title')}</option>)}</select><input aria-label="Due date" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /><input aria-label="Maximum marks" type="number" min="0.01" step="0.01" placeholder="Maximum marks" value={maxMarks} onChange={(event) => setMaxMarks(event.target.value)} /><select aria-label="Assignment status" value={assignmentStatus} onChange={(event) => setAssignmentStatus(event.target.value as 'published' | 'draft')}><option value="published">Publish now</option><option value="draft">Save draft</option></select><button className="button button--dark">{assignmentStatus === 'published' ? 'Publish assignment' : 'Save draft'}</button></form></section>
      <section className="classroom-panel"><h2>Publish a quiz</h2><form className="classroom-form classroom-form--compact" onSubmit={(event) => void createAssessment(event)}>
        <input required minLength={2} placeholder="Assessment title" value={assessmentTitle} onChange={(event) => setAssessmentTitle(event.target.value)} />
        <textarea rows={2} placeholder="Instructions" value={assessmentDescription} onChange={(event) => setAssessmentDescription(event.target.value)} />
        <select aria-label="Quiz topic" value={selectedTopic} onChange={(event) => setSelectedTopic(event.target.value)}><option value="">No topic</option>{classwork?.topics.map((topic) => <option key={topic.id} value={String(topic.id)}>{value(topic, 'title')}</option>)}</select>
        <label className="form-field"><span>Opens at</span><input type="datetime-local" value={assessmentStartsAt} onChange={(event) => setAssessmentStartsAt(event.target.value)} /></label>
        <label className="form-field"><span>Closes at</span><input type="datetime-local" value={assessmentEndsAt} onChange={(event) => setAssessmentEndsAt(event.target.value)} /></label>
        <input aria-label="Time limit in minutes" type="number" min="1" max="1440" placeholder="Time limit in minutes (optional)" value={assessmentDuration} onChange={(event) => setAssessmentDuration(event.target.value)} />
        {assessmentQuestions.map((question, index) => <fieldset className="classroom-question-fields" key={index}>
          <legend>Question {index + 1}</legend>
          <input required placeholder="Multiple-choice question" value={question.prompt} onChange={(event) => setAssessmentQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, prompt: event.target.value } : item))} />
          <textarea required rows={3} placeholder="Answer options, one per line" value={question.options} onChange={(event) => setAssessmentQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, options: event.target.value } : item))} />
          <label className="form-field"><span>Correct answer option number (from 1)</span><input type="number" min="1" value={question.correctOption + 1} onChange={(event) => setAssessmentQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, correctOption: Math.max(0, Number(event.target.value) - 1) } : item))} /></label>
        </fieldset>)}
        <button type="button" className="button button--outline" onClick={() => setAssessmentQuestions((current) => [...current, { prompt: '', options: '', correctOption: 0 }])}><Plus size={14} /> Add question</button>
        <select aria-label="Assessment status" value={assessmentStatus} onChange={(event) => setAssessmentStatus(event.target.value as 'published' | 'draft')}><option value="published">Publish now</option><option value="draft">Save draft</option></select>
        <button className="button button--dark">{assessmentStatus === 'published' ? 'Publish quiz' : 'Save draft'}</button>
      </form></section>
      <section className="classroom-panel"><h2>Add learning material</h2><form className="classroom-form classroom-form--compact" onSubmit={(event) => void createMaterial(event)}><input required placeholder="Material title" value={materialTitle} onChange={(event) => setMaterialTitle(event.target.value)} /><textarea rows={2} placeholder="Description" value={materialDescription} onChange={(event) => setMaterialDescription(event.target.value)} /><select aria-label="Course topic or lesson" value={materialNode} onChange={(event) => setMaterialNode(event.target.value)}><option value="">Course-level material</option>{courseNodes.map((node) => <option key={node.id} value={String(node.id)}>{value(node, 'title')}</option>)}</select><input type="file" required onChange={(event) => setMaterialFile(event.target.files?.[0] ?? null)} /><select aria-label="Material status" value={materialStatus} onChange={(event) => setMaterialStatus(event.target.value as 'published' | 'draft')}><option value="published">Publish now</option><option value="draft">Save draft</option></select><button className="button button--dark">{materialStatus === 'published' ? 'Upload and publish' : 'Upload draft'}</button></form></section>
      <section className="classroom-panel"><h2>Add an external resource</h2><form className="classroom-form classroom-form--compact" onSubmit={(event) => void createLink(event)}><input required placeholder="Resource title" value={resourceTitle} onChange={(event) => setResourceTitle(event.target.value)} /><input required type="url" placeholder="https://…" value={resourceUrl} onChange={(event) => setResourceUrl(event.target.value)} /><textarea rows={2} placeholder="Description" value={resourceDescription} onChange={(event) => setResourceDescription(event.target.value)} /><select aria-label="Resource topic" value={selectedTopic} onChange={(event) => setSelectedTopic(event.target.value)}><option value="">No topic</option>{classwork?.topics.map((topic) => <option key={topic.id} value={String(topic.id)}>{value(topic, 'title')}</option>)}</select><select aria-label="Resource status" value={resourceStatus} onChange={(event) => setResourceStatus(event.target.value as 'published' | 'draft')}><option value="published">Publish now</option><option value="draft">Save draft</option></select><button className="button button--dark">{resourceStatus === 'published' ? 'Publish resource' : 'Save draft'}</button></form></section>
      <section className="classroom-panel"><h2>Schedule a live class</h2><form className="classroom-form classroom-form--compact" onSubmit={(event) => void createLiveClass(event)}><input required minLength={2} placeholder="Live class title" value={liveTitle} onChange={(event) => setLiveTitle(event.target.value)} /><input required placeholder="Instructor" value={liveInstructor} onChange={(event) => setLiveInstructor(event.target.value)} /><label className="form-field"><span>Starts</span><input required type="datetime-local" value={liveStartsAt} onChange={(event) => setLiveStartsAt(event.target.value)} /></label><label className="form-field"><span>Ends</span><input required type="datetime-local" value={liveEndsAt} onChange={(event) => setLiveEndsAt(event.target.value)} /></label><input type="url" placeholder="Meeting URL (optional)" value={liveMeetingUrl} onChange={(event) => setLiveMeetingUrl(event.target.value)} /><button className="button button--dark">Schedule class</button></form></section>
      <section className="classroom-panel classroom-panel--wide">
        <h2>Classwork library</h2>
        {classwork?.assignments.map((item) => <div className="classroom-list-row" key={item.id}><FileText size={17} /><div><strong>{value(item, 'title')}</strong><small>Assignment · {value(item, 'topic_title', 'No topic')} · {value(item, 'status')} · due {dateLabel(item.due_at)}</small></div><button className="button button--outline" onClick={() => void editWorkItem(`/assignments/${item.id}`, value(item, 'title'), 'instructions', value(item, 'instructions'))}>Edit</button><button className="button button--outline" onClick={() => void changeWorkStatus(`/assignments/${item.id}`, item.status === 'published' ? 'archived' : 'published')}>{item.status === 'published' ? 'Archive' : 'Republish'}</button></div>)}
        {classwork?.assessments.map((item) => <div className="classroom-list-row" key={item.id}><GraduationCap size={17} /><div><strong>{value(item, 'title')}</strong><small>Assessment · {value(item, 'topic_title', 'No topic')} · {value(item, 'status')} · {value(item, 'attempt_count')} attempts</small></div><button className="button button--outline" onClick={() => void editWorkItem(`/assessments/${item.id}`, value(item, 'title'), 'description', value(item, 'description'))}>Edit</button><button className="button button--outline" onClick={() => void changeWorkStatus(`/assessments/${item.id}`, item.status === 'published' ? 'archived' : 'published')}>{item.status === 'published' ? 'Archive' : 'Republish'}</button></div>)}
        {classwork?.materials.map((item) => <div className="classroom-list-row" key={item.id}><BookOpen size={17} /><div><strong>{value(item, 'title')}</strong><small>Material · {value(item, 'original_filename')} · {value(item, 'status')}</small></div><button className="button button--outline" onClick={() => void openMaterial(String(item.id))}>Open</button><button className="button button--outline" onClick={() => void managementApi.patch(`/materials/${item.id}`, { status: item.status === 'published' ? 'archived' : 'published' }).then(loadWorkspace).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Material status could not be updated.'))}>{item.status === 'published' ? 'Archive' : 'Republish'}</button></div>)}
        {classwork?.links.map((item) => <div className="classroom-list-row" key={item.id}><ArrowRight size={17} /><div><strong>{value(item, 'title')}</strong><small>External resource · {value(item, 'status')}</small></div><a className="button button--outline" href={value(item, 'external_url')} target="_blank" rel="noreferrer">Open</a><button className="button button--outline" onClick={() => void editWorkItem(`/classrooms/${classroom.id}/links/${item.id}`, value(item, 'title'), 'description', value(item, 'description'))}>Edit</button><button className="button button--outline" onClick={() => void changeWorkStatus(`/classrooms/${classroom.id}/links/${item.id}`, item.status === 'published' ? 'archived' : 'published')}>{item.status === 'published' ? 'Archive' : 'Republish'}</button></div>)}
        {(!classwork || (!classwork.assignments.length && !classwork.assessments.length && !classwork.materials.length && !classwork.links.length)) && <p className="classroom-muted">Published classwork will appear here.</p>}
      </section>
    </div>}
    {tab === 'people' && <section className="classroom-panel"><div className="classroom-people-heading"><div><h2>Class roster</h2><p>{people.length} enrolled students</p></div><div className="classroom-code-tools"><span>Joining code <strong>{classroom.join_code}</strong></span><button className="button button--outline" onClick={() => void navigator.clipboard.writeText(classroom.join_code).then(() => setNotice('Joining code copied.')).catch(() => setError('The code could not be copied.'))}><Copy size={14} /> Copy</button><button className="button button--outline" onClick={() => void regenerateCode()}>Regenerate</button></div></div><label className="management-search"><Search size={16} /><input placeholder="Search or add existing students" value={query} onChange={(event) => setQuery(event.target.value)} /></label>{availableStudents.length > 0 && <div className="classroom-available-students"><h3>Existing accounts</h3>{availableStudents.map((student) => <div className="classroom-list-row" key={student.id}><Users size={16} /><div><strong>{value(student, 'full_name')}</strong><small>{value(student, 'email')}{student.roll_number ? ` · ${student.roll_number}` : ''}</small></div><button className="button button--outline" onClick={() => void manageEnrollment(student, true)}>Add</button></div>)}</div>}<h3>Enrolled</h3>{people.map((student) => <div className="classroom-list-row" key={student.id}><Users size={16} /><div><strong>{value(student, 'full_name')}</strong><small>{value(student, 'email')}{student.roll_number ? ` · ${student.roll_number}` : ''}</small></div><button className="button button--outline" onClick={() => void manageEnrollment(student, false)}>Remove</button></div>)}{!people.length && <p className="classroom-muted">No students are enrolled yet.</p>}</section>}
    {tab === 'grades' && <div className="classroom-grade-columns">
      <section className="classroom-panel">
        <h2>Assignment submissions and missing work</h2>
        {grades.submissions.map((submission) => <article className="classroom-grade-item" key={`${submission.assignment_id}-${submission.student_id}`}>
          <header><div><strong>{value(submission, 'full_name')}</strong><small>{value(submission, 'assignment_title')} · {dateLabel(submission.submitted_at)}</small></div><span>{value(submission, 'status')}</span></header>
          {Boolean(submission.response_text) && <p>{value(submission, 'response_text')}</p>}
          {Boolean(submission.attachment_filename) && <button className="button button--outline" onClick={() => void openAttachment(String(submission.id))}>Open attachment</button>}
          {submission.id ? <div className="classroom-review-fields">
            <input aria-label="Score" type="number" min="0" max={submission.max_marks ? Number(submission.max_marks) : undefined} step="0.01" placeholder={submission.max_marks ? `Score / ${submission.max_marks}` : 'Score'} value={reviewScores[String(submission.id)] ?? value(submission, 'score')} onChange={(event) => setReviewScores({ ...reviewScores, [String(submission.id)]: event.target.value })} />
            <input aria-label="Feedback" placeholder="Feedback" value={reviewFeedback[String(submission.id)] ?? value(submission, 'feedback')} onChange={(event) => setReviewFeedback({ ...reviewFeedback, [String(submission.id)]: event.target.value })} />
            <button className="button button--dark" onClick={() => void reviewSubmission(submission)}>Return</button>
          </div> : <p className="classroom-muted">Missing submission</p>}
        </article>)}
        {!grades.submissions.length && <p className="classroom-muted">No assignment work has been assigned to enrolled students.</p>}
      </section>
      <section className="classroom-panel">
        <h2>Assessment attempts and missing work</h2>
        {grades.attempts.map((attempt) => <article className="classroom-grade-item" key={`${attempt.assessment_id}-${attempt.student_id}`}>
          <header><div><strong>{value(attempt, 'full_name')}</strong><small>{value(attempt, 'assessment_title')} · {dateLabel(attempt.submitted_at)}</small></div><span>{attempt.pending_review ? 'To review' : attempt.submitted_at ? `${value(attempt, 'score')} / ${value(attempt, 'total_marks')}` : 'Not attempted'}</span></header>
          {Boolean(attempt.submitted_at) && <><p>{value(attempt, 'feedback', 'No feedback yet.')}</p><button className="button button--outline" onClick={() => void openAssessmentReview(attempt)}>{attempt.pending_review ? 'Review attempt' : 'View answers'}</button></>}
          {activeReview === String(attempt.id) && <div className="classroom-assessment-review">
            {reviewResponses.map((item) => <label key={String(item.question_id)} className="form-field"><span>{value(item, 'prompt')}</span><small>{value(item, 'answer_text') || `Selected option ${value(item, 'selected_option')}`}</small><input type="number" min="0" max={Number(item.marks)} step="0.01" value={responseMarks[String(item.question_id)] ?? ''} onChange={(event) => setResponseMarks({ ...responseMarks, [String(item.question_id)]: event.target.value })} /></label>)}
            <textarea aria-label="Assessment feedback" placeholder="Feedback" value={assessmentFeedback} onChange={(event) => setAssessmentFeedback(event.target.value)} />
            {Boolean(attempt.pending_review) && <button className="button button--dark" onClick={() => void saveAssessmentReview(String(attempt.id))}>Return assessment</button>}
          </div>}
        </article>)}
        {!grades.attempts.length && <p className="classroom-muted">No assessments have been assigned to enrolled students.</p>}
      </section>
    </div>}
  </div>;
}

export function ClassroomPortalPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<ManagementUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [courses, setCourses] = useState<ManagementRow[]>([]);
  const [pageData, setPageData] = useState<RecordData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editClass, setEditClass] = useState<Classroom | undefined>();
  const [search, setSearch] = useState('');
  const pagePart = location.pathname.split('/')[2] || 'dashboard';
  const page = (navigation.some((item) => item.id === pagePart) ? pagePart : 'dashboard') as PortalPage;
  const classId = page === 'classes' ? location.pathname.split('/')[3] : '';
  const activeClass = classes.find((item) => item.id === classId);

  const filteredClasses = useMemo(() => classes.filter((item) =>
    `${item.name} ${item.subject} ${item.course_title} ${item.section}`.toLowerCase().includes(search.toLowerCase()),
  ), [classes, search]);

  async function refresh() {
    setError('');
    try {
      const [{ classrooms }, courseData] = await Promise.all([
        managementApi.get<{ classrooms: Classroom[] }>('/classrooms'),
        managementApi.get<{ courses: ManagementRow[] }>('/courses'),
      ]);
      setClasses(classrooms);
      setCourses(courseData.courses);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Classroom records could not be loaded.');
    }
  }

  useEffect(() => {
    let active = true;
    managementApi.session().then(({ manager }) => { if (active) setUser(manager); })
      .catch((reason: unknown) => {
        if (!active || (reason instanceof ManagementApiError && reason.status === 401)) return;
        setSessionError(reason instanceof Error ? reason.message : 'The Management API could not be reached.');
      })
      .finally(() => { if (active) setSessionLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    void refresh().finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user || page === 'classes' || page === 'settings') return;
    if (page === 'dashboard') {
      setLoading(true);
      void Promise.all([
        managementApi.get<RecordData>('/overview'),
        managementApi.get<RecordData>('/classrooms/calendar'),
      ])
        .then(([overview, calendar]) => setPageData({ ...overview, events: calendar.events }))
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Dashboard data could not be loaded.'))
        .finally(() => setLoading(false));
      return;
    }
    const endpoint = page === 'calendar' ? '/classrooms/calendar'
      : page === 'review' ? '/classrooms/review'
        : page === 'students' ? `/students?q=${encodeURIComponent(search)}&page=1&pageSize=50`
          : '/overview';
    setLoading(true);
    managementApi.get<RecordData>(endpoint)
      .then(setPageData)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Page data could not be loaded.'))
      .finally(() => setLoading(false));
  }, [user, page, search]);

  function go(path: string) {
    navigate(`/management/${path}`);
    setMobileOpen(false);
    setError('');
  }

  async function signOut() {
    try { await managementApi.logout(); setUser(null); navigate('/management/login', { replace: true }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Sign out failed.'); }
  }

  async function saveClassroom(data: RecordData) {
    if (editClass) await managementApi.patch(`/classrooms/${editClass.id}`, data);
    else await managementApi.post('/classrooms', data);
    setShowForm(false); setEditClass(undefined); await refresh();
  }

  async function archiveClassroom(classroom: Classroom) {
    try {
      await managementApi.patch(`/classrooms/${classroom.id}`, { status: 'archived' });
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Classroom could not be archived.'); }
  }

  if (sessionLoading) return <div className="management-loading management-loading--screen">Verifying management access…</div>;
  if (!user) return <Login initialError={sessionError} onLogin={(manager) => { setSessionError(''); setUser(manager); navigate('/management/dashboard', { replace: true }); }} />;
  const pageTitle = navigation.find((item) => item.id === page)?.label ?? 'Management';

  return <div className="app-shell management-shell classroom-portal">
    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
      <div className="sidebar__brand-row"><Brand /><button className="icon-button sidebar__close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <div className="workspace-switcher"><div className="workspace-switcher__avatar">{user.fullName.slice(0, 1).toUpperCase()}</div><div className="workspace-switcher__copy"><span className="workspace-switcher__label">WORKSPACE</span><strong>Management portal</strong></div></div>
      <Link to="/" className="portal-return-link"><ArrowLeft size={14} /> Back to Preppx home</Link>
      <nav className="sidebar__nav" aria-label="Management navigation"><span className="nav-caption">CLASSROOM</span>{navigation.map((item) => { const Icon = item.icon; return <button key={item.id} className={`nav-link ${page === item.id ? 'nav-link--active' : ''}`} onClick={() => go(item.id)}><Icon size={17} /><span>{item.label}</span></button>; })}</nav>
      <div className="sidebar__footer"><div className="sidebar-profile"><div className="avatar avatar--small">{user.fullName.slice(0, 1).toUpperCase()}</div><div className="sidebar-profile__copy"><strong>{user.fullName}</strong><span>{user.email}</span></div><button className="icon-button sidebar-profile__logout" onClick={() => void signOut()} title="Sign out" aria-label="Sign out"><LogOut size={15} /></button></div></div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="topbar__left"><button className="icon-button mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="breadcrumbs"><span>Management</span><span className="breadcrumbs__separator">/</span><strong>{activeClass?.name ?? pageTitle}</strong></div></div><div className="topbar__actions"><label className="classroom-top-search"><Search size={15} /><input aria-label="Search management records" placeholder="Search classes or students" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className="classroom-notification" onClick={() => go('review')} aria-label="Open items to review"><ClipboardCheck size={17} /></button><ThemeToggle /><span className="classroom-profile">{user.fullName}</span></div></header>
      <div className="main-content">
        {error && <Notice message={error} />}
        {loading && <div className="management-loading">Loading classroom data…</div>}
        {!loading && !classId && page === 'dashboard' && <><Heading title="Your classrooms" note="A focused view of teaching groups, recent work, and student progress." action={<button className="button button--dark" onClick={() => { setEditClass(undefined); setShowForm(true); }}><Plus size={15} /> Create class</button>} /><div className="classroom-summary"><div><span>Active classes</span><strong>{classes.filter((item) => item.status === 'active').length}</strong></div><div><span>Enrolled students</span><strong>{classes.reduce((sum, item) => sum + Number(item.student_count || 0), 0)}</strong></div><div><span>Upcoming calendar items</span><strong>{(pageData.events as ManagementRow[] | undefined)?.length ?? 0}</strong></div></div><section className="classroom-card-grid">{filteredClasses.filter((item) => item.status === 'active').slice(0, 6).map((item) => <button className="classroom-card" key={item.id} onClick={() => go(`classes/${item.id}`)}><span className="classroom-card__subject">{item.subject}</span><strong>{item.name}</strong><small>{item.course_title}{item.section ? ` · ${item.section}` : ''}</small><span className="classroom-card__meta"><Users size={14} /> {item.student_count} students <span>Recent activity {dateLabel(item.recent_activity)}</span></span></button>)}{!classes.length && <div className="classroom-empty">Create a classroom and link it to an existing published course.</div>}</section>{showForm && <div className="classroom-modal-backdrop"><ClassroomForm courses={courses} onSave={saveClassroom} onCancel={() => setShowForm(false)} /></div>}</>}
        {!loading && !classId && page === 'classes' && <><Heading title="Classes" note="Organize students into teaching groups using your existing PREPPX courses." action={<button className="button button--dark" onClick={() => { setEditClass(undefined); setShowForm(true); }}><Plus size={15} /> Create class</button>} /><label className="management-search classroom-search"><Search size={16} /><input placeholder="Search classes, subjects or batches" value={search} onChange={(event) => setSearch(event.target.value)} /></label><section className="classroom-card-grid">{filteredClasses.map((item) => <article className={`classroom-card classroom-card--manage ${item.status === 'archived' ? 'is-archived' : ''}`} key={item.id}><span className="classroom-card__subject">{item.subject} · {item.status}</span><button className="classroom-card__open" onClick={() => go(`classes/${item.id}`)}><strong>{item.name}</strong><small>{item.course_title}{item.section ? ` · ${item.section}` : ''}</small></button><span className="classroom-card__meta"><Users size={14} /> {item.student_count} students <span>Activity {dateLabel(item.recent_activity)}</span></span><div className="classroom-card__actions"><button className="button button--outline" onClick={() => { setEditClass(item); setShowForm(true); }}>Edit</button>{item.status === 'active' && <button className="button button--outline" onClick={() => void archiveClassroom(item)}>Archive</button>}</div></article>)}{!filteredClasses.length && <div className="classroom-empty">No matching classes. Create a classroom linked to a published course.</div>}</section>{showForm && <div className="classroom-modal-backdrop"><ClassroomForm courses={courses} initial={editClass} onSave={saveClassroom} onCancel={() => { setShowForm(false); setEditClass(undefined); }} /></div>}</>}
        {activeClass && <ClassroomWorkspace classroom={activeClass} onBack={() => go('classes')} onRefresh={() => void refresh()} />}
        {!loading && page === 'calendar' && <><Heading title="Calendar" note="Deadlines, assessments and scheduled live classes across your classrooms." /><div className="classroom-panel classroom-event-list">{((pageData.events as ManagementRow[] | undefined) ?? []).map((event) => <button className="classroom-list-row classroom-event" key={`${event.event_type}-${event.id}`} onClick={() => go(`classes/${event.classroom_id}?tab=classwork`)}><CalendarDays size={17} /><div><strong>{value(event, 'title')}</strong><small>{value(event, 'classroom_name')} · {value(event, 'event_type').replace('_', ' ')}</small></div><time>{dateLabel(event.starts_at)}</time><ChevronRight size={15} /></button>)}{!(pageData.events as ManagementRow[] | undefined)?.length && <p className="classroom-muted">No classroom dates are scheduled yet.</p>}</div></>}
        {!loading && page === 'review' && <><Heading title="To Review" note="Submitted assignment work and written assessment responses waiting for review." /><div className="classroom-panel">{[...((pageData.assignmentSubmissions as ManagementRow[] | undefined) ?? []), ...((pageData.assessmentAttempts as ManagementRow[] | undefined) ?? [])].map((item) => <button className="classroom-list-row" key={`${item.review_type}-${item.submission_id ?? item.attempt_id}`} onClick={() => go(`classes/${item.classroom_id}?tab=grades`)}><ClipboardCheck size={17} /><div><strong>{value(item, 'assignment_title', value(item, 'assessment_title'))}</strong><small>{value(item, 'full_name')} · {value(item, 'classroom_name')} · {value(item, 'review_type')}</small></div><time>{dateLabel(item.submitted_at)}</time><ArrowRight size={15} /></button>)}{!((pageData.assignmentSubmissions as ManagementRow[] | undefined)?.length || (pageData.assessmentAttempts as ManagementRow[] | undefined)?.length) && <p className="classroom-muted">Nothing is waiting for review.</p>}</div></>}
        {!loading && page === 'students' && <><Heading title="Student Records" note="Search existing student accounts and their classroom enrollment." /><label className="management-search classroom-search"><Search size={16} /><input placeholder="Search by name, email or roll number" value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="classroom-panel">{((pageData.students as ManagementRow[] | undefined) ?? []).map((student) => <div className="classroom-list-row" key={student.id}><Users size={17} /><div><strong>{value(student, 'full_name')}</strong><small>{value(student, 'email')} · {value(student, 'roll_number', 'No roll number')}</small></div><span>{value(student, 'enrolled_courses')} courses</span></div>)}{!(pageData.students as ManagementRow[] | undefined)?.length && <p className="classroom-muted">No matching student accounts.</p>}</div></>}
        {!loading && page === 'settings' && <SettingsPage />}
      </div>
    </main>
  </div>;
}

function SettingsPage() {
  const [status, setStatus] = useState<{ configured: boolean; resendKeyPresent: boolean; senderPresent: boolean } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    managementApi.get<typeof status>('/classrooms/settings/email')
      .then((result) => setStatus(result))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Email configuration status could not be checked.'));
  }, []);
  return <><Heading title="Settings" note="Management account and service readiness." /><section className="classroom-panel classroom-settings"><h2>Student email verification</h2><p>The check reports presence only. It never returns API keys or sender values.</p>{error ? <Notice message={error} /> : status ? <div className="classroom-setting-status"><span>Resend API key <strong>{status.resendKeyPresent ? 'Configured' : 'Missing'}</strong></span><span>Email sender <strong>{status.senderPresent ? 'Configured' : 'Missing'}</strong></span><span>Verification email <strong>{status.configured ? 'Ready' : 'Unavailable'}</strong></span></div> : <p>Checking configuration…</p>}<p>Configure <code>RESEND_API_KEY</code> and <code>EMAIL_FROM</code> in the backend environment. The sender must belong to a domain verified with Resend.</p></section></>;
}
