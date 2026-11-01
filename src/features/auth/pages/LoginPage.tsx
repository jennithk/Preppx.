import { useState, type FormEvent } from 'react';
import { ArrowRight, Mail, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell';
import { authService } from '../services/authService';
import { PasswordInput } from '../../../components/ui/PasswordInput';

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const completionMessage = params.get('setup') === 'complete'
    ? 'Your account is set up. Sign in to continue.'
    : params.get('reset') === 'complete'
      ? 'Your password was updated. Sign in to continue.'
      : '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Enter your password (at least 8 characters).');
    setBusy(true);
    try {
      await authService.startLogin(email.trim().toLowerCase(), password);
      navigate(`/student/verify-otp?email=${encodeURIComponent(email.trim().toLowerCase())}&purpose=login`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not start verification. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell eyebrow="WELCOME BACK" title="Sign in to Preppx." description="Pick up where you left off. Your learning space is ready." footer={<>New to Preppx? <Link to="/student/register">Create a student account</Link></>}>
      <form className="auth-form" onSubmit={handleSubmit}>
        {completionMessage && <p className="form-success" role="status">{completionMessage}</p>}
        <label className="form-field"><span>Email address</span><div className="form-input-wrap"><Mail size={17} /><input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></div></label>
        <div className="form-field"><span className="form-field__label-row">Password <Link to="/student/forgot-password">Forgot password?</Link></span><div className="form-input-wrap"><LockKeyhole size={17} /><PasswordInput aria-label="Password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></div></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button--dark button--full button--large" type="submit" disabled={busy}>{busy ? 'Continuing…' : 'Continue'} <ArrowRight size={17} /></button>
        <div className="auth-security-note"><ShieldCheck size={16} /><span>Sign in securely with a password and a one-time email verification code.</span></div>
        <div className="local-preview-notice"><strong>Legacy account migration</strong><span>Accounts from this browser can be moved to secure server storage after you verify your email.</span></div>
      </form>
    </AuthShell>
  );
}
