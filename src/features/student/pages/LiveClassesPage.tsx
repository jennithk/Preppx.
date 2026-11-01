import { useEffect, useState } from 'react';
import { ExternalLink, Radio } from 'lucide-react';
import { studentApi } from '../services/studentApi';

type LiveClass = {
  id: string;
  title: string;
  description: string;
  subject: string;
  instructor: string;
  starts_at: string;
  ends_at: string;
  meeting_url: string | null;
  course_title: string | null;
  session_status: 'scheduled' | 'live' | 'completed';
};

export function LiveClassesPage() {
  const [items, setItems] = useState<LiveClass[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    studentApi<{ liveClasses: LiveClass[] }>('/live-classes')
      .then(({ liveClasses }) => { if (active) setItems(liveClasses); })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : 'Live classes could not be loaded.'); });
    return () => { active = false; };
  }, []);

  async function join(item: LiveClass) {
    setError('');
    try {
      const { meetingUrl } = await studentApi<{ meetingUrl: string }>(`/live-classes/${item.id}/join`, { method: 'POST', body: '{}' });
      window.open(meetingUrl, '_blank', 'noopener,noreferrer');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This live class is not available to join.');
    }
  }

  return <div className="feature-page">
    <div className="feature-heading"><div><div className="eyebrow"><span className="eyebrow__line" /> YOUR SCHEDULE</div><div className="feature-heading__title-row"><div className="feature-heading__icon"><Radio size={21} /></div><h1>Live classes</h1></div><p>Upcoming sessions linked to your published courses.</p></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {items.map((item) => <section className="feature-panel" key={item.id}><div className="feature-section-heading"><div><span className="section-kicker">{item.subject}{item.course_title ? ` · ${item.course_title}` : ''}</span><h2>{item.title}</h2></div><span className="feature-chip">{item.session_status}</span></div><p>{item.description}</p><div className="resource-meta"><span>{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.starts_at))}</span><span>{item.instructor}</span></div>{item.session_status === 'live' && item.meeting_url && <button className="button button--dark" onClick={() => void join(item)}>Join live class <ExternalLink size={14} /></button>}</section>)}
    {!items.length && !error && <section className="feature-panel"><div className="feature-empty"><Radio size={22} /><strong>No live classes scheduled</strong><span>Relevant scheduled classes will appear here.</span></div></section>}
  </div>;
}
