import { config, hasEmailDelivery } from './config.js';

export async function sendOtpEmail(email: string, code: string, purpose: string) {
  if (!hasEmailDelivery) {
    throw Object.assign(new Error('Student email verification is not configured. Ask the administrator to configure email delivery before registering.'), { status: 503, expose: true });
  }

  const action = purpose === 'reset' ? 'reset your password' : purpose === 'login' ? 'sign in' : 'complete your account setup';
  const verificationUrl = new URL('/student/verify-otp', config.FRONTEND_ORIGIN);
  verificationUrl.searchParams.set('email', email);
  verificationUrl.searchParams.set('purpose', purpose);
  verificationUrl.hash = new URLSearchParams({ code }).toString();
  const link = verificationUrl.toString();
  const htmlLink = link.replaceAll('&', '&amp;');
  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.EMAIL_FROM,
        to: [email],
        subject: 'Your PREPPX verification code',
        text: `Open this link to ${action}: ${link}\n\nAlternatively, enter this code on the verification page: ${code}. The code expires in 10 minutes. If you did not request it, you can ignore this message.`,
        html: `<p>Open the link below to ${action}. The verification expires in 10 minutes.</p><p><a href="${htmlLink}">Continue to PREPPX verification</a></p><p>If the link does not open, enter this code on the verification page: <strong>${code}</strong></p><p>If you did not request this, you can ignore this message.</p>`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network';
    console.error('PREPPX email provider request failed', { reason });
    throw Object.assign(new Error('We could not deliver the verification email. Try again later.'), { status: 502, expose: true });
  }

  if (!response.ok) {
    const reason = response.status === 401
      ? 'api_key_rejected'
      : response.status === 403 || response.status === 422
        ? 'sender_not_verified_or_rejected'
        : response.status === 429
          ? 'rate_limited'
          : 'provider_rejected';
    console.error('PREPPX email provider rejected an OTP message', { status: response.status, reason });
    throw Object.assign(new Error('We could not deliver the verification email. Try again later.'), { status: 502, expose: true });
  }
}
