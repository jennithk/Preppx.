import { useEffect, useState } from 'react';
import { ArrowUpRight, Sparkles, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { GamificationStats } from '../../features/student/services/learningService';
import { studentApi } from '../../features/student/services/studentApi';

export function LevelProgressCard({ compact = false }: { compact?: boolean }) {
  const [loadError, setLoadError] = useState('');
  const [stats, setStats] = useState<GamificationStats>(() => ({
    totalXp: 0, level: 1, levelName: 'Starter', currentLevelXp: 0, nextLevelXp: 100,
    nextLevelName: 'Explorer', xpWithinLevel: 0, xpToNextLevel: 100, progressPercent: 0, recentAwards: [],
  }));

  useEffect(() => {
    let active = true;
    const refresh = () => {
      studentApi<{ totalXp: number; level: number; levelName: string; xpAwards: { id: string; points: number; reason: string; created_at: string }[] }>('/progress')
        .then((progress) => {
          if (!active) return;
          setLoadError('');
          const levels = [
            { level: 1, name: 'Starter', xp: 0 }, { level: 2, name: 'Explorer', xp: 100 },
            { level: 3, name: 'Learner', xp: 250 }, { level: 4, name: 'Builder', xp: 450 },
            { level: 5, name: 'Achiever', xp: 700 }, { level: 6, name: 'Specialist', xp: 1000 },
            { level: 7, name: 'Expert', xp: 1400 }, { level: 8, name: 'Master', xp: 1900 },
            { level: 9, name: 'Champion', xp: 2500 }, { level: 10, name: 'Legend', xp: 3200 },
          ];
          const current = levels.find((item) => item.level === progress.level) ?? levels[0];
          const next = levels.find((item) => item.xp > progress.totalXp) ?? null;
          const within = Math.max(0, progress.totalXp - current.xp);
          setStats({
            totalXp: progress.totalXp, level: current.level, levelName: progress.levelName,
            currentLevelXp: current.xp, nextLevelXp: next?.xp ?? null, nextLevelName: next?.name ?? null,
            xpWithinLevel: within, xpToNextLevel: next ? Math.max(0, next.xp - progress.totalXp) : 0,
            progressPercent: next ? Math.min(100, Math.round((within / (next.xp - current.xp)) * 100)) : 100,
            recentAwards: progress.xpAwards.map((award) => ({ id: award.id, points: award.points, reason: award.reason, createdAt: award.created_at })),
          });
        })
        .catch((error: unknown) => {
          if (active) setLoadError(error instanceof Error ? error.message : 'Learning XP could not be loaded.');
        });
    };
    refresh();
    window.addEventListener('preppx:xp-updated', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      window.removeEventListener('preppx:xp-updated', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  return (
    <section className={`level-progress-card${compact ? ' level-progress-card--compact' : ''}`} aria-label="Your learning level">
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      <div className="level-progress-card__identity">
        <span className="level-progress-card__emblem"><Trophy size={compact ? 17 : 20} /></span>
        <div>
          <span className="level-progress-card__eyebrow">YOUR LEARNING RANK</span>
          <h2>Level {stats.level} <span>· {stats.levelName}</span></h2>
          <p>{stats.totalXp.toLocaleString()} XP earned through your learning activity</p>
        </div>
      </div>
      <div className="level-progress-card__progress">
        <div className="level-progress-card__labels">
          <strong>{stats.nextLevelName ? `${stats.xpToNextLevel.toLocaleString()} XP to Level ${stats.level + 1}` : 'Highest level reached'}</strong>
          <span>{stats.progressPercent}%</span>
        </div>
        <div className="level-progress-card__track" role="progressbar" aria-label="Progress to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.progressPercent}>
          <span style={{ width: `${stats.progressPercent}%` }} />
        </div>
        <small>{stats.nextLevelName ? `${stats.xpWithinLevel.toLocaleString()} / ${(stats.nextLevelXp! - stats.currentLevelXp).toLocaleString()} XP in this level` : 'Keep learning and maintaining your progress.'}</small>
      </div>
      {!compact && (
        <div className="level-progress-card__history">
          <div className="level-progress-card__history-heading"><strong>Recent XP awards</strong><span>Latest learning milestones</span></div>
          {stats.recentAwards.length ? (
            <ul>
              {stats.recentAwards.slice(0, 4).map((award) => (
                <li key={award.id}><span>{award.reason}</span><strong>+{award.points} XP</strong></li>
              ))}
            </ul>
          ) : <p>XP will appear here when you complete assigned learning activities.</p>}
          <Link to="/student/dashboard" className="level-progress-card__link">Back to overview <ArrowUpRight size={14} /></Link>
        </div>
      )}
      {compact && <span className="level-progress-card__sparkle" aria-hidden="true"><Sparkles size={15} /></span>}
    </section>
  );
}
