import { Resend } from 'resend';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

const EMAIL_DISABLED_WARNING = 'Email provider disabled - RESEND_API_KEY not configured';

function isValidApiKey(key: string | undefined): boolean {
  const trimmed = key?.trim();
  if (!trimmed) return false;
  if (trimmed === 'dummy' || trimmed.startsWith('dummy')) return false;
  if (trimmed === 'replace-with-your-resend-api-key') return false;
  return true;
}

export function isEmailEnabled(): boolean {
  return isValidApiKey(process.env.RESEND_API_KEY);
}

let warnedDisabled = false;

function getResendClient(): Resend | null {
  if (!isEmailEnabled()) {
    if (!warnedDisabled) {
      console.warn(EMAIL_DISABLED_WARNING);
      warnedDisabled = true;
    }
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export interface EmailSendResult {
  sent: boolean;
  reason?: string;
}

export async function sendVerificationEmail(to: string, token: string): Promise<EmailSendResult> {
  const link = `${env.CLIENT_URL}/verify-email?token=${token}`;
  const client = getResendClient();

  if (!client) {
    console.log(`\n========================================`);
    console.log(`[Email Disabled] Email Verification`);
    console.log(`To: ${to}`);
    console.log(`Link: ${link}`);
    console.log(`========================================\n`);
    return { sent: false, reason: EMAIL_DISABLED_WARNING };
  }

  try {
    const response = await client.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: 'Verify your NearMe email',
      html: `<p>Welcome to NearMe! Confirm your email address:</p><p><a href="${link}">${link}</a></p>`,
    });
    if (response.error) {
      throw new AppError(502, `Failed to send verification email: ${response.error.message}`);
    }
    return { sent: true };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(502, 'Failed to send verification email');
  }
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<EmailSendResult> {
  const link = `${env.CLIENT_URL}/reset-password?token=${token}`;
  const client = getResendClient();

  if (!client) {
    console.log(`\n========================================`);
    console.log(`[Email Disabled] Password Reset`);
    console.log(`To: ${to}`);
    console.log(`Link: ${link}`);
    console.log(`========================================\n`);
    return { sent: false, reason: EMAIL_DISABLED_WARNING };
  }

  try {
    const response = await client.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: 'Reset your NearMe password',
      html: `<p>Reset your password using this link (expires in 30 minutes):</p><p><a href="${link}">${link}</a></p>`,
    });
    if (response.error) {
      throw new AppError(502, `Failed to send password reset email: ${response.error.message}`);
    }
    return { sent: true };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(502, 'Failed to send password reset email');
  }
}
