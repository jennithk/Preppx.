import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, MailCheck } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell';
import { authService } from '../services/authService';

export function VerifyOtpPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const purpose = params.get('purpose') === 'reset' ? 'reset' : params.get('purpose') === 'register' ? 'register' : params.get('purpose') === 'migration' ? 'migration' : 'login';
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const linkCode = new URLSearchParams(window.location.hash.slice(1)).get('code') ?? '';

  async function verifyCode(value: string) {
    setError('');
    if (value.length !== 6) return setError('Enter all 6 digits.');
    setBusy(true);
    try {
      const result = await authService.verifyOtp(value, { email, purpose });
      navigate(result.purpose === 'reset' ? `/student/reset-password?email=${encodeURIComponent(result.email)}` : '/student/dashboard');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Verification failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!/^\d{6}$/.test(linkCode)) return;
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
    setCode(linkCode);
  }, [linkCode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await verifyCode(code);
  }

  async function resendCode() {
    if (!email) return setError('Email is missing. Please start again.');
    setError('');
    try {
      await authService.requestOtp(email, purpose);
      setCode('');
      setResent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not resend the verification code.');
    }
  }

  return (
    <AuthShell eyebrow="SECURE SIGN IN" title="Verify it’s you." description={`Enter the 6-digit code sent to your email to ${purpose === 'reset' ? 'continue resetting' : purpose === 'register' ? 'verify your new account' : purpose === 'migration' ? 'securely migrate your existing account' : 'finish signing in'}.`} footer={<>Wrong email address? <Link to={purpose === 'reset' ? '/student/forgot-password' : '/student/login'}>Go back</Link></>}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="otp-recipient"><span><MailCheck size={18} /></span><div><small>VERIFICATION FOR</small><strong>{email || 'Your email address'}</strong></div></div>
        <label className="form-field"><span>One-time password</span><input className="otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {resent && <p className="form-success" role="status">A new verification code was sent to your email.</p>}
        <button className="button button--dark button--full button--large" type="submit" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify and continue'} <ArrowRight size={16} /></button>
        <button className="auth-text-button" type="button" onClick={resendCode}>Didn't receive a code? Resend</button>
        <Link className="auth-back-inline" to={purpose === 'reset' ? '/student/forgot-password' : '/student/login'}><ArrowLeft size={14} /> Back</Link>
      </form>
    </AuthShell>
  );
}
