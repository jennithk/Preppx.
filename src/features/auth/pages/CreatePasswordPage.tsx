import { useState, type FormEvent } from 'react';
import { ArrowRight, KeyRound, LockKeyhole } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell';
import { authService } from '../services/authService';
import { PasswordInput } from '../../../components/ui/PasswordInput';

export function CreatePasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!email) return setError('Registration email is missing. Please start again.');
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return setError('Include at least one letter and one number.');
    if (password !== confirm) return setError('Your passwords do not match.');
    setBusy(true);
    try {
      await authService.completePasswordSetup(email, password);
      navigate('/student/login?setup=complete');
    } catch {
      setError('We could not complete password setup. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell eyebrow="LEGACY ACCOUNT" title="Set up legacy sign-in." description={`This compatibility step applies only to a PREPPX account already stored in this browser${email ? ` for ${email}` : ''}. It does not set a password for a server-backed account.`} footer={<>Already have a server-backed account? <Link to="/student/login">Sign in</Link></>}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-field"><span>Create password</span><div className="form-input-wrap"><LockKeyhole size={17} /><PasswordInput aria-label="Create password" autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></div></div>
        <div className="form-field"><span>Confirm password</span><div className="form-input-wrap"><KeyRound size={17} /><PasswordInput aria-label="Confirm password" autoComplete="new-password" placeholder="Enter your password again" value={confirm} onChange={(event) => setConfirm(event.target.value)} required minLength={8} /></div></div>
        <div className="password-rules"><span className={password.length >= 8 ? 'is-met' : ''}>8 characters minimum</span><span className={/[A-Za-z]/.test(password) ? 'is-met' : ''}>At least one letter</span><span className={/[0-9]/.test(password) ? 'is-met' : ''}>At least one number</span></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button--dark button--full button--large" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save legacy password'} <ArrowRight size={16} /></button>
        <div className="local-preview-notice"><strong>Browser-only compatibility</strong><span>A password verifier is stored only in this browser to support legacy account migration. Use the current registration flow for new accounts or Forgot password for an existing server-backed account.</span></div>
      </form>
    </AuthShell>
  );
}
