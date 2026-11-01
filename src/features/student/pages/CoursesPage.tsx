import { useEffect, useState } from 'react';
import { ArrowDownToLine, BookOpen, CheckCircle2, Clock3, Play, RotateCw } from 'lucide-react';
import { orderCourseNodes } from '../../../../shared/courseNodes';
import { studentApi } from '../services/studentApi';

type Course = {
  id: string;
  title: string;
  description: string;
  subject: string;
  lesson_count: number;
  completed_lessons: number;
  enrolled: boolean;
};
type CourseNode = {
  id: string;
  parent_id: string | null;
  node_type: string;
  title: string;
  description: string;
  position: number;
  completed: boolean;
};
type Material = {
  id: string;
  node_id: string | null;
  title: string;
  description: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
};
type CourseDetail = { course: Course; nodes: CourseNode[]; materials: Material[] };

export function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selected, setSelected] = useState<CourseDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const orderedNodes = selected ? orderCourseNodes(selected.nodes) : [];

  async function loadCourses() {
    setError('');
    const result = await studentApi<{ courses: Course[] }>('/courses');
    setCourses(result.courses);
  }

  useEffect(() => {
    let active = true;
    studentApi<{ courses: Course[] }>('/courses')
      .then((result) => { if (active) setCourses(result.courses); })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : 'Courses could not be loaded.'); });
    return () => { active = false; };
  }, []);

  async function openCourse(courseId: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setSelected(await studentApi<CourseDetail>(`/courses/${courseId}`));
      await loadCourses();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Course details could not be loaded.');
    } finally {
      setBusy(false);
    }
  }

  async function startLesson(nodeId: string) {
    setBusy(true);
    setError('');
    try {
      await studentApi<void>(`/lessons/${nodeId}/start`, { method: 'POST', body: '{}' });
      setNotice('Lesson opened. You can mark it complete after studying.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Lesson could not be opened.');
    } finally {
      setBusy(false);
    }
  }

  async function completeLesson(nodeId: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const previous = await studentApi<{ totalXp: number; level: number; levelName: string }>('/progress');
      const result = await studentApi<{ awarded: boolean; totalXp: number }>(`/lessons/${nodeId}/complete`, { method: 'POST', body: '{}' });
      setNotice(result.awarded ? `Lesson completed. 15 XP earned · ${result.totalXp} XP total.` : `Lesson is already complete · ${result.totalXp} XP total.`);
      if (result.awarded) {
        window.dispatchEvent(new CustomEvent('preppx:xp-awarded', { detail: { id: `lesson:${nodeId}`, points: result.totalXp - previous.totalXp, reason: 'Lesson completed', createdAt: new Date().toISOString() } }));
        window.dispatchEvent(new CustomEvent('preppx:xp-updated'));
        const next = await studentApi<{ level: number; levelName: string }>('/progress');
        if (next.level > previous.level) {
          window.dispatchEvent(new CustomEvent('preppx:level-up', { detail: { previousLevel: previous.level, currentLevel: next.level, levelName: next.levelName, totalXp: result.totalXp, xpGained: result.totalXp - previous.totalXp, reason: 'Lesson completed' } }));
        }
      }
      if (selected) await openCourse(selected.course.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Lesson completion could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function openMaterial(material: Material) {
    setError('');
    try {
      const result = await studentApi<{ url: string; filename: string }>(`/materials/${material.id}/download`);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This material could not be opened.');
    }
  }

  if (error && !courses.length && !selected) {
    return <section className="state-card state-card--error" role="alert">{error}<button className="button button--outline" onClick={() => void loadCourses()}>Try again</button></section>;
  }

  return (
    <div className="feature-page">
      <div className="feature-heading"><div><div className="eyebrow"><span className="eyebrow__line" /> YOUR LEARNING</div><div className="feature-heading__title-row"><div className="feature-heading__icon"><BookOpen size={21} /></div><h1>Published courses</h1></div><p>Courses and lessons published by your learning team.</p></div><button className="button button--outline" onClick={() => void loadCourses()}><RotateCw size={15} /> Refresh</button></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-success" role="status">{notice}</p>}
      {selected && <section className="feature-panel">
        <div className="feature-section-heading"><div><span className="section-kicker">{selected.course.subject}</span><h2>{selected.course.title}</h2><p>{selected.course.description}</p></div><button className="button button--outline" onClick={() => setSelected(null)}>Back to courses</button></div>
        <div className="course-curriculum">
          {orderedNodes.map(({ node, depth }) => <article className="course-node" key={node.id} style={{ marginInlineStart: depth * 16 }}>
            <div className="course-node__heading"><span>{node.completed ? <CheckCircle2 size={17} /> : <BookOpen size={17} />}</span><div><strong>{node.title}</strong><small>{node.node_type}</small></div></div>
            {node.description && <p>{node.description}</p>}
            {node.node_type === 'lesson' && <div className="course-node__actions"><button className="button button--outline" disabled={busy} onClick={() => void startLesson(node.id)}><Play size={14} /> Open lesson</button><button className="button button--dark" disabled={busy || node.completed} onClick={() => void completeLesson(node.id)}>{node.completed ? 'Completed' : 'Mark complete'}</button></div>}
            {selected.materials.filter((material) => material.node_id === node.id).map((material) => <div className="course-material" key={material.id}><div><strong>{material.title}</strong><small>{material.original_filename} · {formatBytes(material.file_size)}</small></div><button className="icon-button" aria-label={`Open ${material.title}`} onClick={() => void openMaterial(material)}><ArrowDownToLine size={16} /></button></div>)}
          </article>)}
          {!selected.nodes.length && <div className="feature-empty"><BookOpen size={22} /><strong>No lessons published</strong><span>Course content will appear here when it is available.</span></div>}
          {selected.materials.filter((material) => material.node_id === null).map((material) => <div className="course-material" key={material.id}><div><strong>{material.title}</strong><small>{material.original_filename} · {formatBytes(material.file_size)}</small></div><button className="icon-button" aria-label={`Open ${material.title}`} onClick={() => void openMaterial(material)}><ArrowDownToLine size={16} /></button></div>)}
        </div>
      </section>}
      {!selected && <section className="course-catalogue">
        {courses.map((course) => <article className="feature-panel course-card" key={course.id}><div className="feature-overline">{course.subject}</div><h2>{course.title}</h2><p>{course.description}</p><div className="resource-meta"><span><BookOpen size={14} /> {course.completed_lessons}/{course.lesson_count} lessons completed</span><span><Clock3 size={14} /> {course.enrolled ? 'In progress' : 'Available'}</span></div><button className="button button--dark" disabled={busy} onClick={() => void openCourse(course.id)}>Open course</button></article>)}
        {!courses.length && <section className="feature-panel"><div className="feature-empty"><BookOpen size={22} /><strong>No courses published yet</strong><span>Published courses will appear here when your learning team makes them available.</span></div></section>}
      </section>}
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
