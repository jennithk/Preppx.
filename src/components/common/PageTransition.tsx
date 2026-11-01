import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/** Adds a consistent, reduced-motion-aware entrance when the active route changes. */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div key={location.pathname} className="route-transition">
      {children}
    </div>
  );
}
