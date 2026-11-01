import { ArrowRight, GraduationCap, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell';

export function AccountLoginPage() {
  return (
    <AuthShell
      eyebrow="ACCOUNT ACCESS"
      title="Choose your workspace."
      description="Sign in to the right Preppx workspace. Student and Management accounts use separate secure sessions."
      footer={<>New to Preppx? <Link to="/student/register">Create a student account</Link></>}
    >
      <div className="account-login-options">
        <Link className="account-login-option" to="/student/login">
          <span className="account-login-option__icon"><GraduationCap size={19} /></span>
          <span className="account-login-option__copy"><strong>Student Login</strong><small>Continue to your learning space, courses, and progress.</small></span>
          <ArrowRight size={17} />
        </Link>
        <Link className="account-login-option" to="/management/login">
          <span className="account-login-option__icon"><ShieldCheck size={19} /></span>
          <span className="account-login-option__copy"><strong>Management Login</strong><small>Access the unified management workspace.</small></span>
          <ArrowRight size={17} />
        </Link>
      </div>
      <p className="account-login-note">Management accounts are provisioned by an authorized administrator. Public Management registration is not available.</p>
    </AuthShell>
  );
}
