import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';

export function RequireStudent({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [status, setStatus] = useState<'loading' | 'ready' | 'unauthorized' | 'error'>('loading');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    authService.restoreServerSession()
      .then(() => { if (active) setStatus('ready'); })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof Error && 'status' in error && error.status === 401) {
          authService.clearClientSession();
          setStatus('unauthorized');
        } else {
          setStatus('error');
        }
      });
    return () => { active = false; };
  }, [retry]);

  if (status === 'loading') return <div className="loading-state"><span className="loading-spinner" />Verifying your student session…</div>;
  if (status === 'unauthorized') return <Navigate to="/student/login" replace state={{ from: location.pathname }} />;
  if (status === 'error') return <div className="state-card state-card--error" role="alert">We could not verify your session. Check your connection and <button className="auth-text-button" type="button" onClick={() => { setStatus('loading'); setRetry((value) => value + 1); }}>try again</button>.</div>;

  return children;
}
