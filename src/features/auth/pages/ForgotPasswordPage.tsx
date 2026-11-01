import { useState, type FormEvent } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell';
import { authService } from '../services/authService';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    setBusy(true);
    try {
      await authService.requestOtp(email.trim().toLowerCase(), 'reset');
      navigate(`/student/verify-otp?email=${encodeURIComponent(email.trim().toLowerCase())}&purpose=reset`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not start password recovery. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell eyebrow="ACCOUNT RECOVERY" title="Forgot your password?" description="Enter the email linked to your student account. We'll take you through a verification step." footer={<>Remembered it? <Link to="/student/login">Return to sign in</Link></>}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="form-field"><span>Email address</span><div className="form-input-wrap"><Mail size={17} /><input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></div></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button--dark button--full button--large" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Continue to verification'} <ArrowRight size={16} /></button>
        <div className="local-preview-notice"><strong>Email verification required</strong><span>A password reset code will be sent only when the email delivery service is configured.</span></div>
      </form>
    </AuthShell>
  );
}
