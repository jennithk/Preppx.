import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  BookOpen,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  GraduationCap,
  Target,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { studentService } from '../../../services/studentService';
import type { StudentDashboardData } from '../../../types/student';
import { studentModules } from '../../../app/studentModules';
import { LevelProgressCard } from '../../../components/gamification/LevelProgressCard';

const statIcons = [Code2, BrainCircuit, ClipboardCheck, ClipboardCheck];
const quickActionIcons = { code: Code2, brain: BrainCircuit, test: ClipboardCheck, calendar: CalendarDays };

function getWeeklyActivity(activity: StudentDashboardData['activity']) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const count = activity.filter((item) => {
      const occurredAt = new Date(item.occurred_at);
      return `${occurredAt.getFullYear()}-${occurredAt.getMonth()}-${occurredAt.getDate()}` === key;
    }).length;
    return { label: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date), count, today: index === 6 };
  });
  const max = Math.max(1, ...days.map((day) => day.count));
  return days.map((day) => ({ ...day, height: day.count === 0 ? 3 : Math.max(8, (day.count / max) * 100) }));
}

function activityLabel(type: string) {
  return type.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value));
}

export function StudentDashboardPage() {
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    studentService.getDashboard()
      .then((result) => { if (active) setData(result); })
      .catch(() => { if (active) setError('We could not load your account overview. Please refresh and try again.'); });
    return () => { active = false; };
  }, []);

  if (error) return <div className="state-card state-card--error" role="alert">{error}</div>;
  if (!data) return <div className="loading-state"><span className="loading-spinner" />Loading your account…</div>;
  const weeklyActivity = getWeeklyActivity(data.activity);

  return (
    <div className="dashboard-page">
      <section className="welcome-row">
        <div>
          <div className="eyebrow"><span className="eyebrow__line" /> YOUR LEARNING SPACE</div>
          <h1>{data.greeting}, <span>{data.displayName}.</span></h1>
          <p>Your learning activity, published resources and student updates in one place.</p>
        </div>
        <Link className="button button--outline" to="/student/profile">My account <ArrowUpRight size={15} /></Link>
      </section>

      <LevelProgressCard compact />

      <section className="hero-panel">
        <div className="hero-panel__content">
          <span className="hero-kicker"><GraduationCap size={14} /> YOUR STUDENT SPACE</span>
          <h2>Learn at<br />your pace.</h2>
          <p>Pick up a course, review due work or check your upcoming sessions.</p>
          <Link to="/student/profile" className="button button--light">Review my account <ArrowRight size={16} /></Link>
        </div>
        <div className="hero-panel__art" aria-hidden="true">
          <div className="orbit orbit--one" /><div className="orbit orbit--two" /><div className="orbit orbit--three" />
          <div className="hero-panel__monogram">P<span>.</span></div>
          <div className="floating-chip floating-chip--top"><Code2 size={14} /> Learning</div>
          <div className="floating-chip floating-chip--bottom"><Target size={14} /> Progress</div>
        </div>
        <div className="hero-panel__index">PREPPX <span>STUDENT</span></div>
      </section>

      <section className="stats-grid" aria-label="Your learning statistics">
        {data.stats.map((stat, index) => {
          const Icon = statIcons[index] ?? CheckCircle2;
          return (
            <article className="stat-card" key={stat.label}>
              <div className="stat-card__top"><span>{stat.label}</span><span className="stat-card__icon"><Icon size={17} /></span></div>
              <div className="stat-card__value">{stat.value}</div>
              <div className="stat-card__bottom"><span>{stat.helper}</span></div>
            </article>
          );
        })}
      </section>

      <section className="dashboard-insights">
        <article className="insight-card activity-card">
          <div className="section-heading">
            <div><span className="section-kicker">YOUR CONSISTENCY</span><h2>Weekly activity</h2></div>
            <span className="section-caption">Last 7 days</span>
          </div>
          {data.activity.length === 0 ? <div className="empty-inline">No learning activity has been recorded in the last seven days.</div> : <>
            <div className="activity-chart" aria-label="Learning activity over the last seven days">
              {weeklyActivity.map((day) => <div className={`activity-chart__day ${day.today ? 'activity-chart__day--today' : ''}`} key={day.label}>
                <span className="activity-chart__value">{day.count || ''}</span>
                <span className="activity-chart__track"><span style={{ height: `${day.height}%` }} /></span>
                <span className="activity-chart__label">{day.label}</span>
              </div>)}
            </div>
            <div className="activity-card__footer"><span><span className="activity-legend-dot" />Recorded learning actions</span><span>{data.activity.length} recent records</span></div>
          </>}
        </article>
        <article className="insight-card goal-card">
          <div className="section-heading">
            <div><span className="section-kicker">YOUR COURSEWORK</span><h2>Assignments</h2></div>
            <span className="goal-card__icon"><ClipboardCheck size={17} /></span>
          </div>
          {data.assignments.length === 0 ? <div className="empty-inline">No published assignments are available.</div> :
            <div className="dashboard-data-list">{data.assignments.slice(0, 4).map((assignment) => <div className="dashboard-data-list__item" key={assignment.id}>
              <span><strong>{assignment.title}</strong><small>{assignment.subject} · {assignment.due_at ? `Due ${formatShortDate(assignment.due_at)}` : 'No due date'}</small></span>
              <span className="dashboard-status">{assignment.student_status === 'overdue' ? 'Overdue' : assignment.student_status === 'pending' ? 'To do' : assignment.student_status === 'reviewed' ? 'Reviewed' : 'Submitted'}</span>
            </div>)}</div>}
          <Link className="button button--outline goal-card__action" to="/student/assignments">View assignments <ArrowRight size={14} /></Link>
        </article>
      </section>

      <div className="dashboard-columns">
        <section className="content-section continue-section">
          <div className="section-heading">
            <div><span className="section-kicker">YOUR LEARNING</span><h2>Continue learning</h2></div>
            <Link className="icon-link" to="/student/courses" aria-label="Browse all courses"><ArrowRight size={17} /></Link>
          </div>
          {data.courses.length === 0 ? <div className="empty-inline">No published courses are available right now.</div> :
            <div className="dashboard-course-list">{data.courses.slice(0, 3).map((course, index) => {
              const percent = course.lesson_count ? Math.round((course.completed_lessons / course.lesson_count) * 100) : 0;
              return <Link className="learning-card" to="/student/courses" key={course.id}>
                <span className={`learning-card__symbol learning-card__symbol--${(index % 3) + 1}`}><BookOpen size={18} /></span>
                <span className="learning-card__main">
                  <span className="learning-card__meta"><span>{course.subject}</span><span>{course.enrolled ? `${percent}% complete` : 'Available'}</span></span>
                  <h3>{course.title}</h3>
                  <span className="learning-card__lessons">{course.enrolled ? `${course.completed_lessons} of ${course.lesson_count} lessons completed` : `${course.lesson_count} lessons`}</span>
                </span>
                <ArrowUpRight size={15} className="learning-card__more" />
              </Link>;
            })}</div>}
        </section>

        <section className="content-section sessions-section">
          <div className="section-heading">
            <div><span className="section-kicker">YOUR SCHEDULE</span><h2>Upcoming sessions</h2></div>
            <Link className="icon-link" to="/student/sessions" aria-label="View all sessions"><ArrowRight size={17} /></Link>
          </div>
          {data.liveClasses.length === 0 ? <div className="empty-inline">No upcoming live classes are scheduled.</div> :
            <div className="dashboard-session-list">{data.liveClasses.filter((item) => item.session_status !== 'completed').slice(0, 3).map((session) => <article className="session-item" key={session.id}>
              <span className="session-item__date"><span>{new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(session.starts_at)).toUpperCase()}</span><strong>{new Date(session.starts_at).getDate()}</strong></span>
              <span className="session-item__main"><span className="session-item__topic">{session.subject} · {session.instructor}</span><strong className="session-item__title">{session.title}</strong><span className="session-item__time">{new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(session.starts_at))}</span></span>
            </article>)}</div>}
        </section>
      </div>

      <section className="content-section quick-actions-section">
        <div className="section-heading"><div><span className="section-kicker">STUDENT MODULES</span><h2>Open a learning space</h2></div><span className="section-caption">Your available sections</span></div>
        <div className="quick-actions-grid">
          {data.quickActions.map((action) => {
            const Icon = quickActionIcons[action.icon];
            return <Link className="quick-action-card" to={action.route} key={action.label}><span className="quick-action-card__icon"><Icon size={18} /></span><span className="quick-action-card__copy"><strong>{action.label}</strong><small>{action.description}</small></span><ArrowUpRight size={15} className="quick-action-card__arrow" /></Link>;
          })}
        </div>
      </section>

      <section className="content-section all-modules-section">
        <div className="section-heading"><div><span className="section-kicker">PREPPX STUDENT PORTAL</span><h2>All student spaces</h2></div><span className="section-caption">Available sections</span></div>
        <div className="all-modules-grid">
          {studentModules.map((item) => {
            const Icon = item.icon;
            return <Link className="module-launch-card" to={`/student/${item.path}`} key={item.path}>
              <span className="module-launch-card__icon"><Icon size={17} /></span>
              <span className="module-launch-card__copy"><strong>{item.label}</strong><small>{item.description}</small></span>
              <ArrowUpRight size={14} className="module-launch-card__arrow" />
            </Link>;
          })}
        </div>
      </section>

      <section className="content-section recent-activity-section">
        <div className="section-heading"><div><span className="section-kicker">YOUR LATEST STEPS</span><h2>Recent activity</h2></div><span className="section-caption">Your account activity</span></div>
        {data.activity.length === 0 ? <div className="empty-inline">No learning activity has been recorded yet.</div> :
          <div className="recent-activity-list">{data.activity.slice(0, 5).map((item, index) => <article className="recent-activity-item" key={`${item.occurred_at}-${item.activity_type}-${index}`}>
            <span className="recent-activity-item__icon"><CheckCircle2 size={16} /></span>
            <span className="recent-activity-item__copy"><strong>{activityLabel(item.activity_type)}</strong><small>{item.subject || 'Learning activity'}</small></span>
            <span className="recent-activity-item__time">{formatShortDate(item.occurred_at)}</span>
          </article>)}</div>}
      </section>

      <section className="content-section recent-activity-section">
        <div className="section-heading"><div><span className="section-kicker">STUDENT UPDATES</span><h2>Announcements</h2></div><Link className="icon-link" to="/student/notifications" aria-label="View all announcements"><ArrowRight size={17} /></Link></div>
        {data.announcements.length === 0 ? <div className="empty-inline">No published announcements for you.</div> :
          <div className="recent-activity-list">{data.announcements.slice(0, 3).map((announcement) => <article className="recent-activity-item" key={announcement.id}>
            <span className="recent-activity-item__icon"><Bell size={16} /></span>
            <span className="recent-activity-item__copy"><strong>{announcement.title}</strong><small>{announcement.course_title || 'All students'} · {announcement.message}</small></span>
            <span className="recent-activity-item__time">{formatShortDate(announcement.created_at)}</span>
          </article>)}</div>}
      </section>

      <section className="bottom-note">
        <div className="bottom-note__icon"><GraduationCap size={19} /></div>
        <div><strong>Your space. Your pace.</strong><span>Content and progress will update as learning activities are assigned and completed.</span></div>
        <span className="bottom-note__tag">PREPPX STUDENT</span>
      </section>
    </div>
  );
}
