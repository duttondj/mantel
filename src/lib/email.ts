import { Resend } from 'resend';

function resend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  return new Resend(key);
}

const FROM = process.env.RESEND_FROM ?? 'Mantel <noreply@mantel.wedding>';

export async function sendVerificationEmail(to: string, verificationUrl: string) {
  await resend().emails.send({
    from: FROM,
    to,
    subject: 'Verify your Mantel account',
    html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#221d18;padding:2rem">
  <h2 style="font-family:Georgia,serif;margin:0 0 1rem">Verify your email</h2>
  <p style="margin:0 0 1.5rem;color:#6b6058">Thanks for signing up for Mantel. Click below to verify your email address and activate your account.</p>
  <a href="${verificationUrl}" style="display:inline-block;background:#b6705f;color:#fff;text-decoration:none;padding:0.75rem 1.5rem;border-radius:6px;font-weight:600">Verify email</a>
  <p style="margin:1.5rem 0 0;font-size:0.85rem;color:#6b6058">This link expires in 24 hours. If you didn't create a Mantel account, you can safely ignore this email.</p>
</div>`,
  });
}

export async function sendExpiryReminderEmail(
  to: string,
  daysLeft: number,
  expiresAt: Date,
  appUrl: string
) {
  const expiryStr = expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const urgency = daysLeft <= 7 ? 'just 7 days' : '30 days';
  await resend().emails.send({
    from: FROM,
    to,
    subject: `Your Mantel gallery expires in ${urgency}`,
    html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#221d18;padding:2rem">
  <h2 style="font-family:Georgia,serif;margin:0 0 1rem">Your gallery expires soon</h2>
  <p style="margin:0 0 1rem;color:#6b6058">Your Mantel hosting period ends on <strong>${expiryStr}</strong> — ${urgency} from now.</p>
  <p style="margin:0 0 1.5rem;color:#6b6058">After that date, your galleries and all guest photos will no longer be accessible. Download a ZIP of everything before then so you don't lose anything.</p>
  <a href="${appUrl}/dashboard" style="display:inline-block;background:#b6705f;color:#fff;text-decoration:none;padding:0.75rem 1.5rem;border-radius:6px;font-weight:600">Go to your dashboard</a>
  <p style="margin:1.5rem 0 0;font-size:0.85rem;color:#6b6058">You're receiving this because you have an active Mantel account. Questions? Reply to this email.</p>
</div>`,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await resend().emails.send({
    from: FROM,
    to,
    subject: 'Reset your Mantel password',
    html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#221d18;padding:2rem">
  <h2 style="font-family:Georgia,serif;margin:0 0 1rem">Reset your password</h2>
  <p style="margin:0 0 1.5rem;color:#6b6058">Someone requested a password reset for your Mantel account. If that was you, click below.</p>
  <a href="${resetUrl}" style="display:inline-block;background:#b6705f;color:#fff;text-decoration:none;padding:0.75rem 1.5rem;border-radius:6px;font-weight:600">Reset password</a>
  <p style="margin:1.5rem 0 0;font-size:0.85rem;color:#6b6058">This link expires in 1 hour. If you didn't request a reset, you can safely ignore this email.</p>
</div>`,
  });
}
