import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, ArrowLeft, BarChart3, BookOpen, CalendarDays, ClipboardCheck, FileText,
  GraduationCap, LayoutDashboard, LogOut, Menu, Megaphone, Search, Users, X,
} from 'lucide-react';
import { Brand } from '../../../components/common/Brand';
import { ThemeToggle } from '../../../components/ui/ThemeToggle';
import { managementApi, type ManagementRow, type ManagementUser } from '../services/managementApi';
import { COURSE_NODE_TYPES, getCourseNodeLabel, type CourseNodeSummary, type CourseNodeType } from '../../../../shared/courseNodes';
import { SUPPORTED_SUBJECTS } from '../../../../shared/subjects';
import { PasswordInput } from '../../../components/ui/PasswordInput';

const navigation = [
  { path: 'overview', label: 'Overview', icon: LayoutDashboard },
  { path: 'students', label: 'Students', icon: Users },
  { path: 'progress', label: 'Student progress', icon: Activity },
  { path: 'courses', label: 'Courses', icon: BookOpen },
  { path: 'materials', label: 'Learning materials', icon: FileText },
  { path: 'live-classes', label: 'Live classes', icon: CalendarDays },
  { path: 'assignments', label: 'Assignments', icon: ClipboardCheck },
  { path: 'assessments', label: 'Assessments', icon: GraduationCap },
  { path: 'announcements', label: 'Announcements', icon: Megaphone },
  { path: 'reports', label: 'Reports', icon: BarChart3 },
];

type Payload = Record<string, unknown>;

function text(value: unknown) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function count(value: unknown) {
  if (value === null || value === undefined) return '0';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString() : String(value);
}

function formatDate(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="form-field"><span>{label}</span>{children}</label>;
}

function SubjectField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <Field label="Subject"><select name="subject" value={value} onChange={(event) => onChange(event.target.value)} required><option value="">Select a subject</option>{SUPPORTED_SUBJECTS.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select></Field>;
}

function useCourseSelection(courses: ManagementRow[], loadNodes = false) {
  const [subject, setSubjectValue] = useState('');
  const [courseId, setCourseIdValue] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [courseNodes, setCourseNodes] = useState<CourseNodeSummary[]>([]);
  const [loadingNodes, setLoadingNodes] = useState(false);
  const [nodeError, setNodeError] = useState('');
  const availableCourses = useMemo(
    () => courses.filter((course) => course.subject === subject && course.status !== 'archived'),
    [courses, subject],
  );
  const selectableNodes = useMemo(
    () => courseNodes.filter((node) => node.node_type === 'topic' || node.node_type === 'lesson'),
    [courseNodes],
  );

  function setSubject(value: string) {
    setSubjectValue(value);
    setCourseIdValue('');
    setNodeId('');
    setCourseNodes([]);
    setNodeError('');
  }

  function setCourseId(value: string) {
    setCourseIdValue(value);
    setNodeId('');
    setCourseNodes([]);
    setNodeError('');
  }

  useEffect(() => {
    if (!loadNodes || !courseId) {
      setCourseNodes([]);
      setNodeError('');
      setLoadingNodes(false);
      return;
    }
    let active = true;
    setLoadingNodes(true);
    setNodeError('');
    managementApi.get<{ nodes: CourseNodeSummary[] }>(`/courses/${courseId}/nodes`)
      .then(({ nodes }) => { if (active) setCourseNodes(nodes); })
      .catch((reason: unknown) => {
        if (active) {
          setCourseNodes([]);
          setNodeError(reason instanceof Error ? reason.message : 'Could not load course topics.');
        }
      })
      .finally(() => { if (active) setLoadingNodes(false); });
    return () => { active = false; };
  }, [courseId, loadNodes]);

  return { subject, setSubject, courseId, setCourseId, nodeId, setNodeId, courseNodes, availableCourses, selectableNodes, loadingNodes, nodeError };
}

function CourseSelectionFields({
  selection, includeNode = false,
}: {
  selection: ReturnType<typeof useCourseSelection>;
  includeNode?: boolean;
}) {
  return <>
    <SubjectField value={selection.subject} onChange={selection.setSubject} />
    <Field label="Course"><select name="courseId" value={selection.courseId} disabled={!selection.subject} onChange={(event) => selection.setCourseId(event.target.value)}>
      <option value="">{selection.subject ? 'Not linked to a course' : 'Select a subject first'}</option>
      {selection.availableCourses.map((course) => <option key={course.id} value={course.id}>{text(course.title)}</option>)}
    </select></Field>
    {includeNode && <Field label="Topic / lesson"><select name="nodeId" value={selection.nodeId} disabled={!selection.courseId || selection.loadingNodes || selection.selectableNodes.length === 0} onChange={(event) => selection.setNodeId(event.target.value)}>
      <option value="">{selection.loadingNodes ? 'Loading course sequence…' : selection.courseId ? selection.selectableNodes.length ? 'Select a topic or lesson' : 'No topics or lessons available' : 'Select a course first'}</option>
      {selection.selectableNodes.map((node) => <option key={node.id} value={node.id}>{getCourseNodeLabel(node, selection.courseNodes)}</option>)}
    </select></Field>}
    {includeNode && selection.nodeError && <p className="form-error management-hint--wide" role="alert">{selection.nodeError}</p>}
  </>;
}

function SectionTitle({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <div className="management-section-title">
      <div><span className="eyebrow"><span className="eyebrow__line" /> MANAGEMENT</span><h1>{title}</h1><p>{description}</p></div>
      {children}
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="management-empty"><span>No records to display</span><p>{children}</p></div>;
}

function ErrorNote({ error }: { error: string }) {
  return error ? <div role="alert" className="management-error">{error}</div> : null;
}

function UploadProgress({ progress }: { progress: number | null }) {
  if (progress === null) return null;
  return <div className="management-hint" aria-live="polite">
    <span>Sending file · {progress}%</span>
    <div className="progress-track"><span className="progress-track__value" role="progressbar" aria-label="File upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} style={{ width: `${progress}%` }} /></div>
  </div>;
}

function LoginScreen({ onLogin }: { onLogin: (user: ManagementUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
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

  return (
    <main className="management-login">
      <header className="management-login__top"><Link to="/"><Brand /></Link><span>MANAGEMENT PORTAL</span></header>
      <section className="management-login__card">
        <span className="eyebrow"><span className="eyebrow__line" /> SECURE WORKSPACE</span>
        <h1>Management sign in</h1>
        <p>Access student progress, courses and learning operations.</p>
        <ErrorNote error={error} />
        <form className="management-form" onSubmit={submit}>
          <Field label="Work email"><input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
          <div className="form-field"><span>Password</span><PasswordInput aria-label="Password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
          <button className="button button--dark button--full button--large" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'}</button>
        </form>
        <Link className="management-login__back" to="/login"><ArrowLeft size={14} /> Back to account selection</Link>
      </section>
    </main>
  );
}

function StatCard({ title, value, note }: { title: string; value: unknown; note: string }) {
  return <article className="stat-card"><div className="stat-card__top"><span>{title}</span></div><div className="stat-card__value">{count(value)}</div><div className="stat-card__bottom">{note}</div></article>;
}

function DataTable({ columns, rows, empty, renderActions }: {
  columns: Array<{ key: string; label: string; render?: (row: ManagementRow) => ReactNode }>;
  rows: ManagementRow[];
  empty: string;
  renderActions?: (row: ManagementRow) => ReactNode;
}) {
  if (!rows.length) return <EmptyState>{empty}</EmptyState>;
  return (
    <div className="management-table-wrap"><table className="management-table">
      <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}{renderActions && <th>Actions</th>}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : text(row[column.key])}</td>)}{renderActions && <td><div className="management-row-actions">{renderActions(row)}</div></td>}</tr>)}</tbody>
    </table></div>
  );
}

function OverviewSection({ data, onNavigate }: { data: Payload; onNavigate: (path: string) => void }) {
  const countsData = data.counts as Payload | undefined;
  const engagement = data.engagement as Payload | undefined;
  const recent = (data.recentActivity as ManagementRow[] | undefined) ?? [];
  const completionPercent = Number(data.averageCompletion);
  const completionKnown = data.averageCompletion !== null && data.averageCompletion !== undefined && Number.isFinite(completionPercent);
  const activePercent = Number(countsData?.students) > 0
    ? Math.min(100, Math.round((Number(engagement?.active_students) / Number(countsData?.students)) * 100))
    : 0;
  return (
    <div className="management-page">
      <SectionTitle title="Management overview" description="A live view of learning activity and platform operations." />
      <div className="stats-grid">
        <StatCard title="Registered students" value={countsData?.students} note="Existing student accounts" />
        <StatCard title="Active students" value={engagement?.active_students} note="Learning activity in 30 days" />
        <StatCard title="Published courses" value={countsData?.courses} note="Non-archived courses" />
        <StatCard title="Available materials" value={countsData?.materials} note="Published for students" />
        <StatCard title="Upcoming live classes" value={countsData?.upcoming_classes} note="Scheduled from now" />
        <StatCard title="Published assignments" value={countsData?.assignments} note="Across all subjects" />
        <StatCard title="Published assessments" value={countsData?.assessments} note="Across all subjects" />
        <StatCard title="Average completion" value={data.averageCompletion === null ? '—' : `${text(data.averageCompletion)}%`} note="Enrolled course lessons" />
      </div>
      <section className="management-panel"><h2>Learning snapshot</h2><div className="management-chart-list">
        <div><span>Average enrolled-course completion</span><strong>{completionKnown ? `${completionPercent}%` : 'No course data'}</strong><div className="management-chart-track" role="img" aria-label={`Average completion ${completionKnown ? completionPercent : 0} percent`}><span style={{ width: `${completionKnown ? Math.min(100, Math.max(0, completionPercent)) : 0}%` }} /></div></div>
        <div><span>Students active in the last 30 days</span><strong>{activePercent}% of registered students</strong><div className="management-chart-track" role="img" aria-label={`${activePercent} percent of students active in the last 30 days`}><span style={{ width: `${activePercent}%` }} /></div></div>
      </div></section>
      <section className="content-section">
        <div className="section-heading"><div><span className="section-kicker">LATEST RECORDS</span><h2>Recent learning activity</h2></div></div>
        <DataTable rows={recent} empty="Student learning activity will appear here when the Student Portal records activity." columns={[
          { key: 'student_name', label: 'Student' }, { key: 'activity_type', label: 'Activity' },
          { key: 'course_title', label: 'Course' }, { key: 'lesson_title', label: 'Lesson' },
          { key: 'occurred_at', label: 'When', render: (row) => formatDate(row.occurred_at) },
        ]} />
      </section>
      <div className="management-quick-links">{[
        ['students', 'Find a student'], ['courses', 'Manage courses'], ['reports', 'Open reports'],
      ].map(([path, label]) => <button key={path} className="button button--outline" onClick={() => onNavigate(path)}>{label}</button>)}</div>
    </div>
  );
}

function StudentsSection({ onProgress }: { onProgress: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('name');
  const [rows, setRows] = useState<ManagementRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    managementApi.get<{ students: ManagementRow[]; total: number; page: number; pageSize: number }>(`/students?q=${encodeURIComponent(query)}&page=${page}&pageSize=25&sort=${sort}`)
      .then((result) => {
        if (!active) return;
        const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize));
        if (result.page > lastPage) {
          setPage(lastPage);
          return;
        }
        setRows(result.students);
        setTotal(result.total);
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load students.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, page, sort]);
  return (
    <div className="management-page">
      <SectionTitle title="Students" description="Search and review existing student accounts. Student creation is not available in Management." />
      <div className="management-toolbar">
        <label className="management-search"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search name, email or roll number" aria-label="Search students" /></label>
        <label className="management-sort">Sort by <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="name">Name</option><option value="newest">Recently registered</option><option value="xp">XP earned</option></select></label>
      </div>
      <ErrorNote error={error} />
      {loading ? <div className="management-loading">Loading student records…</div> : (
        <DataTable rows={rows} empty="No registered student records are available in the management database." columns={[
          { key: 'full_name', label: 'Student' }, { key: 'roll_number', label: 'Roll number' },
          { key: 'email', label: 'Email' }, { key: 'enrolled_courses', label: 'Courses' },
          { key: 'recent_activities', label: 'Activity · 30d' }, { key: 'total_xp', label: 'XP' },
        ]} renderActions={(row) => <button className="management-text-action" onClick={() => onProgress(row.id)}>View progress</button>} />
      )}
      <div className="management-pagination"><button className="button button--outline" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {Math.max(1, Math.ceil(total / 25))} · {total} students</span><button className="button button--outline" disabled={loading || page >= Math.max(1, Math.ceil(total / 25))} onClick={() => setPage((value) => value + 1)}>Next</button></div>
    </div>
  );
}

function ProgressSection({ studentId, onBack }: { studentId: string | null; onBack: () => void }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!studentId) return;
    setData(null);
    setError('');
    managementApi.get<Payload>(`/students/${studentId}`).then(setData).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load student progress.'));
  }, [studentId]);
  if (!studentId) return <div className="management-page"><SectionTitle title="Student progress" description="Select a student from the student directory to inspect their activity and progress." /><button className="button button--outline" onClick={onBack}>Open student directory</button></div>;
  const student = data?.student as ManagementRow | undefined;
  const profileData = data ?? {};
  const onSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const updated = await managementApi.patch<{ student: ManagementRow }>(`/students/${studentId}`, {
        fullName: form.get('fullName'), phone: form.get('phone'), rollNumber: form.get('rollNumber') || null,
      });
      setData((current) => current ? { ...current, student: updated.student } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update student details.');
    } finally { setBusy(false); }
  };
  return (
    <div className="management-page">
      <SectionTitle title={student ? text(student.full_name) : 'Student progress'} description="Individual profile, course activity and assessment history."><button className="button button--outline" onClick={onBack}>Back to students</button></SectionTitle>
      <ErrorNote error={error} />
      {!data && !error ? <div className="management-loading">Loading student profile…</div> : null}
      {student && <div className="management-detail-grid">
        <section className="management-panel"><h2>Student information</h2><form className="management-form" onSubmit={onSave}>
          <Field label="Full name"><input name="fullName" defaultValue={text(student.full_name)} required /></Field>
          <Field label="Email"><input value={text(student.email)} readOnly /></Field>
          <Field label="Roll number"><input name="rollNumber" defaultValue={text(student.roll_number) === '—' ? '' : text(student.roll_number)} /></Field>
          <Field label="Phone"><input name="phone" defaultValue={text(student.phone) === '—' ? '' : text(student.phone)} /></Field>
          <button className="button button--dark" disabled={busy}>{busy ? 'Saving…' : 'Save student details'}</button>
        </form><div className="management-academic"><strong>Academic information</strong><pre>{JSON.stringify(student.academic_info ?? {}, null, 2)}</pre></div></section>
        <section className="management-panel"><h2>Learning summary</h2><p><strong>{count(profileData.xp)}</strong> total XP</p><DataTable rows={(profileData.courses as ManagementRow[] | undefined) ?? []} empty="No course enrolments recorded." columns={[
          { key: 'title', label: 'Course' }, { key: 'subject', label: 'Subject' },
          { key: 'lessons_completed', label: 'Lessons done' }, { key: 'lessons_total', label: 'Lessons total' },
        ]} /></section>
        <section className="management-panel management-panel--wide"><h2>Learning activity</h2><DataTable rows={(profileData.activity as ManagementRow[] | undefined) ?? []} empty="No learning activity recorded." columns={[
          { key: 'activity_type', label: 'Activity' }, { key: 'course_title', label: 'Course' }, { key: 'lesson_title', label: 'Lesson' }, { key: 'occurred_at', label: 'When', render: (row) => formatDate(row.occurred_at) },
        ]} /></section>
        <section className="management-panel"><h2>Assessment attempts</h2><DataTable rows={(profileData.assessmentAttempts as ManagementRow[] | undefined) ?? []} empty="No assessment attempts recorded." columns={[
          { key: 'title', label: 'Assessment' }, { key: 'score', label: 'Score' }, { key: 'total_marks', label: 'Out of' }, { key: 'submitted_at', label: 'Submitted', render: (row) => formatDate(row.submitted_at) },
        ]} /></section>
        <section className="management-panel"><h2>Assignments</h2><DataTable rows={(profileData.assignmentSubmissions as ManagementRow[] | undefined) ?? []} empty="No assignment submissions recorded." columns={[
          { key: 'title', label: 'Assignment' }, { key: 'status', label: 'Status' }, { key: 'score', label: 'Score' }, { key: 'submitted_at', label: 'Submitted', render: (row) => formatDate(row.submitted_at) },
        ]} /></section>
      </div>}
    </div>
  );
}

function CoursesSection({ data, refresh }: { data: ManagementRow[]; refresh: () => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [openCourse, setOpenCourse] = useState('');
  const [nodes, setNodes] = useState<Record<string, CourseNodeSummary[]>>({});
  const [subject, setSubject] = useState('');
  const [newNodeType, setNewNodeType] = useState<CourseNodeType>('unit');
  const [newNodeParent, setNewNodeParent] = useState('');
  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await managementApi.post('/courses', { title: form.get('title'), description: form.get('description'), subject: form.get('subject'), status: form.get('status') });
      formElement.reset(); setSubject(''); refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create the course.'); }
    finally { setBusy(false); }
  }
  async function changeStatus(row: ManagementRow, status: string) {
    try { await managementApi.patch(`/courses/${row.id}`, { status }); refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update the course.'); }
  }
  async function editCourse(row: ManagementRow) {
    const title = window.prompt('Course title:', text(row.title));
    if (title === null) return;
    const description = window.prompt('Course description:', text(row.description) === '—' ? '' : text(row.description));
    if (description === null) return;
    try { await managementApi.patch(`/courses/${row.id}`, { title, description }); refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update the course.'); }
  }
  async function openNodes(row: ManagementRow) {
    setOpenCourse((current) => current === row.id ? '' : row.id);
    if (!nodes[row.id]) {
      try { const result = await managementApi.get<{ nodes: CourseNodeSummary[] }>(`/courses/${row.id}/nodes`); setNodes((current) => ({ ...current, [row.id]: result.nodes })); }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load topics.'); }
    }
  }
  async function createNode(event: FormEvent<HTMLFormElement>, courseId: string) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    try {
      await managementApi.post(`/courses/${courseId}/nodes`, { nodeType: form.get('nodeType'), parentId: form.get('parentId') || null, title: form.get('title'), description: form.get('description'), position: Number(form.get('position')) || 0 });
      const result = await managementApi.get<{ nodes: CourseNodeSummary[] }>(`/courses/${courseId}/nodes`);
      setNodes((current) => ({ ...current, [courseId]: result.nodes })); formElement.reset(); setNewNodeParent('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not add the topic.'); }
  }
  async function editNode(courseId: string, node: ManagementRow) {
    const title = window.prompt('Topic or lesson title:', text(node.title));
    if (title === null) return;
    try {
      await managementApi.patch(`/courses/${courseId}/nodes/${node.id}`, { title });
      const result = await managementApi.get<{ nodes: CourseNodeSummary[] }>(`/courses/${courseId}/nodes`);
      setNodes((current) => ({ ...current, [courseId]: result.nodes }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update the topic.'); }
  }
  async function deleteNode(courseId: string, nodeId: string) {
    if (!window.confirm('Delete this topic and its nested topics?')) return;
    try {
      await managementApi.remove(`/courses/${courseId}/nodes/${nodeId}`);
      const result = await managementApi.get<{ nodes: CourseNodeSummary[] }>(`/courses/${courseId}/nodes`);
      setNodes((current) => ({ ...current, [courseId]: result.nodes }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete the topic.'); }
  }
  return <div className="management-page">
    <SectionTitle title="Courses" description="Create courses, organise learning into topics and control publishing." />
    <ErrorNote error={error} />
    <section className="management-panel"><h2>Create a course</h2><form className="management-form management-form--grid" onSubmit={createCourse}>
      <Field label="Course title"><input name="title" required minLength={2} maxLength={180} /></Field>
      <SubjectField value={subject} onChange={setSubject} />
      <Field label="Visibility"><select name="status"><option value="draft">Draft</option><option value="published">Published</option></select></Field>
      <Field label="Description"><input name="description" maxLength={8000} /></Field>
      <button className="button button--dark" disabled={busy}>{busy ? 'Creating…' : 'Create course'}</button>
    </form></section>
    <section className="content-section"><div className="section-heading"><div><span className="section-kicker">COURSE CATALOGUE</span><h2>Courses and enrolments</h2></div></div>
      <DataTable rows={data} empty="No courses have been created." columns={[
        { key: 'title', label: 'Course' }, { key: 'subject', label: 'Subject' }, { key: 'status', label: 'Status' }, { key: 'enrollments', label: 'Enrolments' }, { key: 'lessons', label: 'Lessons' },
      ]} renderActions={(row) => <><button className="management-text-action" onClick={() => void editCourse(row)}>Edit</button><button className="management-text-action" onClick={() => void openNodes(row)}>Topics</button><select aria-label={`Set status for ${text(row.title)}`} value={text(row.status)} onChange={(event) => void changeStatus(row, event.target.value)}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archive</option></select></>} />
      {data.filter((row) => openCourse === row.id).map((row) => <div className="management-node-panel" key={row.id}>
        <h3>Learning sequence · {text(row.title)}</h3>
        <ul>{(nodes[row.id] ?? []).map((node) => <li key={node.id}><span>{getCourseNodeLabel(node, nodes[row.id] ?? [])}</span><small>{node.node_type}</small><button className="management-text-action" onClick={() => void editNode(row.id, node)}>Edit</button><button className="management-text-action" onClick={() => void deleteNode(row.id, node.id)}>Delete</button></li>)}</ul>
        <form className="management-form management-form--grid" onSubmit={(event) => void createNode(event, row.id)}>
          <Field label="Type"><select name="nodeType" value={newNodeType} onChange={(event) => { const selected = COURSE_NODE_TYPES.find((nodeType) => nodeType === event.target.value); if (selected) { setNewNodeType(selected); setNewNodeParent(''); } }}><option value="subject" disabled={(nodes[row.id] ?? []).length > 0}>Subject</option><option value="unit">Unit</option><option value="topic">Topic</option><option value="lesson">Lesson</option></select></Field>
          <Field label="Parent (optional)"><select name="parentId" value={newNodeParent} onChange={(event) => setNewNodeParent(event.target.value)}><option value="" disabled={newNodeType === 'topic' || newNodeType === 'lesson' || (newNodeType === 'unit' && (nodes[row.id] ?? []).some((node) => node.node_type === 'subject'))}>Top level</option>{(nodes[row.id] ?? []).filter((node) => (
            (newNodeType === 'unit' && node.node_type === 'subject')
            || (newNodeType === 'topic' && node.node_type === 'unit')
            || (newNodeType === 'lesson' && node.node_type === 'topic')
          )).map((node) => <option key={node.id} value={node.id}>{getCourseNodeLabel(node, nodes[row.id] ?? [])}</option>)}</select></Field>
          <Field label="Title"><input name="title" required /></Field><Field label="Description"><input name="description" /></Field>
          <Field label="Position"><input name="position" type="number" min="0" defaultValue="0" /></Field>
          <button className="button button--outline">Add topic</button>
        </form>
      </div>)}
    </section>
  </div>;
}

function MaterialsSection({ data, courses, refresh }: { data: ManagementRow[]; courses: ManagementRow[]; refresh: () => void }) {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [replacingId, setReplacingId] = useState('');
  const [replaceProgress, setReplaceProgress] = useState<number | null>(null);
  const selection = useCourseSelection(courses, true);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    setNotice('');
    setUploadProgress(0);
    const formElement = event.currentTarget; const form = new FormData(formElement);
    if (!form.get('courseId')) form.delete('courseId');
    if (!form.get('nodeId')) form.delete('nodeId');
    try { await managementApi.upload('/materials', form, setUploadProgress); formElement.reset(); selection.setSubject(''); setNotice('Material uploaded and saved.'); refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Upload failed.'); }
    finally { setBusy(false); setUploadProgress(null); }
  }
  async function archive(id: string) {
    if (!window.confirm('Archive this learning material?')) return;
    try {
      const result = await managementApi.remove<{ warning?: string }>(`/materials/${id}`);
      setNotice(result?.warning ?? 'Material archived.');
      refresh();
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not archive material.'); }
  }
  async function download(id: string) {
    try { const result = await managementApi.get<{ url: string }>(`/materials/${id}/download`); window.open(result.url, '_blank', 'noopener,noreferrer'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not open material.'); }
  }
  async function editMaterial(row: ManagementRow) {
    const title = window.prompt('Material title:', text(row.title));
    if (title === null) return;
    const description = window.prompt('Material description:', text(row.description) === '—' ? '' : text(row.description));
    if (description === null) return;
    try { await managementApi.patch(`/materials/${row.id}`, { title, description }); setNotice('Material information updated.'); refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update material information.'); }
  }
  async function replaceMaterial(id: string, file?: File) {
    if (!file || replacingId) return;
    const form = new FormData();
    form.set('file', file);
    setError('');
    setNotice('');
    setReplacingId(id);
    setReplaceProgress(0);
    try {
      const result = await managementApi.upload<{ warning?: string }>(`/materials/${id}/file`, form, setReplaceProgress);
      setNotice(result.warning ?? 'Replacement file uploaded and saved.');
      refresh();
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not replace the material file.'); }
    finally { setReplacingId(''); setReplaceProgress(null); }
  }
  return <div className="management-page">
    <SectionTitle title="Learning materials" description="Upload verified learning files and attach them to a course and topic." />
    <ErrorNote error={error} />
    {notice && <div className="management-success" role="status">{notice}</div>}
    <section className="management-panel"><h2>Upload material</h2><p className="management-hint">PDF, MP4, WebM, DOC, DOCX, PPT or PPTX · maximum 50 MB. Storage must be configured before upload.</p>
      <form className="management-form management-form--grid" onSubmit={(event) => void upload(event)} encType="multipart/form-data">
        <Field label="Title"><input name="title" required /></Field>
        <CourseSelectionFields selection={selection} includeNode />
        <Field label="Description"><input name="description" /></Field><Field label="Sequence"><input name="position" type="number" min="0" defaultValue="0" /></Field>
        <Field label="File"><input name="file" type="file" required accept=".pdf,.mp4,.webm,.doc,.docx,.ppt,.pptx" /></Field>
        <button className="button button--dark" disabled={busy}>{busy ? 'Uploading…' : 'Upload material'}</button>
        <UploadProgress progress={uploadProgress} />
      </form>
    </section>
    <DataTable rows={data} empty="No learning materials have been uploaded." columns={[
      { key: 'title', label: 'Material' }, { key: 'course_title', label: 'Course' }, { key: 'subject', label: 'Subject' }, { key: 'original_filename', label: 'File' }, { key: 'status', label: 'Status' },
    ]} renderActions={(row) => <><button className="management-text-action" onClick={() => void editMaterial(row)}>Edit</button><label className="management-text-action">{replacingId === row.id ? 'Replacing…' : 'Replace'}<input className="management-hidden-file" type="file" accept=".pdf,.mp4,.webm,.doc,.docx,.ppt,.pptx" disabled={Boolean(replacingId)} onChange={(event) => { const input = event.currentTarget; void replaceMaterial(row.id, input.files?.[0]).finally(() => { input.value = ''; }); }} /></label><button className="management-text-action" onClick={() => void download(row.id)}>Open</button><button className="management-text-action" onClick={() => void archive(row.id)}>Archive</button></>} />
    {replacingId && <UploadProgress progress={replaceProgress} />}
  </div>;
}

function LiveClassesSection({ data, courses, refresh }: { data: ManagementRow[]; courses: ManagementRow[]; refresh: () => void }) {
  const [error, setError] = useState('');
  const selection = useCourseSelection(courses);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    try {
      await managementApi.post('/live-classes', {
        title: form.get('title'), description: form.get('description'), subject: form.get('subject'),
        instructor: form.get('instructor'), courseId: form.get('courseId') || null,
        startsAt: new Date(String(form.get('startsAt'))).toISOString(), endsAt: new Date(String(form.get('endsAt'))).toISOString(),
        meetingUrl: form.get('meetingUrl') || null,
      }); formElement.reset(); selection.setSubject(''); refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create the live class.'); }
  }
  async function cancel(id: string) {
    if (!window.confirm('Cancel this live class?')) return;
    try { await managementApi.post(`/live-classes/${id}/cancel`, {}); refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not cancel the live class.'); }
  }
  async function edit(row: ManagementRow) {
    const title = window.prompt('Class title:', text(row.title));
    if (title === null) return;
    const instructor = window.prompt('Instructor:', text(row.instructor));
    if (instructor === null) return;
    const meetingUrl = window.prompt('Meeting URL (leave blank to clear):', text(row.meeting_url) === '—' ? '' : text(row.meeting_url));
    if (meetingUrl === null) return;
    try { await managementApi.patch(`/live-classes/${row.id}`, { title, instructor, meetingUrl: meetingUrl || null }); refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update the live class.'); }
  }
  return <div className="management-page"><SectionTitle title="Live classes" description="Schedule external live sessions; meeting links open the provider configured by the instructor." /><ErrorNote error={error} />
    <section className="management-panel"><h2>Schedule a live class</h2><form className="management-form management-form--grid" onSubmit={(event) => void create(event)}>
      <Field label="Title"><input name="title" required /></Field><CourseSelectionFields selection={selection} />
      <Field label="Instructor"><input name="instructor" required /></Field>
      <Field label="Starts"><input name="startsAt" type="datetime-local" required /></Field><Field label="Ends"><input name="endsAt" type="datetime-local" required /></Field>
      <Field label="Meeting URL"><input name="meetingUrl" type="url" /></Field><Field label="Description"><input name="description" /></Field><button className="button button--dark">Schedule class</button>
    </form></section>
    <DataTable rows={data} empty="No live classes have been scheduled." columns={[
      { key: 'title', label: 'Class' }, { key: 'subject', label: 'Subject' }, { key: 'instructor', label: 'Instructor' }, { key: 'starts_at', label: 'Starts', render: (row) => formatDate(row.starts_at) }, { key: 'status', label: 'Status' }, { key: 'meeting_url', label: 'Meeting link' },
    ]} renderActions={(row) => <>{text(row.status) === 'scheduled' && <><button className="management-text-action" onClick={() => void edit(row)}>Edit</button><button className="management-text-action" onClick={() => void cancel(row.id)}>Cancel</button></>}{row.meeting_url && <a className="management-text-action" href={String(row.meeting_url)} target="_blank" rel="noreferrer">Join link</a>}</>} />
  </div>;
}

function AssignmentsSection({ data, courses, refresh }: { data: ManagementRow[]; courses: ManagementRow[]; refresh: () => void }) {
  const [error, setError] = useState('');
  const [submissions, setSubmissions] = useState<ManagementRow[]>([]);
  const [assignmentId, setAssignmentId] = useState('');
  const selection = useCourseSelection(courses);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    try {
      await managementApi.post('/assignments', { title: form.get('title'), instructions: form.get('instructions'), subject: form.get('subject'), courseId: form.get('courseId') || null, dueAt: form.get('dueAt') ? new Date(String(form.get('dueAt'))).toISOString() : null, maxMarks: form.get('maxMarks') ? Number(form.get('maxMarks')) : null, status: form.get('status') });
      formElement.reset(); selection.setSubject(''); refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create assignment.'); }
  }
  async function viewSubmissions(id: string) {
    setError('');
    try { const result = await managementApi.get<{ submissions: ManagementRow[] }>(`/assignments/${id}/submissions`); setSubmissions(result.submissions); setAssignmentId(id); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load submissions.'); }
  }
  async function review(row: ManagementRow) {
    const score = window.prompt(`Score (maximum ${text(row.max_marks)}):`, text(row.score) === '—' ? '' : text(row.score));
    if (score === null) return;
    const feedback = window.prompt('Feedback for the student:', text(row.feedback) === '—' ? '' : text(row.feedback));
    if (feedback === null) return;
    try { await managementApi.patch(`/submissions/${row.id}/review`, { score: score.trim() ? Number(score) : null, feedback }); await viewSubmissions(assignmentId); refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save submission review.'); }
  }
  async function openSubmissionAttachment(row: ManagementRow) {
    try {
      const { url } = await managementApi.get<{ url: string }>(`/submissions/${row.id}/attachment`);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not open this submission attachment.'); }
  }
  async function editAssignment(row: ManagementRow) {
    const title = window.prompt('Assignment title:', text(row.title));
    if (title === null) return;
    const instructions = window.prompt('Assignment instructions:', text(row.instructions));
    if (instructions === null) return;
    try { await managementApi.patch(`/assignments/${row.id}`, { title, instructions }); refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update assignment.'); }
  }
  async function changeStatus(row: ManagementRow, status: string) {
    try { await managementApi.patch(`/assignments/${row.id}`, { status }); refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update assignment status.'); }
  }
  return <div className="management-page"><SectionTitle title="Assignments" description="Publish work, track submissions and record grades with feedback." /><ErrorNote error={error} />
    <section className="management-panel"><h2>Create assignment</h2><form className="management-form management-form--grid" onSubmit={(event) => void create(event)}>
      <Field label="Title"><input name="title" required /></Field><CourseSelectionFields selection={selection} />
      <Field label="Due date"><input name="dueAt" type="datetime-local" /></Field><Field label="Maximum marks"><input name="maxMarks" type="number" min="0" step="0.5" /></Field>
      <Field label="Status"><select name="status"><option value="draft">Draft</option><option value="published">Published</option></select></Field><Field label="Instructions"><textarea name="instructions" required rows={3} /></Field><button className="button button--dark">Create assignment</button>
    </form></section>
    <DataTable rows={data} empty="No assignments have been created." columns={[
      { key: 'title', label: 'Assignment' }, { key: 'course_title', label: 'Course' }, { key: 'subject', label: 'Subject' }, { key: 'status', label: 'Status' }, { key: 'submissions', label: 'Submissions' }, { key: 'reviewed', label: 'Reviewed' },
    ]} renderActions={(row) => <><button className="management-text-action" onClick={() => void editAssignment(row)}>Edit</button><button className="management-text-action" onClick={() => void viewSubmissions(row.id)}>Review work</button><select aria-label={`Set status for ${text(row.title)}`} value={text(row.status)} onChange={(event) => void changeStatus(row, event.target.value)}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archive</option></select></>} />
    {assignmentId && <section className="management-panel"><div className="section-heading"><h2>Submissions</h2><button className="management-text-action" onClick={() => setAssignmentId('')}>Close</button></div>
      <DataTable rows={submissions} empty="No student submissions have been received." columns={[
        { key: 'full_name', label: 'Student' }, { key: 'roll_number', label: 'Roll number' }, { key: 'submitted_at', label: 'Submitted', render: (row) => formatDate(row.submitted_at) }, { key: 'status', label: 'Status' }, { key: 'score', label: 'Score' }, { key: 'response_text', label: 'Response' },
      ]} renderActions={(row) => <>{row.attachment_key && <button className="management-text-action" onClick={() => void openSubmissionAttachment(row)}>Open {text(row.attachment_filename) === '—' ? 'attachment' : text(row.attachment_filename)}</button>}<button className="management-text-action" onClick={() => void review(row)}>Grade</button></>} />
    </section>}
  </div>;
}

function AssessmentsSection({ data, courses, refresh }: { data: ManagementRow[]; courses: ManagementRow[]; refresh: () => void }) {
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState<ManagementRow[]>([]);
  const [assessmentId, setAssessmentId] = useState('');
  const [reviewAttempt, setReviewAttempt] = useState<{ id: string; feedback: string; responses: { question_id: string; question_type: string; prompt: string; answer_text: string | null; options: string[]; selected_option: number | null; awarded_marks: number | null; marks: number }[] } | null>(null);
  const [responseGrades, setResponseGrades] = useState<Record<string, { awardedMarks: string; feedback: string }>>({});
  const selection = useCourseSelection(courses);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    try {
      const questions = JSON.parse(String(form.get('questions'))) as unknown;
      await managementApi.post('/assessments', {
        title: form.get('title'), description: form.get('description'), subject: form.get('subject'),
        courseId: form.get('courseId') || null, durationMinutes: form.get('durationMinutes') ? Number(form.get('durationMinutes')) : null,
        status: form.get('status'), questions,
      });
      formElement.reset(); selection.setSubject(''); refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Assessment data must contain a valid questions array.'); }
  }
  async function loadAttempts(id: string) {
    try { const result = await managementApi.get<{ attempts: ManagementRow[] }>(`/assessments/${id}/attempts`); setAttempts(result.attempts); setAssessmentId(id); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load assessment attempts.'); }
  }
  async function loadReview(id: string) {
    setError('');
    try {
      const detail = await managementApi.get<{ attempt: { id: string; feedback: string }; responses: { question_id: string; question_type: string; prompt: string; answer_text: string | null; options: string[]; selected_option: number | null; awarded_marks: number | null; marks: number }[] }>(`/assessment-attempts/${id}`);
      setReviewAttempt({ id: detail.attempt.id, feedback: detail.attempt.feedback, responses: detail.responses });
      setResponseGrades(Object.fromEntries(detail.responses.filter((item) => item.question_type !== 'multiple_choice').map((item) => [item.question_id, { awardedMarks: String(item.awarded_marks ?? 0), feedback: '' }])));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load assessment responses.'); }
  }
  async function saveReview() {
    if (!reviewAttempt) return;
    try {
      await managementApi.patch(`/assessment-attempts/${reviewAttempt.id}/review`, {
        feedback: reviewAttempt.feedback,
        responses: reviewAttempt.responses.filter((item) => item.question_type !== 'multiple_choice').map((item) => ({
          questionId: item.question_id,
          awardedMarks: Number(responseGrades[item.question_id]?.awardedMarks ?? 0),
          feedback: responseGrades[item.question_id]?.feedback ?? '',
        })),
      });
      setReviewAttempt(null);
      if (assessmentId) await loadAttempts(assessmentId);
      refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save assessment review.'); }
  }
  async function setStatus(row: ManagementRow) {
    const status = text(row.status) === 'published' ? 'draft' : 'published';
    try { await managementApi.patch(`/assessments/${row.id}`, { status }); refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update assessment.'); }
  }
  return <div className="management-page"><SectionTitle title="Assessments" description="Create and publish scheduled quizzes. Objective responses can be evaluated automatically." /><ErrorNote error={error} />
    <section className="management-panel"><h2>Create assessment</h2><form className="management-form management-form--grid" onSubmit={(event) => void create(event)}>
      <Field label="Title"><input name="title" required /></Field><CourseSelectionFields selection={selection} />
      <Field label="Duration (minutes)"><input name="durationMinutes" type="number" min="1" /></Field><Field label="Status"><select name="status"><option value="draft">Draft</option><option value="published">Published</option></select></Field>
      <Field label="Description"><input name="description" /></Field>
      <Field label="Questions (JSON)"><textarea name="questions" rows={6} required placeholder={'[{"questionType":"multiple_choice","prompt":"Question text","options":["Option A","Option B"],"correctOption":0,"marks":1}]'} /></Field>
      <p className="management-hint management-hint--wide">Question objects support `multiple_choice`, `short_answer` and `long_answer`. Subjective responses are not auto-graded. The JSON is saved only when the form succeeds.</p>
      <button className="button button--dark">Create assessment</button>
    </form></section>
    <DataTable rows={data} empty="No assessments have been created." columns={[
      { key: 'title', label: 'Assessment' }, { key: 'subject', label: 'Subject' }, { key: 'status', label: 'Status' }, { key: 'questions', label: 'Questions' }, { key: 'attempts', label: 'Attempts' }, { key: 'average_score', label: 'Average score' },
    ]} renderActions={(row) => <><button className="management-text-action" onClick={() => void setStatus(row)}>{text(row.status) === 'published' ? 'Unpublish' : 'Publish'}</button><button className="management-text-action" onClick={() => void loadAttempts(row.id)}>View attempts</button></>} />
    {assessmentId && <section className="management-panel"><div className="section-heading"><h2>Assessment attempts</h2><button className="management-text-action" onClick={() => setAssessmentId('')}>Close</button></div><DataTable rows={attempts} empty="No student attempts recorded." columns={[
      { key: 'full_name', label: 'Student' }, { key: 'email', label: 'Email' }, { key: 'score', label: 'Score' }, { key: 'total_marks', label: 'Out of' }, { key: 'pending_review', label: 'Review status', render: (row) => !row.submitted_at ? 'In progress' : row.pending_review ? 'Pending review' : 'Evaluated' }, { key: 'submitted_at', label: 'Submitted', render: (row) => formatDate(row.submitted_at) },
    ]} renderActions={(row) => row.submitted_at && row.pending_review ? <button className="management-text-action" onClick={() => void loadReview(row.id)}>Review answers</button> : null} /></section>}
    {reviewAttempt && <section className="management-panel"><div className="section-heading"><h2>Review subjective answers</h2><button className="management-text-action" onClick={() => setReviewAttempt(null)}>Close</button></div>{reviewAttempt.responses.filter((item) => item.question_type !== 'multiple_choice').map((item) => <article className="management-panel" key={item.question_id}><h3>{item.prompt}</h3><p>{item.answer_text || 'No written answer.'}</p><Field label={`Awarded marks (maximum ${item.marks})`}><input type="number" min="0" max={item.marks} step="0.01" value={responseGrades[item.question_id]?.awardedMarks ?? '0'} onChange={(event) => setResponseGrades((current) => ({ ...current, [item.question_id]: { ...current[item.question_id], awardedMarks: event.target.value } }))} /></Field><Field label="Response feedback"><textarea rows={2} value={responseGrades[item.question_id]?.feedback ?? ''} onChange={(event) => setResponseGrades((current) => ({ ...current, [item.question_id]: { ...current[item.question_id], feedback: event.target.value } }))} /></Field></article>)}<Field label="Overall feedback"><textarea rows={3} value={reviewAttempt.feedback} onChange={(event) => setReviewAttempt((current) => current ? { ...current, feedback: event.target.value } : current)} /></Field><button className="button button--dark" onClick={() => void saveReview()}>Save review</button></section>}
  </div>;
}

function AnnouncementsSection({ data, courses, refresh }: { data: ManagementRow[]; courses: ManagementRow[]; refresh: () => void }) {
  const [error, setError] = useState('');
  const selection = useCourseSelection(courses);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    try { await managementApi.post('/announcements', { title: form.get('title'), body: form.get('body'), linkUrl: form.get('linkUrl') || null, courseId: form.get('courseId') || null, status: form.get('status') }); formElement.reset(); selection.setSubject(''); refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not publish announcement.'); }
  }
  async function change(row: ManagementRow) {
    const status = text(row.status) === 'published' ? 'draft' : 'published';
    try { await managementApi.patch(`/announcements/${row.id}`, { status }); refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update announcement.'); }
  }
  async function edit(row: ManagementRow) {
    const title = window.prompt('Announcement title:', text(row.title));
    if (title === null) return;
    const body = window.prompt('Announcement message:', text(row.body));
    if (body === null) return;
    try { await managementApi.patch(`/announcements/${row.id}`, { title, body }); refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not edit announcement.'); }
  }
  async function archive(id: string) {
    if (!window.confirm('Archive this announcement?')) return;
    try { await managementApi.remove(`/announcements/${id}`); refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not archive announcement.'); }
  }
  return <div className="management-page"><SectionTitle title="Announcements" description="Publish updates for students or target an announcement to a course." /><ErrorNote error={error} />
    <section className="management-panel"><h2>Write an announcement</h2><form className="management-form management-form--grid" onSubmit={(event) => void create(event)}>
      <Field label="Title"><input name="title" required /></Field><CourseSelectionFields selection={selection} />
      <Field label="Link (optional)"><input name="linkUrl" type="url" /></Field><Field label="Status"><select name="status"><option value="draft">Draft</option><option value="published">Publish now</option></select></Field>
      <Field label="Message"><textarea name="body" required rows={4} /></Field><button className="button button--dark">Save announcement</button>
    </form></section>
    <DataTable rows={data} empty="No announcements have been created." columns={[
      { key: 'title', label: 'Announcement' }, { key: 'course_title', label: 'Course' }, { key: 'status', label: 'Status' }, { key: 'published_at', label: 'Published', render: (row) => formatDate(row.published_at) },
    ]} renderActions={(row) => <><button className="management-text-action" onClick={() => void edit(row)}>Edit</button><button className="management-text-action" onClick={() => void change(row)}>{text(row.status) === 'published' ? 'Unpublish' : 'Publish'}</button><button className="management-text-action" onClick={() => void archive(row.id)}>Archive</button></>} />
  </div>;
}

function ReportsSection() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  async function load() {
    setError('');
    try { const result = await managementApi.get<Payload>(`/reports/summary?from=${encodeURIComponent(new Date(`${from}T00:00:00.000Z`).toISOString())}&to=${encodeURIComponent(new Date(`${to}T23:59:59.999Z`).toISOString())}`); setData(result); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load reports.'); }
  }
  useEffect(() => { void load(); }, []);
  function exportCsv() {
    try {
      const start = new Date(`${from}T00:00:00.000Z`).toISOString();
      const end = new Date(`${to}T23:59:59.999Z`).toISOString();
      window.open(`/api/management/reports/students.csv?from=${encodeURIComponent(start)}&to=${encodeURIComponent(end)}`, '_blank', 'noopener,noreferrer');
    } catch { setError('Choose a valid report date range before exporting.'); }
  }
  return <div className="management-page"><SectionTitle title="Reports" description="Review actual student and course activity for a selected period." />
    <div className="management-toolbar management-report-filter"><Field label="From"><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field><Field label="To"><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field><button className="button button--dark" onClick={() => void load()}>Apply dates</button><button className="button button--outline" onClick={exportCsv}>Export student CSV</button></div>
    <ErrorNote error={error} />
    <section className="management-panel"><h2>Student engagement</h2><DataTable rows={(data?.students as ManagementRow[] | undefined) ?? []} empty="No student reporting data is available." columns={[
      { key: 'full_name', label: 'Student' }, { key: 'email', label: 'Email' }, { key: 'roll_number', label: 'Roll number' }, { key: 'activity_count', label: 'Activity' }, { key: 'lessons_completed', label: 'Lessons completed' }, { key: 'total_xp', label: 'XP' },
    ]} /></section>
    <section className="management-panel"><h2>Course completion activity</h2><DataTable rows={(data?.courses as ManagementRow[] | undefined) ?? []} empty="No course activity is available." columns={[
      { key: 'title', label: 'Course' }, { key: 'subject', label: 'Subject' }, { key: 'enrolled', label: 'Enrolled' }, { key: 'lessons_completed', label: 'Lessons completed' },
    ]} /></section>
    <section className="management-panel"><h2>Activity by day</h2><DataTable rows={(data?.activity as ManagementRow[] | undefined) ?? []} empty="No learning activity is recorded for this period." columns={[
      { key: 'day', label: 'Day' }, { key: 'activity_type', label: 'Activity type' }, { key: 'count', label: 'Records' },
    ]} /></section>
  </div>;
}

function ManagementSection({ path, data, overview, refresh, setStudentId, onNavigate, studentId, onLoadError }: {
  path: string; data: ManagementRow[]; overview: Payload; refresh: () => void; studentId: string; setStudentId: (id: string) => void; onNavigate: (path: string) => void; onLoadError: (message: string) => void;
}) {
  const [courses, setCourses] = useState<ManagementRow[]>([]);
  useEffect(() => {
    if (['materials', 'live-classes', 'assignments', 'assessments', 'announcements'].includes(path)) {
      onLoadError('');
      managementApi.get<{ courses: ManagementRow[] }>('/courses').then((result) => setCourses(result.courses)).catch((reason: unknown) => {
        setCourses([]);
        onLoadError(reason instanceof Error ? reason.message : 'Could not load course options.');
      });
    }
  }, [onLoadError, path]);
  if (path === 'overview') return <OverviewSection data={overview} onNavigate={onNavigate} />;
  if (path === 'students') return <StudentsSection onProgress={(id) => { setStudentId(id); onNavigate('progress'); }} />;
  if (path === 'progress') return <ProgressSection studentId={studentId} onBack={() => onNavigate('students')} />;
  if (path === 'courses') return <CoursesSection data={data} refresh={refresh} />;
  if (path === 'materials') return <MaterialsSection data={data} courses={courses} refresh={refresh} />;
  if (path === 'live-classes') return <LiveClassesSection data={data} courses={courses} refresh={refresh} />;
  if (path === 'assignments') return <AssignmentsSection data={data} courses={courses} refresh={refresh} />;
  if (path === 'assessments') return <AssessmentsSection data={data} courses={courses} refresh={refresh} />;
  if (path === 'announcements') return <AnnouncementsSection data={data} courses={courses} refresh={refresh} />;
  if (path === 'reports') return <ReportsSection />;
  return <SectionTitle title="Not found" description="Choose a section from the management navigation." />;
}

export function ManagementPortalPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<ManagementUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [data, setData] = useState<ManagementRow[]>([]);
  const [overview, setOverview] = useState<Payload>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const path = location.pathname.split('/')[2] || 'overview';
  const title = useMemo(() => navigation.find((item) => item.path === path)?.label ?? 'Management portal', [path]);

  useEffect(() => {
    let active = true;
    managementApi.session().then(({ manager }) => { if (active) setUser(manager); })
      .catch((reason: unknown) => {
        if (active && (!(reason instanceof Error) || !/management sign-in is required|management session is invalid|management session has expired/i.test(reason.message))) {
          setSessionError(reason instanceof Error ? reason.message : 'Could not verify management session.');
        }
      })
      .finally(() => { if (active) setSessionLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user || !navigation.some((item) => item.path === path) || ['students', 'progress', 'reports'].includes(path)) return;
    let active = true;
    const endpointByPath: Record<string, string> = {
      overview: '/overview', courses: '/courses', materials: '/materials', 'live-classes': '/live-classes',
      assignments: '/assignments', assessments: '/assessments', announcements: '/announcements',
    };
    const keyByPath: Record<string, string> = {
      courses: 'courses', materials: 'materials', 'live-classes': 'liveClasses', assignments: 'assignments',
      assessments: 'assessments', announcements: 'announcements',
    };
    setLoading(true); setLoadError(''); setData([]);
    managementApi.get<Payload>(endpointByPath[path]).then((result) => {
      if (!active) return;
      if (path === 'overview') setOverview(result);
      else {
        const records = result[keyByPath[path]] as ManagementRow[];
        setData(Array.isArray(records) ? records : []);
      }
    }).catch((reason: unknown) => { if (active) setLoadError(reason instanceof Error ? reason.message : 'Could not load this section.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, refreshKey, user]);

  useEffect(() => {
    if (path !== 'login' && !navigation.some((item) => item.path === path)) {
      navigate(user ? '/management/overview' : '/management/login', { replace: true });
    }
  }, [navigate, path, user]);

  useEffect(() => {
    if (user && path === 'login') navigate('/management/overview', { replace: true });
  }, [navigate, path, user]);

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);
  async function signOut() {
    try {
      await managementApi.logout();
      setUser(null);
      navigate('/management/login', { replace: true });
    } catch (reason) {
      setSessionError(reason instanceof Error ? reason.message : 'Could not sign out.');
    }
  }
  function goTo(section: string) {
    navigate(`/management/${section}`);
    setMobileOpen(false);
  }

  if (sessionLoading) return <div className="management-loading management-loading--screen">Verifying management access…</div>;
  if (!user) return <><LoginScreen onLogin={(manager) => { setUser(manager); setSessionError(''); navigate('/management/overview', { replace: true }); }} />{sessionError && <div className="management-session-warning" role="status">{sessionError}</div>}</>;

  return <div className="app-shell management-shell">
    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
      <div className="sidebar__brand-row"><Brand /><button className="icon-button sidebar__close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <div className="workspace-switcher"><div className="workspace-switcher__avatar">{user.fullName.slice(0, 1).toUpperCase()}</div><div className="workspace-switcher__copy"><span className="workspace-switcher__label">WORKSPACE</span><strong>Management portal</strong></div></div>
      <Link to="/" className="portal-return-link"><ArrowLeft size={14} /> Back to Preppx home</Link>
      <nav className="sidebar__nav" aria-label="Management navigation"><span className="nav-caption">MANAGEMENT</span>
        {navigation.map((item) => { const Icon = item.icon; return <NavLink key={item.path} to={`/management/${item.path}`} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}><Icon size={17} /><span>{item.label}</span></NavLink>; })}
      </nav>
      <div className="sidebar__footer"><div className="sidebar-profile"><div className="avatar avatar--small">{user.fullName.slice(0, 1).toUpperCase()}</div><div className="sidebar-profile__copy"><strong>{user.fullName}</strong><span>{user.email}</span></div><button className="icon-button sidebar-profile__logout" onClick={() => void signOut()} title="Sign out" aria-label="Sign out"><LogOut size={15} /></button></div></div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="topbar__left"><button className="icon-button mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="breadcrumbs"><span>Management portal</span><span className="breadcrumbs__separator">/</span><strong>{title}</strong></div></div><div className="topbar__actions"><ThemeToggle /><button className="management-text-action" onClick={() => void signOut()}>Sign out</button></div></header>
      <div className="page-content"><ErrorNote error={loadError} />{loading ? <div className="management-loading">Loading {title.toLowerCase()}…</div> : <ManagementSection path={path} data={path === 'progress' ? [] : data} overview={overview} refresh={refresh} studentId={selectedStudentId} setStudentId={setSelectedStudentId} onLoadError={setLoadError} onNavigate={(section) => goTo(section)} />}</div>
      <footer className="app-footer"><span>© {new Date().getFullYear()} Preppx</span><span>Management workspace</span></footer>
    </main>
  </div>;
}
