import { useState, type FormEvent } from 'react';
import { ArrowRight, KeyRound, LockKeyhole } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell';
import { authService } from '../services/authService';
import { PasswordInput } from '../../../components/ui/PasswordInput';

export function ResetPasswordPage() {
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
    if (!email) return setError('Your recovery email is missing. Please restart the recovery process.');
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return setError('Use at least 8 characters, including a letter and a number.');
    if (password !== confirm) return setError('Your passwords do not match.');
    setBusy(true);
    try {
      await authService.completePasswordReset(password);
      navigate('/student/login?reset=complete');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not reset your password. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell eyebrow="UPDATE PASSWORD" title="Choose a new password." description={`Create a new password for ${email || 'your account'}.`} footer={<>Need to restart? <Link to="/student/forgot-password">Back to recovery</Link></>}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-field"><span>New password</span><div className="form-input-wrap"><LockKeyhole size={17} /><PasswordInput aria-label="New password" autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} required /></div></div>
        <div className="form-field"><span>Confirm new password</span><div className="form-input-wrap"><KeyRound size={17} /><PasswordInput aria-label="Confirm new password" autoComplete="new-password" placeholder="Enter it again" value={confirm} onChange={(event) => setConfirm(event.target.value)} required /></div></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button--dark button--full button--large" type="submit" disabled={busy}>{busy ? 'Updating…' : 'Update password'} <ArrowRight size={16} /></button>
        <div className="local-preview-notice"><strong>Secure account update</strong><span>Your new password will be saved to your student account after the verified recovery request.</span></div>
      </form>
    </AuthShell>
  );
}
