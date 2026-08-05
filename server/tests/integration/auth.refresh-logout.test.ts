import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';

vi.mock('../../src/services/emailService', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('POST /api/v1/auth/refresh and /api/v1/auth/logout', () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  async function loginAndGetCookie(app: import('express').Express) {
    await request(app).post('/api/v1/auth/register').send({
      username: 'iris',
      displayName: 'Iris',
      email: 'iris@example.com',
      password: 'supersecret123',
    });
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'iris@example.com', password: 'supersecret123', rememberMe: true });
    const cookie = (loginRes.headers['set-cookie'] as unknown as string[]).find((c: string) =>
      c.startsWith('refreshToken=')
    );
    return cookie as string;
  }

  async function registerAndLoginWithRememberMe(
    app: import('express').Express,
    rememberMe: boolean
  ) {
    await request(app).post('/api/v1/auth/register').send({
      username: 'jasper',
      displayName: 'Jasper',
      email: 'jasper@example.com',
      password: 'supersecret123',
    });
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'jasper@example.com', password: 'supersecret123', rememberMe });
    const cookie = (loginRes.headers['set-cookie'] as unknown as string[]).find((c: string) =>
      c.startsWith('refreshToken=')
    );
    return cookie as string;
  }

  it('issues a new access token given a valid refresh cookie', async () => {
    const app = (await import('../../src/app')).default;
    const cookie = await loginAndGetCookie(app);

    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('tolerates concurrent refreshes from tabs sharing the same rotating cookie', async () => {
    const app = (await import('../../src/app')).default;
    const cookie = await loginAndGetCookie(app);

    const [first, second] = await Promise.all([
      request(app).post('/api/v1/auth/refresh').set('Cookie', cookie),
      request(app).post('/api/v1/auth/refresh').set('Cookie', cookie),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.accessToken).toEqual(expect.any(String));
    expect(second.body.accessToken).toEqual(expect.any(String));
  });

  it('rejects refresh with 403 when the account has been suspended since login', async () => {
    const app = (await import('../../src/app')).default;
    const User = (await import('../../src/models/User')).default;
    const cookie = await loginAndGetCookie(app);

    await User.updateOne({ email: 'iris@example.com' }, { status: 'suspended' });

    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(403);
  });

  it('rejects refresh with no cookie with 401', async () => {
    const app = (await import('../../src/app')).default;

    const res = await request(app).post('/api/v1/auth/refresh');

    expect(res.status).toBe(401);
  });

  it('revokes the session on logout so it can no longer be refreshed', async () => {
    const app = (await import('../../src/app')).default;
    const cookie = await loginAndGetCookie(app);

    const logoutRes = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(logoutRes.status).toBe(204);

    const refreshRes = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refreshRes.status).toBe(401);
  });

  it('preserves a session-only cookie (no Max-Age/Expires) across refresh when rememberMe was false at login', async () => {
    const app = (await import('../../src/app')).default;
    const cookie = await registerAndLoginWithRememberMe(app, false);
    expect(cookie).not.toMatch(/max-age|expires/i);

    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(200);

    const newCookie = (res.headers['set-cookie'] as unknown as string[]).find((c: string) =>
      c.startsWith('refreshToken=')
    );
    expect(newCookie).toBeDefined();
    expect(newCookie).not.toMatch(/max-age|expires/i);
  });

  it('preserves a persistent cookie (Max-Age/Expires) across refresh when rememberMe was true at login', async () => {
    const app = (await import('../../src/app')).default;
    const cookie = await registerAndLoginWithRememberMe(app, true);
    expect(cookie).toMatch(/max-age|expires/i);

    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(200);

    const newCookie = (res.headers['set-cookie'] as unknown as string[]).find((c: string) =>
      c.startsWith('refreshToken=')
    );
    expect(newCookie).toBeDefined();
    expect(newCookie).toMatch(/max-age|expires/i);
  });
});
