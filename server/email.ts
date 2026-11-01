import { config, hasEmailDelivery } from './config.js';

export async function sendOtpEmail(email: string, code: string, purpose: string) {
  if (!hasEmailDelivery) {
    throw Object.assign(new Error('Student email verification is not configured. Ask the administrator to configure email delivery before registering.'), { status: 503, expose: true });
  }

  const action = purpose === 'reset' ? 'reset your password' : purpose === 'login' ? 'sign in' : 'complete your account setup';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.EMAIL_FROM,
      to: [email],
      subject: 'Your PREPPX verification code',
      text: `Use ${code} to ${action}. This code expires in 10 minutes. If you did not request it, you can ignore this message.`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    console.error('PREPPX email provider rejected an OTP message', { status: response.status });
    throw Object.assign(new Error('We could not deliver the verification email. Try again later.'), { status: 502, expose: true });
  }
}
