import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, ArrowUpRight, BookOpenCheck, BrainCircuit, Check, Code2, GraduationCap, Play, Sparkles, Target } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Brand } from '../../../components/common/Brand';
import { ThemeToggle } from '../../../components/ui/ThemeToggle';

const highlights = [
  { icon: Code2, title: 'Coding practice', description: 'Build problem-solving habits one challenge at a time.' },
  { icon: BrainCircuit, title: 'Aptitude & reasoning', description: 'Strengthen the skills that help you think clearly.' },
  { icon: BookOpenCheck, title: 'Learning resources', description: 'Revisit recordings and stay close to your classes.' },
  { icon: Target, title: 'Test preparation', description: 'Check your understanding and see where to improve.' },
];

const learningLevels = [
  { title: 'Build your foundation', description: 'Understand the fundamentals and develop a strong learning foundation.' },
  { title: 'Develop your skills', description: 'Build practical knowledge through coding, aptitude and logical reasoning.' },
  { title: 'Practice & apply', description: 'Strengthen your understanding through exercises, problem-solving and assessments.' },
  { title: 'Track your progress', description: 'Understand your improvements, identify weak areas and continue learning.' },
  { title: 'Become industry ready', description: 'Apply your knowledge and build confidence for real-world challenges.' },
];

type IntroPhase = 'reveal' | 'travel' | 'done';

type LandingPageProps = {
  playIntro: boolean;
  onIntroStarted: () => void;
};

export function LandingPage({ playIntro, onIntroStarted }: LandingPageProps) {
  const [introPhase, setIntroPhase] = useState<IntroPhase>(() => (
    playIntro && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reveal' : 'done'
  ));
  const introStartedRef = useRef(false);
  const [motionReady, setMotionReady] = useState(false);
  const [activeLevel, setActiveLevel] = useState(0);
  const [revealedLevels, setRevealedLevels] = useState<Set<number>>(() => new Set());
  const pageRef = useRef<HTMLElement>(null);
  const headerLogoRef = useRef<HTMLAnchorElement>(null);
  const introBrandRef = useRef<HTMLDivElement>(null);
  const introBackdropRef = useRef<HTMLDivElement>(null);
  const introSkipRef = useRef<HTMLButtonElement>(null);
  const levelProgress = activeLevel / (learningLevels.length - 1);

  useEffect(() => {
    if (introPhase !== 'reveal') return;
    if (!introStartedRef.current) {
      introStartedRef.current = true;
      onIntroStarted();
    }
    const timer = window.setTimeout(() => setIntroPhase('travel'), 520);
    return () => window.clearTimeout(timer);
  }, [introPhase, onIntroStarted]);

  useEffect(() => {
    if (introPhase !== 'travel') return;
    const brand = introBrandRef.current;
    const target = headerLogoRef.current;
    const backdrop = introBackdropRef.current;
    const skip = introSkipRef.current;
    if (!brand || !target || !backdrop || !skip) {
      setIntroPhase('done');
      return;
    }

    const brandRect = brand.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const deltaX = targetRect.left + targetRect.width / 2 - (brandRect.left + brandRect.width / 2);
    const deltaY = targetRect.top + targetRect.height / 2 - (brandRect.top + brandRect.height / 2);
    const targetScale = Math.min(1, targetRect.width / brandRect.width);
    const duration = 1420;
    const brandAnimation = brand.animate([
      { transform: 'translate(-50%, -50%) translate3d(0, 0, 0) scale(1)', opacity: 1 },
      { transform: `translate(-50%, -50%) translate3d(${deltaX}px, ${deltaY}px, 0) scale(${targetScale})`, opacity: 1 },
    ], { duration, easing: 'cubic-bezier(.2,.72,.24,1)', fill: 'forwards' });
    const backdropAnimation = backdrop.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration, easing: 'cubic-bezier(.2,.72,.24,1)', fill: 'forwards' },
    );
    const skipAnimation = skip.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: Math.min(duration, 650), delay: 500, easing: 'ease', fill: 'forwards' },
    );
    brandAnimation.onfinish = () => setIntroPhase('done');
    return () => {
      brandAnimation.cancel();
      backdropAnimation.cancel();
      skipAnimation.cancel();
    };
  }, [introPhase]);

  useEffect(() => {
    const page = pageRef.current;
    if (!page || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });
    page.querySelectorAll<HTMLElement>('[data-landing-reveal]:not([data-level-index])').forEach((element) => revealObserver.observe(element));
    setMotionReady(true);

    const levelElements = page.querySelectorAll('[data-level-index]');
    const levelStates = new Map<Element, boolean>();
    let levelObserver: IntersectionObserver;
    function observeLevels() {
      levelObserver?.disconnect();
      levelStates.clear();
      const topInset = Math.round(window.innerHeight * 0.32);
      const bottomInset = Math.round(window.innerHeight * 0.42);
      levelObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          levelStates.set(entry.target, entry.isIntersecting);
          if (entry.isIntersecting) {
            const index = Number((entry.target as HTMLElement).dataset.levelIndex);
            setRevealedLevels((current) => current.has(index) ? current : new Set(current).add(index));
          }
        });
        const focusLine = window.innerHeight * 0.45;
        const focused = [...levelStates.entries()]
          .filter(([, isIntersecting]) => isIntersecting)
          .map(([element]) => {
            const rect = element.getBoundingClientRect();
            return {
              index: Number((element as HTMLElement).dataset.levelIndex),
              distance: Math.abs(rect.top + rect.height / 2 - focusLine),
            };
          })
          .sort((left, right) => left.distance - right.distance)[0];
        if (focused) setActiveLevel(focused.index);
      }, { threshold: 0.1, rootMargin: `-${topInset}px 0px -${bottomInset}px 0px` });
      levelElements.forEach((element) => levelObserver.observe(element));
    }
    observeLevels();
    window.addEventListener('resize', observeLevels);

    return () => {
      revealObserver.disconnect();
      levelObserver.disconnect();
      window.removeEventListener('resize', observeLevels);
    };
  }, []);

  useEffect(() => {
    if (introPhase === 'done') return;
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setIntroPhase('done');
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [introPhase]);

  function skipIntro() {
    setIntroPhase('done');
  }

  return (
    <main ref={pageRef} className={`landing-page${introPhase !== 'done' ? ' landing-page--intro' : ''}${motionReady ? ' landing-motion-ready' : ''}`}>
      {introPhase !== 'done' && createPortal(
        <div className={`landing-intro landing-intro--${introPhase}`} role="presentation">
          <div ref={introBackdropRef} className="landing-intro__backdrop" />
          <div ref={introBrandRef} className="landing-intro__brand"><Brand /></div>
          <button ref={introSkipRef} type="button" className="landing-intro__skip" onClick={skipIntro}>Skip intro <span>Esc</span></button>
        </div>,
        document.body,
      )}
      <header className="landing-header">
        <Link ref={headerLogoRef} to="/" aria-label="Preppx home"><Brand /></Link>
        <nav className="landing-nav" aria-label="Main navigation" data-landing-reveal style={{ '--reveal-order': 0 } as CSSProperties}>
          <a href="#features">What you can do</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <div className="landing-header__actions"><ThemeToggle /><Link to="/login" className="landing-login">Log in</Link><Link to="/student/register" className="button button--dark">Get started <ArrowUpRight size={15} /></Link></div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero__copy" data-landing-reveal style={{ '--reveal-order': 0 } as CSSProperties}>
          <span className="landing-eyebrow"><Sparkles size={14} /> YOUR LEARNING SPACE, REIMAGINED</span>
          <h1>Prepare with<br /><span>purpose.</span> Progress<br />with confidence.</h1>
          <p>One place to practise coding, sharpen your aptitude, revisit classes and stay on top of your learning journey.</p>
          <div className="landing-hero__actions"><Link to="/student/register" className="button button--dark button--large">Create your account <ArrowRight size={17} /></Link><Link to="/login" className="landing-secondary-link">I already have an account <ArrowUpRight size={15} /></Link></div>
          <div className="landing-proof"><span>Learn. Practise. Prepare. Progress.</span></div>
        </div>
        <div className="landing-hero__visual" aria-label="Preppx student learning areas" data-landing-reveal style={{ '--reveal-order': 1 } as CSSProperties}>
          <div className="landing-orbit landing-orbit--outer" /><div className="landing-orbit landing-orbit--inner" />
          <div className="preview-window">
            <div className="preview-window__top"><div className="preview-dots"><i /><i /><i /></div><span>PREPPX STUDENT PORTAL</span><span className="preview-window__avatar">P</span></div>
            <div className="preview-welcome"><span>ONE LEARNING SPACE</span><h3>Learning, organised.</h3><p>Your assigned resources, practice and sessions in one place.</p></div>
            <div className="preview-track">
              <div className="preview-track__head"><span>LEARNING AREAS</span><span>STUDENT SPACE</span></div>
              <div className="preview-track__item"><b className="preview-track__icon"><Code2 size={17} /></b><div><strong>Coding practice</strong><span>Programming challenges assigned to you</span></div><ArrowRight size={15} /></div>
              <div className="preview-track__item"><b className="preview-track__icon"><BrainCircuit size={17} /></b><div><strong>Aptitude & reasoning</strong><span>Practice questions and assessments</span></div><ArrowRight size={15} /></div>
              <div className="preview-track__item"><b className="preview-track__icon"><GraduationCap size={17} /></b><div><strong>Sessions & resources</strong><span>Your classes and learning materials</span></div><ArrowRight size={15} /></div>
            </div>
          </div>
          <div className="floating-note floating-note--top"><span><Check size={14} /></span><div><strong>Your account</strong><small>Details you provide</small></div></div>
          <div className="floating-note floating-note--bottom"><span><GraduationCap size={16} /></span><div><strong>Your next step</strong><small>Learn at your pace</small></div></div>
        </div>
        <div className="landing-hero__watermark">P.</div>
      </section>

      <section className="landing-feature-strip" id="features">
        <div className="landing-section-intro" data-landing-reveal style={{ '--reveal-order': 0 } as CSSProperties}><span className="section-kicker">BUILT AROUND YOUR GROWTH</span><h2>Everything you need<br />to move forward.</h2><p>Learning tools and resources, thoughtfully brought together.</p></div>
        <div className="landing-feature-grid">{highlights.map(({ icon: Icon, title, description }, index) => <article className="landing-feature" data-landing-reveal key={title} style={{ '--reveal-order': index } as CSSProperties}><div className="landing-feature__top"><span className="landing-feature__icon"><Icon size={19} /></span><span>0{index + 1}</span></div><h3>{title}</h3><p>{description}</p><ArrowUpRight size={16} className="landing-feature__arrow" /></article>)}</div>
      </section>

      <section className="landing-learning-journey" aria-labelledby="landing-journey-title">
        <div className="landing-journey-heading" data-landing-reveal>
          <span className="section-kicker">WHAT YOU’LL GAIN</span>
          <h2 id="landing-journey-title">A clear path from curiosity to capability.</h2>
          <p>Each step builds on the last—helping you turn practice into lasting confidence.</p>
        </div>
        <div className="landing-level-layout">
          <aside className="landing-level-rail" aria-label="Five levels of learning progression">
            <div className="landing-level-rail__sticky">
              <span className="landing-level-rail__eyebrow">YOUR PROGRESSION</span>
              <div className="landing-level-rail__path" style={{ '--level-progress': levelProgress, '--level-progress-percent': `${levelProgress * 100}%` } as CSSProperties}>
                <span className="landing-level-rail__track" aria-hidden="true" />
                <span className="landing-level-rail__fill" aria-hidden="true" />
                {learningLevels.map((level, index) => (
                  <a
                    className={`landing-level-rail__node${index === activeLevel ? ' is-active' : ''}${index < activeLevel ? ' is-complete' : ''}`}
                    href={`#landing-level-${index + 1}`}
                    key={level.title}
                    aria-label={`Level ${String(index + 1).padStart(2, '0')}: ${level.title}`}
                    aria-current={index === activeLevel ? 'step' : undefined}
                  >
                    {index < activeLevel ? <Check size={14} /> : <span>{String(index + 1).padStart(2, '0')}</span>}
                  </a>
                ))}
              </div>
              <span className="landing-level-rail__caption">A foundation for what comes next.</span>
            </div>
          </aside>
          <ol className="landing-level-list" style={{ '--level-progress': levelProgress, '--level-progress-percent': `${levelProgress * 100}%` } as CSSProperties}>
            {learningLevels.map((level, index) => {
              const status = index === activeLevel ? 'current' : index < activeLevel ? 'complete' : 'upcoming';
              return (
                <li
                  id={`landing-level-${index + 1}`}
                  key={level.title}
                  className={`landing-level landing-level--${status}${revealedLevels.has(index) ? ' is-visible' : ''}`}
                  data-level-index={index}
                  data-landing-reveal
                  style={{ '--reveal-order': index } as CSSProperties}
                >
                  <div className="landing-level__card">
                    <span className="landing-level__meta">LEVEL {String(index + 1).padStart(2, '0')}<span>{status === 'complete' ? 'FOUNDATION SET' : status === 'current' ? 'IN FOCUS' : 'UP NEXT'}</span></span>
                    <h3>{level.title}</h3>
                    <p>{level.description}</p>
                    <span className="landing-level__indicator" aria-hidden="true">{status === 'complete' ? <Check size={15} /> : <ArrowRight size={15} />}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="landing-bottom-cta" id="how-it-works" data-landing-reveal><div><span className="section-kicker">YOUR NEXT CHAPTER STARTS HERE</span><h2>Show up curious.<br /><span>Leave more capable.</span></h2><p>Create your student account and bring your learning journey into focus.</p></div><Link to="/student/register" className="button button--light button--large">Get started with Preppx <ArrowRight size={17} /></Link><Play className="landing-bottom-cta__mark" size={120} /></section>
      <footer className="landing-footer" data-landing-reveal><Brand compact /><span>© {new Date().getFullYear()} Preppx. Learn with direction.</span><div className="landing-footer__links"><Link to="/login">Account sign in <ArrowUpRight size={13} /></Link></div></footer>
    </main>
  );
}
