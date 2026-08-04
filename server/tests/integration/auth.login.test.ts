import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';

vi.mock('../../src/services/emailService', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('POST /api/v1/auth/login', () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  async function registerUser(app: import('express').Express) {
    await request(app).post('/api/v1/auth/register').send({
      username: 'henry',
      displayName: 'Henry',
      email: 'henry@example.com',
      password: 'supersecret123',
    });
  }

  it('logs in with correct credentials and sets a refresh cookie', async () => {
    const app = (await import('../../src/app')).default;
    await registerUser(app);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'henry@example.com', password: 'supersecret123', rememberMe: true });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('henry@example.com');
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie.some((c: string) => c.startsWith('refreshToken='))).toBe(true);
  });

  it('sets a persistent refresh cookie (Max-Age/Expires) when rememberMe is true', async () => {
    const app = (await import('../../src/app')).default;
    await registerUser(app);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'henry@example.com', password: 'supersecret123', rememberMe: true });

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const refreshCookie = setCookie.find((c: string) => c.startsWith('refreshToken='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/max-age|expires/i);
  });

  it('sets a session-only refresh cookie (no Max-Age/Expires) when rememberMe is false/omitted', async () => {
    const app = (await import('../../src/app')).default;
    await registerUser(app);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'henry@example.com', password: 'supersecret123' });

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const refreshCookie = setCookie.find((c: string) => c.startsWith('refreshToken='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).not.toMatch(/max-age|expires/i);
  });

  it('rejects an incorrect password with 401', async () => {
    const app = (await import('../../src/app')).default;
    await registerUser(app);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'henry@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('rejects a non-existent email with 401', async () => {
    const app = (await import('../../src/app')).default;

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever123' });

    expect(res.status).toBe(401);
  });
});
