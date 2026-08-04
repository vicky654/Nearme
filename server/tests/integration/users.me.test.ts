import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';

vi.mock('../../src/services/emailService', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('/api/v1/users/me', () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  async function registerAndLogin(app: import('express').Express) {
    await request(app).post('/api/v1/auth/register').send({
      username: 'nina',
      displayName: 'Nina',
      email: 'nina@example.com',
      password: 'supersecret123',
    });
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nina@example.com', password: 'supersecret123' });
    return loginRes.body.accessToken as string;
  }

  it('rejects unauthenticated requests with 401', async () => {
    const app = (await import('../../src/app')).default;
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user profile when authenticated', async () => {
    const app = (await import('../../src/app')).default;
    const accessToken = await registerAndLogin(app);

    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('nina');
  });

  it('updates allowed profile fields', async () => {
    const app = (await import('../../src/app')).default;
    const accessToken = await registerAndLogin(app);

    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ bio: 'Hello world', interests: ['hiking', 'chess'] });

    expect(res.status).toBe(200);
    expect(res.body.user.bio).toBe('Hello world');
    expect(res.body.user.interests).toEqual(['hiking', 'chess']);
  });

  it('changes the password given the correct current password', async () => {
    const app = (await import('../../src/app')).default;
    const accessToken = await registerAndLogin(app);

    const res = await request(app)
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'supersecret123', newPassword: 'new-password-789' });

    expect(res.status).toBe(200);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nina@example.com', password: 'new-password-789' });
    expect(loginRes.status).toBe(200);
  });

  it('revokes other active sessions (the refresh cookie) on a successful password change', async () => {
    const app = (await import('../../src/app')).default;

    await request(app).post('/api/v1/auth/register').send({
      username: 'oscar',
      displayName: 'Oscar',
      email: 'oscar@example.com',
      password: 'supersecret123',
    });
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'oscar@example.com', password: 'supersecret123' });
    const accessToken = loginRes.body.accessToken as string;
    const refreshCookie = (loginRes.headers['set-cookie'] as unknown as string[]).find((c: string) =>
      c.startsWith('refreshToken=')
    ) as string;

    const changeRes = await request(app)
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'supersecret123', newPassword: 'new-password-999' });
    expect(changeRes.status).toBe(200);

    const refreshRes = await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie);
    expect(refreshRes.status).toBe(401);
  });

  it('rejects password change with an incorrect current password', async () => {
    const app = (await import('../../src/app')).default;
    const accessToken = await registerAndLogin(app);

    const res = await request(app)
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'totally-wrong', newPassword: 'new-password-789' });

    expect(res.status).toBe(401);
  });

  it('gets and updates settings (theme + privacy)', async () => {
    const app = (await import('../../src/app')).default;
    const accessToken = await registerAndLogin(app);

    const getRes = await request(app)
      .get('/api/v1/users/me/settings')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.theme).toBe('system');
    expect(getRes.body.privacy.invisibleMode).toBe(false);

    const patchRes = await request(app)
      .patch('/api/v1/users/me/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ theme: 'dark', privacy: { invisibleMode: true } });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.theme).toBe('dark');
    expect(patchRes.body.privacy.invisibleMode).toBe(true);
    expect(patchRes.body.privacy.hideDistance).toBe(false);
  });
});
