import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../../src/utils/AppError';

const sendMock = vi.fn().mockResolvedValue({ data: { id: 'email-id' }, error: null });

vi.mock('resend', () => {
  class Resend {
    emails = { send: sendMock };
  }
  return { Resend };
});

describe('emailService', () => {
  beforeEach(() => {
    sendMock.mockClear();
  });

  it('sends a verification email with a link containing the token', async () => {
    const { sendVerificationEmail } = await import('../../src/services/emailService');
    await sendVerificationEmail('alice@example.com', 'tok123');

    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0]![0];
    expect(call.to).toBe('alice@example.com');
    expect(call.html).toContain('tok123');
    expect(call.html).toContain('verify-email');
  });

  it('sends a password reset email with a link containing the token', async () => {
    const { sendPasswordResetEmail } = await import('../../src/services/emailService');
    await sendPasswordResetEmail('bob@example.com', 'tok456');

    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0]![0];
    expect(call.to).toBe('bob@example.com');
    expect(call.html).toContain('tok456');
    expect(call.html).toContain('reset-password');
  });

  it('throws AppError when verification email send fails', async () => {
    sendMock.mockResolvedValueOnce({ data: null, error: { message: 'Invalid recipient' } });
    const { sendVerificationEmail } = await import('../../src/services/emailService');

    await expect(sendVerificationEmail('invalid@example.com', 'tok123')).rejects.toThrow(AppError);
  });

  it('throws AppError when password reset email send fails', async () => {
    sendMock.mockResolvedValueOnce({ data: null, error: { message: 'Rate limit exceeded' } });
    const { sendPasswordResetEmail } = await import('../../src/services/emailService');

    await expect(sendPasswordResetEmail('user@example.com', 'tok456')).rejects.toThrow(AppError);
  });
});
