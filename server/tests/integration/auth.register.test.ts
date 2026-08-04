import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';

vi.mock('../../src/services/emailService', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('POST /api/v1/auth/register + /api/v1/auth/verify-email', () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  it('registers a new user and does not return a passwordHash', async () => {
    const app = (await import('../../src/app')).default;

    const res = await request(app).post('/api/v1/auth/register').send({
      username: 'erin',
      displayName: 'Erin',
      email: 'erin@example.com',
      password: 'supersecret123',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe('erin');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.user.emailVerifiedAt).toBeNull();
  });

  it('rejects registration with a duplicate email with 409', async () => {
    const app = (await import('../../src/app')).default;

    await request(app).post('/api/v1/auth/register').send({
      username: 'frank',
      displayName: 'Frank',
      email: 'dup@example.com',
      password: 'supersecret123',
    });

    const res = await request(app).post('/api/v1/auth/register').send({
      username: 'frank2',
      displayName: 'Frank Two',
      email: 'dup@example.com',
      password: 'supersecret123',
    });

    expect(res.status).toBe(409);
  });

  it('rejects registration with an invalid body with 400', async () => {
    const app = (await import('../../src/app')).default;

    const res = await request(app).post('/api/v1/auth/register').send({
      username: 'a',
      email: 'not-an-email',
      password: '123',
    });

    expect(res.status).toBe(400);
  });

  it('verifies an email with a valid token and sets emailVerifiedAt', async () => {
    const app = (await import('../../src/app')).default;
    const { signPurposeToken } = await import('../../src/services/tokenService');
    const User = (await import('../../src/models/User')).default;

    const user = await User.create({
      username: 'grace',
      displayName: 'Grace',
      email: 'grace@example.com',
      passwordHash: 'irrelevant-for-this-test',
      avatarUrl: 'https://example.com/default-avatar.png',
    });

    const token = signPurposeToken(user.id, 'email-verify');
    const res = await request(app).post('/api/v1/auth/verify-email').send({ token });

    expect(res.status).toBe(200);
    expect(res.body.user.emailVerifiedAt).not.toBeNull();
  });

  it('rejects verify-email with an invalid token with 400', async () => {
    const app = (await import('../../src/app')).default;

    const res = await request(app).post('/api/v1/auth/verify-email').send({ token: 'garbage' });

    expect(res.status).toBe(400);
  });

  it('still registers the user with 201 when the verification email fails to send', async () => {
    const app = (await import('../../src/app')).default;
    const { sendVerificationEmail } = await import('../../src/services/emailService');
    vi.mocked(sendVerificationEmail).mockRejectedValueOnce(new Error('Resend is down'));

    const res = await request(app).post('/api/v1/auth/register').send({
      username: 'hank',
      displayName: 'Hank',
      email: 'hank@example.com',
      password: 'supersecret123',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe('hank');
  });
});
