import { useEffect, useState, type CSSProperties } from 'react';
import { Check, Sparkles, Trophy, X } from 'lucide-react';
import type { LevelUpEvent, XpAwardEvent } from '../../features/student/services/learningService';

export function GamificationEffects() {
  const [levelUp, setLevelUp] = useState<LevelUpEvent | null>(null);
  const [xpToast, setXpToast] = useState<XpAwardEvent | null>(null);

  useEffect(() => {
    let toastTimer: number | undefined;
    const onXpAwarded = (event: Event) => {
      const detail = (event as CustomEvent<XpAwardEvent>).detail;
      setXpToast(detail);
      if (toastTimer !== undefined) window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => setXpToast(null), 3400);
    };
    const onLevelUp = (event: Event) => {
      const detail = (event as CustomEvent<LevelUpEvent>).detail;
      if (toastTimer !== undefined) window.clearTimeout(toastTimer);
      setXpToast(null);
      setLevelUp(detail);
    };
    window.addEventListener('preppx:xp-awarded', onXpAwarded);
    window.addEventListener('preppx:level-up', onLevelUp);
    return () => {
      if (toastTimer !== undefined) window.clearTimeout(toastTimer);
      window.removeEventListener('preppx:xp-awarded', onXpAwarded);
      window.removeEventListener('preppx:level-up', onLevelUp);
    };
  }, []);

  useEffect(() => {
    if (!levelUp) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLevelUp(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [levelUp]);

  useEffect(() => {
    if (!levelUp) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [levelUp]);

  return (
    <>
      {xpToast && !levelUp && (
        <div className="xp-toast" role="status" aria-live="polite">
          <span className="xp-toast__icon"><Sparkles size={16} /></span>
          <span><strong>+{xpToast.points} XP</strong><small>{xpToast.reason}</small></span>
          <Check size={15} className="xp-toast__check" />
        </div>
      )}

      {levelUp && (
        <div className="level-up-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLevelUp(null); }}>
          <section className="level-up-dialog" role="dialog" aria-modal="true" aria-labelledby="level-up-title" aria-describedby="level-up-description">
            <button className="level-up-dialog__close icon-button" type="button" onClick={() => setLevelUp(null)} aria-label="Close level-up celebration"><X size={17} /></button>
            <div className="level-up-particles" aria-hidden="true">
              {Array.from({ length: 24 }, (_, index) => <i key={index} style={{ '--particle-index': index, '--particle-angle': `${index * 15}deg`, '--particle-delay': `${160 + index * 17}ms` } as CSSProperties & { '--particle-index': number; '--particle-angle': string; '--particle-delay': string }} />)}
            </div>
            <div className="level-up-dialog__medal"><Trophy size={31} /></div>
            <span className="level-up-dialog__eyebrow"><Sparkles size={13} /> NEW MILESTONE UNLOCKED</span>
            <h2 id="level-up-title">Level up!</h2>
            <p id="level-up-description">Your effort is adding up. Keep that momentum going.</p>
            <div className="level-up-dialog__level">
              <span>LEVEL</span>
              <strong>{levelUp.currentLevel}</strong>
              <small>{levelUp.levelName}</small>
            </div>
            <div className="level-up-dialog__reward"><Sparkles size={15} /> +{levelUp.xpGained} XP · {levelUp.reason}</div>
            <button className="button button--dark level-up-dialog__continue" type="button" autoFocus onClick={() => setLevelUp(null)}>Continue learning <Check size={15} /></button>
          </section>
        </div>
      )}
    </>
  );
}
