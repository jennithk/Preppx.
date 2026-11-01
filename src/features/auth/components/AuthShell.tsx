import type { ReactNode } from 'react';
import { ArrowUpRight, BookOpenCheck, CircleCheck, Code2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '../../../components/common/Brand';
import { ThemeToggle } from '../../../components/ui/ThemeToggle';

type AuthShellProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  footer?: ReactNode;
};

export function AuthShell({ children, eyebrow, title, description, footer }: AuthShellProps) {
  return (
    <main className="auth-shell">
      <section className="auth-showcase" aria-label="About Preppx">
        <div className="auth-showcase__top"><Brand /><span className="auth-showcase__tag">STUDENT PORTAL</span></div>
        <div className="auth-showcase__body">
          <span className="auth-showcase__eyebrow"><span /> A BETTER WAY TO PREPARE</span>
          <h1>Make progress<br />that <em>adds up.</em></h1>
          <p>A focused space for learning, practising and getting ready for what comes next.</p>
          <div className="auth-showcase__features">
            <div><span><Code2 size={16} /></span><strong>Practise with purpose</strong></div>
            <div><span><BookOpenCheck size={16} /></span><strong>Learn at your pace</strong></div>
            <div><span><CircleCheck size={16} /></span><strong>Track your progress</strong></div>
          </div>
        </div>
        <div className="auth-showcase__bottom"><span>LEARN WITH DIRECTION.</span><span>PREPPX <ArrowUpRight size={13} /></span></div>
        <div className="auth-showcase__orb auth-showcase__orb--one" />
        <div className="auth-showcase__orb auth-showcase__orb--two" />
      </section>

      <section className="auth-main">
        <div className="auth-main__top"><Link to="/" className="auth-back-link">← Back to home</Link><ThemeToggle /></div>
        <div className="auth-form-wrap">
          <div className="auth-heading"><span className="section-kicker">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>
          {children}
          {footer && <div className="auth-form-footer">{footer}</div>}
          <p className="auth-legal">By continuing, you agree to use Preppx responsibly. Email verification is required to activate your student account.</p>
        </div>
      </section>
    </main>
  );
}
