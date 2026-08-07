import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendMock = vi.fn();

vi.mock('resend', () => {
  class Resend {
    emails = { send: sendMock };
  }
  return { Resend };
});

describe('emailService when RESEND_API_KEY is not configured', () => {
  const originalKey = process.env.RESEND_API_KEY;
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    sendMock.mockClear();
    warnSpy.mockClear();
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalKey;
    }
    vi.resetModules();
  });

  it('reports disabled when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
    const { isEmailEnabled } = await import('../../src/services/emailService');

    expect(isEmailEnabled()).toBe(false);
  });

  it('reports disabled when RESEND_API_KEY is a dummy placeholder', async () => {
    process.env.RESEND_API_KEY = 'dummy';
    vi.resetModules();
    const { isEmailEnabled } = await import('../../src/services/emailService');

    expect(isEmailEnabled()).toBe(false);
  });

  it('does not throw on import when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY;
    vi.resetModules();

    await expect(import('../../src/services/emailService')).resolves.toBeTruthy();
  });

  it('skips sending and returns a disabled result for verification emails', async () => {
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
    const { sendVerificationEmail } = await import('../../src/services/emailService');

    const result = await sendVerificationEmail('alice@example.com', 'tok123');

    expect(result).toEqual({ sent: false, reason: 'Email provider disabled - RESEND_API_KEY not configured' });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('skips sending and returns a disabled result for password reset emails', async () => {
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
    const { sendPasswordResetEmail } = await import('../../src/services/emailService');

    const result = await sendPasswordResetEmail('bob@example.com', 'tok456');

    expect(result).toEqual({ sent: false, reason: 'Email provider disabled - RESEND_API_KEY not configured' });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('logs a clear warning that the email provider is disabled', async () => {
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
    const { sendVerificationEmail } = await import('../../src/services/emailService');

    await sendVerificationEmail('alice@example.com', 'tok123');

    expect(warnSpy).toHaveBeenCalledWith('Email provider disabled - RESEND_API_KEY not configured');
  });
});
