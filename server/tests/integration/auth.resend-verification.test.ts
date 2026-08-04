import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';

vi.mock('../../src/services/emailService', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('POST /api/v1/auth/resend-verification', () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
    vi.clearAllMocks();
  });

  it('sends a fresh verification email for an unverified existing user', async () => {
    const app = (await import('../../src/app')).default;
    const { sendVerificationEmail } = await import('../../src/services/emailService');

    await request(app).post('/api/v1/auth/register').send({
      username: 'penny',
      displayName: 'Penny',
      email: 'penny@example.com',
      password: 'supersecret123',
    });
    vi.mocked(sendVerificationEmail).mockClear();

    const res = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'penny@example.com' });

    expect(res.status).toBe(200);
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(sendVerificationEmail).toHaveBeenCalledWith('penny@example.com', expect.any(String));
  });

  it('does not send an email for an already-verified user, but still returns 200', async () => {
    const app = (await import('../../src/app')).default;
    const { sendVerificationEmail } = await import('../../src/services/emailService');
    const User = (await import('../../src/models/User')).default;
    const { hashPassword } = await import('../../src/services/passwordService');

    await User.create({
      username: 'quinn',
      displayName: 'Quinn',
      email: 'quinn@example.com',
      passwordHash: await hashPassword('supersecret123'),
      avatarUrl: 'https://example.com/default-avatar.png',
      emailVerifiedAt: new Date(),
    });
    vi.mocked(sendVerificationEmail).mockClear();

    const res = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'quinn@example.com' });

    expect(res.status).toBe(200);
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('does not send an email and still returns 200 for a non-existent email', async () => {
    const app = (await import('../../src/app')).default;
    const { sendVerificationEmail } = await import('../../src/services/emailService');
    vi.mocked(sendVerificationEmail).mockClear();

    const res = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(200);
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('still returns 200 with the generic message if sendVerificationEmail fails', async () => {
    const app = (await import('../../src/app')).default;
    const { sendVerificationEmail } = await import('../../src/services/emailService');

    await request(app).post('/api/v1/auth/register').send({
      username: 'ruby',
      displayName: 'Ruby',
      email: 'ruby@example.com',
      password: 'supersecret123',
    });
    vi.mocked(sendVerificationEmail).mockRejectedValueOnce(new Error('email provider down'));

    const res = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'ruby@example.com' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'If an unverified account exists for that email, a new verification link has been sent.',
    });
  });
});
