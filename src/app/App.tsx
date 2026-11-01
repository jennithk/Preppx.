import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { StudentLayout } from '../layouts/StudentLayout';
import { PageTransition } from '../components/common/PageTransition';
import { StudentDashboardPage } from '../features/dashboard/pages/StudentDashboardPage';
import { StudentModulePage } from '../features/student/pages/StudentModulePage';
import { LandingPage } from '../features/auth/pages/LandingPage';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { AccountLoginPage } from '../features/auth/pages/AccountLoginPage';
import { RegisterPage } from '../features/auth/pages/RegisterPage';
import { CreatePasswordPage } from '../features/auth/pages/CreatePasswordPage';
import { VerifyOtpPage } from '../features/auth/pages/VerifyOtpPage';
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage';
import { RequireStudent } from '../features/auth/components/RequireStudent';
import { authService } from '../features/auth/services/authService';
import { studentModules } from './studentModules';
import { studentRoutes } from './studentRoutes';
import { ClassroomPortalPage } from '../features/management/pages/ClassroomPortalPage';

function StudentEntryRedirect() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    authService.restoreServerSession()
      .then(() => { if (active) navigate(studentRoutes.dashboard, { replace: true }); })
      .catch((caught: unknown) => {
        if (!active) return;
        if (caught instanceof Error && 'status' in caught && caught.status === 401) {
          authService.clearClientSession();
          navigate(studentRoutes.login, { replace: true });
        } else {
          setError(caught instanceof Error ? caught.message : 'Your student session could not be verified.');
        }
      });
    return () => { active = false; };
  }, [navigate]);
  if (error) return <div className="state-card state-card--error" role="alert">{error} <button className="auth-text-button" type="button" onClick={() => window.location.reload()}>Try again</button></div>;
  return <div className="loading-state"><span className="loading-spinner" />Opening your student space…</div>;
}

function LegacyStudentRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}${location.hash}`} replace />;
}

export function App() {
  const [landingIntroPlayed, setLandingIntroPlayed] = useState(false);
  const markLandingIntroPlayed = useCallback(() => setLandingIntroPlayed(true), []);

  return (
    <BrowserRouter>
      <Routes>
        {/* The existing Preppx common entry page remains at the root. */}
        <Route
          path="/"
          element={(
            <PageTransition>
              <LandingPage playIntro={!landingIntroPlayed} onIntroStarted={markLandingIntroPlayed} />
            </PageTransition>
          )}
        />

        <Route path="/management/*" element={<ClassroomPortalPage />} />
        <Route path="/login" element={<PageTransition><AccountLoginPage /></PageTransition>} />

        {/* Student application: its own public auth routes and protected workspace. */}
        <Route path="/student">
          <Route index element={<StudentEntryRedirect />} />
          <Route path="login" element={<PageTransition><LoginPage /></PageTransition>} />
          <Route path="register" element={<PageTransition><RegisterPage /></PageTransition>} />
          <Route path="create-password" element={<PageTransition><CreatePasswordPage /></PageTransition>} />
          <Route path="verify-otp" element={<PageTransition><VerifyOtpPage /></PageTransition>} />
          <Route path="forgot-password" element={<PageTransition><ForgotPasswordPage /></PageTransition>} />
          <Route path="reset-password" element={<PageTransition><ResetPasswordPage /></PageTransition>} />

          <Route element={<RequireStudent><StudentLayout /></RequireStudent>}>
            <Route path="dashboard" element={<StudentDashboardPage />} />
            {studentModules.map((module) => (
              <Route
                key={module.path}
                path={module.path}
                element={<StudentModulePage module={module} />}
              />
            ))}
          </Route>
        </Route>

        {/* Backward-compatible aliases for old links and bookmarks. */}
        <Route path="/register" element={<LegacyStudentRedirect to={studentRoutes.register} />} />
        <Route path="/create-password" element={<LegacyStudentRedirect to={studentRoutes.createPassword} />} />
        <Route path="/verify-otp" element={<LegacyStudentRedirect to={studentRoutes.verifyOtp} />} />
        <Route path="/forgot-password" element={<LegacyStudentRedirect to={studentRoutes.forgotPassword} />} />
        <Route path="/reset-password" element={<LegacyStudentRedirect to={studentRoutes.resetPassword} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
