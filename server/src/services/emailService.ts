import { Resend } from 'resend';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

const resend = new Resend(env.RESEND_API_KEY);

function isDummyKey(key: string): boolean {
  return !key || key === 'dummy' || key.startsWith('dummy') || key === 'replace-with-your-resend-api-key';
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const link = `${env.CLIENT_URL}/verify-email?token=${token}`;

  if (isDummyKey(env.RESEND_API_KEY)) {
    console.log(`\n========================================`);
    console.log(`[Resend Dev Fallback] Email Verification`);
    console.log(`To: ${to}`);
    console.log(`Link: ${link}`);
    console.log(`========================================\n`);
    return;
  }

  try {
    const response = await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: 'Verify your NearMe email',
      html: `<p>Welcome to NearMe! Confirm your email address:</p><p><a href="${link}">${link}</a></p>`,
    });
    if (response.error) {
      throw new AppError(502, `Failed to send verification email: ${response.error.message}`);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(502, 'Failed to send verification email');
  }
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${env.CLIENT_URL}/reset-password?token=${token}`;

  if (isDummyKey(env.RESEND_API_KEY)) {
    console.log(`\n========================================`);
    console.log(`[Resend Dev Fallback] Password Reset`);
    console.log(`To: ${to}`);
    console.log(`Link: ${link}`);
    console.log(`========================================\n`);
    return;
  }

  try {
    const response = await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: 'Reset your NearMe password',
      html: `<p>Reset your password using this link (expires in 30 minutes):</p><p><a href="${link}">${link}</a></p>`,
    });
    if (response.error) {
      throw new AppError(502, `Failed to send password reset email: ${response.error.message}`);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(502, 'Failed to send password reset email');
  }
}
