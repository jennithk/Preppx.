import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, ChevronDown, LogOut, Menu, PanelLeftClose, X } from 'lucide-react';
import { Brand } from '../components/common/Brand';
import { PageTransition } from '../components/common/PageTransition';
import { GamificationEffects } from '../components/gamification/GamificationEffects';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { moduleGroups, studentModules } from '../app/studentModules';
import { authService } from '../features/auth/services/authService';

const routeTitles: Record<string, string> = {
  dashboard: 'Overview',
  assignments: 'Assignments',
  courses: 'Courses',
  journey: 'Learning journey',
  coding: 'Coding practice',
  aptitude: 'Aptitude & reasoning',
  assessments: 'Test papers',
  videos: 'Video library',
  recordings: 'Class recordings',
  'live-sessions': 'Live sessions',
  sessions: 'My sessions',
  notifications: 'Notifications',
  profile: 'My account',
  progress: 'Learning progress',
};

function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'S';
}

export function StudentLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const currentKey = location.pathname.split('/').filter(Boolean)[1] ?? 'dashboard';
  const currentTitle = routeTitles[currentKey] ?? 'Student portal';
  const [profile, setProfile] = useState(() => authService.getCurrentStudentProfile());
  const session = authService.getCurrentSession();
  const studentName = profile?.fullName || 'Student';

  useEffect(() => {
    const syncProfile = () => setProfile(authService.getCurrentStudentProfile());
    window.addEventListener('preppx:profile-updated', syncProfile);
    return () => window.removeEventListener('preppx:profile-updated', syncProfile);
  }, []);
  const initials = getInitials(studentName);

  async function handleSignOut() {
    setSignOutError('');
    try {
      await authService.signOut();
      navigate('/student/login', { replace: true });
    } catch (caught) {
      setSignOutError(caught instanceof Error ? caught.message : 'Sign out could not be completed.');
    }
  }

  return (
    <><GamificationEffects /><div className="app-shell">
      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand-row">
          <Brand />
          <button className="icon-button sidebar__close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>

        <div className="workspace-switcher">
          <div className="workspace-switcher__avatar">{profile?.profileImageDataUrl ? <img src={profile.profileImageDataUrl} alt="" /> : initials}</div>
          <div className="workspace-switcher__copy">
            <span className="workspace-switcher__label">WORKSPACE</span>
            <strong>Student portal</strong>
          </div>
          <ChevronDown size={15} className="muted-icon" />
        </div>
        <NavLink to="/" className="portal-return-link" onClick={() => setMobileOpen(false)}><ArrowLeft size={14} /> Back to Preppx home</NavLink>

        <nav className="sidebar__nav" aria-label="Student navigation">
          <span className="nav-caption">MENU</span>
          <NavLink to="/student/dashboard" onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}>
            <PanelLeftClose size={17} /><span>Overview</span>
          </NavLink>
          {moduleGroups.map((group) => {
            const items = studentModules.filter((item) => item.group === group.label);
            return (
              <div className="nav-group" key={group.label}>
                <span className="nav-caption">{group.label.toUpperCase()}</span>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink key={item.path} to={`/student/${item.path}`} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}>
                      <Icon size={17} /><span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <div className="help-card">
            <div className="help-card__icon">?</div>
            <div><strong>Need a hand?</strong><span>Visit the help centre</span></div>
          </div>
          <div className="sidebar-profile">
            <div className="avatar avatar--small">{profile?.profileImageDataUrl ? <img src={profile.profileImageDataUrl} alt="" /> : initials}</div>
            <div className="sidebar-profile__copy"><strong>{studentName}</strong><span>{session?.email ?? 'Student account'}</span></div>
            <button className="icon-button sidebar-profile__logout" type="button" onClick={() => void handleSignOut()} title="Sign out" aria-label="Sign out"><LogOut size={15} /></button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        {signOutError && <p className="form-error" role="alert">{signOutError}</p>}
        <header className="topbar">
          <div className="topbar__left">
            <button className="icon-button mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
            <div className="breadcrumbs"><span>Student portal</span><span className="breadcrumbs__separator">/</span><strong>{currentTitle}</strong></div>
          </div>
          <div className="topbar__actions">
            <span className="topbar__date">{new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date()).toUpperCase()}</span>
            <ThemeToggle />
            <NavLink to="/student/notifications" className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /></NavLink>
            <NavLink to="/student/profile" className="topbar__avatar avatar" aria-label="Open my account">{profile?.profileImageDataUrl ? <img src={profile.profileImageDataUrl} alt="" /> : initials}</NavLink>
          </div>
        </header>
        <div className="page-content"><PageTransition><Outlet /></PageTransition></div>
        <footer className="app-footer"><span>© {new Date().getFullYear()} Preppx</span><span>Learn with direction.</span></footer>
      </main>
    </div></>
  );
}
