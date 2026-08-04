import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';

vi.mock('../../src/services/emailService', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('POST /api/v1/auth/google', () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
    vi.doUnmock('../../src/services/googleAuthService');
    vi.resetModules();
  });

  it('returns 503 when Google login is not configured', async () => {
    const app = (await import('../../src/app')).default;

    const res = await request(app).post('/api/v1/auth/google').send({ idToken: 'whatever' });

    expect(res.status).toBe(503);
  });

  it('creates a new user on first Google login', async () => {
    vi.doMock('../../src/services/googleAuthService', () => ({
      isGoogleLoginEnabled: () => true,
      verifyGoogleIdToken: vi.fn().mockResolvedValue({
        googleId: 'google-sub-999',
        email: 'liam@example.com',
        name: 'Liam',
        picture: 'https://example.com/liam.png',
      }),
    }));
    vi.resetModules();

    const app = (await import('../../src/app')).default;
    const res = await request(app).post('/api/v1/auth/google').send({ idToken: 'fake' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('liam@example.com');
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('sets a persistent refresh cookie on Google login, and that persists across a subsequent refresh', async () => {
    vi.doMock('../../src/services/googleAuthService', () => ({
      isGoogleLoginEnabled: () => true,
      verifyGoogleIdToken: vi.fn().mockResolvedValue({
        googleId: 'google-sub-777',
        email: 'noah@example.com',
        name: 'Noah',
        picture: undefined,
      }),
    }));
    vi.resetModules();

    const app = (await import('../../src/app')).default;
    const res = await request(app).post('/api/v1/auth/google').send({ idToken: 'fake' });

    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const refreshCookie = setCookie.find((c: string) => c.startsWith('refreshToken='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/max-age|expires/i);

    // The real regression: rememberMe must have been persisted on the UserSession
    // itself, not just reflected in this first Set-Cookie header. Refresh and
    // confirm the NEW cookie is still persistent.
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie as string);
    expect(refreshRes.status).toBe(200);
    const newSetCookie = refreshRes.headers['set-cookie'] as unknown as string[];
    const newRefreshCookie = newSetCookie.find((c: string) => c.startsWith('refreshToken='));
    expect(newRefreshCookie).toBeDefined();
    expect(newRefreshCookie).toMatch(/max-age|expires/i);
  });

  it('logs in the existing user on a repeat Google login', async () => {
    vi.doMock('../../src/services/googleAuthService', () => ({
      isGoogleLoginEnabled: () => true,
      verifyGoogleIdToken: vi.fn().mockResolvedValue({
        googleId: 'google-sub-888',
        email: 'mia@example.com',
        name: 'Mia',
        picture: undefined,
      }),
    }));
    vi.resetModules();

    const app = (await import('../../src/app')).default;
    const firstRes = await request(app).post('/api/v1/auth/google').send({ idToken: 'fake' });
    const secondRes = await request(app).post('/api/v1/auth/google').send({ idToken: 'fake' });

    expect(firstRes.status).toBe(200);
    expect(secondRes.status).toBe(200);
    expect(firstRes.body.user.id).toBe(secondRes.body.user.id);
  });

  it('sets emailVerifiedAt when linking an existing password account to Google by email', async () => {
    const User = (await import('../../src/models/User')).default;
    const { hashPassword } = await import('../../src/services/passwordService');

    const existing = await User.create({
      username: 'oliver',
      displayName: 'Oliver',
      email: 'oliver@example.com',
      passwordHash: await hashPassword('some-password-123'),
      avatarUrl: 'https://example.com/default-avatar.png',
    });
    expect(existing.emailVerifiedAt).toBeNull();

    vi.doMock('../../src/services/googleAuthService', () => ({
      isGoogleLoginEnabled: () => true,
      verifyGoogleIdToken: vi.fn().mockResolvedValue({
        googleId: 'google-sub-555',
        email: 'oliver@example.com',
        name: 'Oliver',
        picture: undefined,
      }),
    }));
    vi.resetModules();

    const app = (await import('../../src/app')).default;
    const res = await request(app).post('/api/v1/auth/google').send({ idToken: 'fake' });

    expect(res.status).toBe(200);
    expect(res.body.user.emailVerifiedAt).toEqual(expect.any(String));

    const UserReloaded = (await import('../../src/models/User')).default;
    const reloaded = await UserReloaded.findById(existing.id);
    expect(reloaded?.emailVerifiedAt).not.toBeNull();
  });
});
