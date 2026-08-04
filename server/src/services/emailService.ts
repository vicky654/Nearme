import { Resend } from 'resend';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

const resend = new Resend(env.RESEND_API_KEY);

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const link = `${env.CLIENT_URL}/verify-email?token=${token}`;
  const response = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'Verify your NearMe email',
    html: `<p>Welcome to NearMe! Confirm your email address:</p><p><a href="${link}">${link}</a></p>`,
  });
  if (response.error) {
    throw new AppError(502, 'Failed to send verification email');
  }
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${env.CLIENT_URL}/reset-password?token=${token}`;
  const response = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'Reset your NearMe password',
    html: `<p>Reset your password using this link (expires in 30 minutes):</p><p><a href="${link}">${link}</a></p>`,
  });
  if (response.error) {
    throw new AppError(502, 'Failed to send password reset email');
  }
}
