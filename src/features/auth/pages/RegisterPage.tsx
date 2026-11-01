import { useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, ImagePlus, KeyRound, LockKeyhole, Mail, Phone, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell';
import { authService } from '../services/authService';
import type { LearningInterest } from '../types/auth';
import { PasswordInput } from '../../../components/ui/PasswordInput';

const interestOptions: LearningInterest[] = ['Coding and programming', 'Non-coding activities', 'Technical subjects', 'Non-technical subjects'];

type RegistrationDraft = { fullName: string; phone: string; email: string; profileImageName: string; profileImageDataUrl?: string; interests: LearningInterest[] };
const emptyDraft: RegistrationDraft = { fullName: '', phone: '', email: '', profileImageName: '', profileImageDataUrl: undefined, interests: [] };

export function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<RegistrationDraft>(emptyDraft);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const progress = useMemo(() => `${(step / 3) * 100}%`, [step]);

  function handleProfilePicture(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPG, PNG or WEBP image.');
      return;
    }
    if (file.size > 1_500_000) {
      setError('Choose a profile picture smaller than 1.5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((current) => ({ ...current, profileImageName: file.name, profileImageDataUrl: String(reader.result) }));
      setError('');
    };
    reader.onerror = () => setError('The profile picture could not be read. Please try another file.');
    reader.readAsDataURL(file);
  }

  function toggleInterest(interest: LearningInterest) {
    setDraft((current) => ({ ...current, interests: current.interests.includes(interest) ? current.interests.filter((item) => item !== interest) : [...current.interests, interest] }));
  }

  function continueStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (step === 1) {
      if (draft.fullName.trim().length < 2) return setError('Enter your full name.');
      if (!/^\+?[0-9\s()-]{10,16}$/.test(draft.phone.trim())) return setError('Enter a valid phone number.');
      if (!/^\S+@\S+\.\S+$/.test(draft.email.trim())) return setError('Enter a valid email address.');
      setStep(2);
      return;
    }
    if (step === 2) {
      if (draft.interests.length === 0) return setError('Select at least one learning interest.');
      setStep(3);
    }
  }

  async function finishRegistration() {
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Use at least 8 characters, including a letter and a number.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Your passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await authService.registerStudent({ ...draft, fullName: draft.fullName.trim(), phone: draft.phone.trim(), email: draft.email.trim().toLowerCase() }, password);
      navigate(`/student/verify-otp?email=${encodeURIComponent(draft.email.trim().toLowerCase())}&purpose=register`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Registration could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  const footer = <>Already have an account? <Link to="/student/login">Sign in</Link></>;

  return (
    <AuthShell eyebrow={`STUDENT REGISTRATION · STEP ${step} OF 3`} title={step === 1 ? 'Let’s get to know you.' : step === 2 ? 'What would you like to learn?' : 'Review your details.'} description={step === 1 ? 'Start with a few details so we can set up your student profile.' : step === 2 ? 'Choose the areas you’re interested in. You can select more than one.' : 'Check your information before creating your Preppx account.'} footer={footer}>
      <div className="auth-stepper"><div className="auth-stepper__track"><span style={{ width: progress }} /></div><div className="auth-stepper__labels"><span className={step >= 1 ? 'is-current' : ''}>Personal details</span><span className={step >= 2 ? 'is-current' : ''}>Interests</span><span className={step >= 3 ? 'is-current' : ''}>Review</span></div></div>
      {step < 3 ? <form className="auth-form" onSubmit={continueStep}>
        {step === 1 ? <>
          <label className="form-field"><span>Full name</span><div className="form-input-wrap"><UserRound size={17} /><input autoComplete="name" placeholder="Your full name" value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} required /></div></label>
          <label className="form-field"><span>Phone number</span><div className="form-input-wrap"><Phone size={17} /><input type="tel" autoComplete="tel" placeholder="Your contact number" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} required /></div></label>
          <label className="form-field"><span>Email address</span><div className="form-input-wrap"><Mail size={17} /><input type="email" autoComplete="email" placeholder="College or personal email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} required /></div></label>
          <label className="upload-field"><span className="upload-field__icon">{draft.profileImageDataUrl ? <img className="registration-avatar-preview" src={draft.profileImageDataUrl} alt="Profile preview" /> : <ImagePlus size={18} />}</span><span><strong>{draft.profileImageName || 'Add a profile picture'}</strong><small>Optional · JPG, PNG or WEBP · up to 1.5 MB</small></span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleProfilePicture(event.target.files?.[0])} /></label>
        </> : <div className="interest-options">{interestOptions.map((interest) => { const selected = draft.interests.includes(interest); return <button type="button" key={interest} className={`interest-option ${selected ? 'interest-option--selected' : ''}`} onClick={() => toggleInterest(interest)}><span className="interest-option__check">{selected && <Check size={14} />}</span><span>{interest}</span></button>; })}</div>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="auth-form__actions">{step === 2 && <button type="button" className="button button--outline" onClick={() => { setError(''); setStep(1); }}><ArrowLeft size={15} /> Back</button>}<button type="submit" className="button button--dark button--large">{step === 1 ? 'Continue' : 'Review details'} <ArrowRight size={16} /></button></div>
      </form> : <div className="auth-form">
        <div className="review-card"><div className="review-card__avatar">{draft.profileImageDataUrl ? <img src={draft.profileImageDataUrl} alt="Profile" /> : (draft.fullName.trim().charAt(0).toUpperCase() || 'S')}</div><div><strong>{draft.fullName}</strong><span>{draft.email}</span></div></div>
        <div className="review-rows"><div><span>Phone</span><strong>{draft.phone}</strong></div><div><span>Profile picture</span><strong>{draft.profileImageName || 'Not added'}</strong></div><div className="review-rows__interests"><span>Learning interests</span><div>{draft.interests.map((interest) => <em key={interest}>{interest}</em>)}</div></div></div>
        <div className="form-field"><span>Create password</span><div className="form-input-wrap"><LockKeyhole size={17} /><PasswordInput aria-label="Create password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></div></div>
        <div className="form-field"><span>Confirm password</span><div className="form-input-wrap"><KeyRound size={17} /><PasswordInput aria-label="Confirm password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required /></div></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="auth-form__actions"><button type="button" className="button button--outline" onClick={() => { setError(''); setStep(2); }}><ArrowLeft size={15} /> Edit</button><button type="button" className="button button--dark button--large" onClick={finishRegistration} disabled={busy}>{busy ? 'Saving…' : 'Create account'} <ArrowRight size={16} /></button></div>
        <p className="auth-muted-copy">Your account is stored securely in PREPPX. You must verify your email before signing in.</p>
      </div>}
    </AuthShell>
  );
}
