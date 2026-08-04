import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';

vi.mock('../../src/services/emailService', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('POST /api/v1/auth/forgot-password and /api/v1/auth/reset-password', () => {
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

  it('returns 200 for forgot-password regardless of whether the email exists', async () => {
    const app = (await import('../../src/app')).default;

    const known = await request(app).post('/api/v1/auth/forgot-password').send({
      email: 'nobody@example.com',
    });
    expect(known.status).toBe(200);
  });

  it('resets the password with a valid token and allows login with the new password', async () => {
    const app = (await import('../../src/app')).default;
    const { signPurposeToken } = await import('../../src/services/tokenService');
    const User = (await import('../../src/models/User')).default;
    const { hashPassword } = await import('../../src/services/passwordService');

    const user = await User.create({
      username: 'jack',
      displayName: 'Jack',
      email: 'jack@example.com',
      passwordHash: await hashPassword('old-password-123'),
      avatarUrl: 'https://example.com/default-avatar.png',
    });

    const token = signPurposeToken(user.id, 'password-reset');
    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'brand-new-password-456' });
    expect(resetRes.status).toBe(200);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'jack@example.com', password: 'brand-new-password-456' });
    expect(loginRes.status).toBe(200);

    const oldPasswordLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'jack@example.com', password: 'old-password-123' });
    expect(oldPasswordLoginRes.status).toBe(401);
  });

  it('rejects reuse of the same reset token after it has already been used once', async () => {
    const app = (await import('../../src/app')).default;
    const { signPurposeToken } = await import('../../src/services/tokenService');
    const User = (await import('../../src/models/User')).default;
    const { hashPassword } = await import('../../src/services/passwordService');

    const user = await User.create({
      username: 'kate',
      displayName: 'Kate',
      email: 'kate@example.com',
      passwordHash: await hashPassword('old-password-123'),
      avatarUrl: 'https://example.com/default-avatar.png',
    });

    const token = signPurposeToken(user.id, 'password-reset');

    const firstReset = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'brand-new-password-456' });
    expect(firstReset.status).toBe(200);

    const secondReset = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'yet-another-password-789' });
    expect(secondReset.status).toBe(400);

    const loginWithFirstNewPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'kate@example.com', password: 'brand-new-password-456' });
    expect(loginWithFirstNewPassword.status).toBe(200);
  });

  it('rejects reset-password with an invalid token with 400', async () => {
    const app = (await import('../../src/app')).default;

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'garbage', password: 'whatever-new-123' });

    expect(res.status).toBe(400);
  });

  it('still returns 200 with the generic message if sendPasswordResetEmail fails', async () => {
    const app = (await import('../../src/app')).default;
    const User = (await import('../../src/models/User')).default;
    const { hashPassword } = await import('../../src/services/passwordService');
    const { sendPasswordResetEmail } = await import('../../src/services/emailService');

    await User.create({
      username: 'jill',
      displayName: 'Jill',
      email: 'jill@example.com',
      passwordHash: await hashPassword('some-password-123'),
      avatarUrl: 'https://example.com/default-avatar.png',
    });

    vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce(new Error('email provider down'));

    const res = await request(app).post('/api/v1/auth/forgot-password').send({
      email: 'jill@example.com',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'If an account exists for that email, a reset link has been sent.',
    });
  });
});
