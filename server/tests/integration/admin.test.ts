import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import User from '../../src/models/User';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';
import { signAccessToken } from '../../src/services/tokenService';
import { seedAdminUser } from '../../src/services/adminSeedService';

describe('Admin Panel API & Authorization', () => {
  let adminUser: any;
  let regularUser: any;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    await seedAdminUser();

    adminUser = await User.findOne({ role: 'admin' });
    adminToken = signAccessToken(adminUser._id.toString());

    regularUser = await User.create({
      username: 'john_doe',
      displayName: 'John Doe',
      email: 'john@example.com',
      avatarUrl: 'https://example.com/john.png',
      role: 'user',
    });
    userToken = signAccessToken(regularUser._id.toString());
  });

  it('rejects regular users with 403 on admin endpoints', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it('allows admin users to fetch system stats', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.stats.totalUsers).toBe(2);
  });

  it('allows admin users to suspend and activate user accounts', async () => {
    const suspendRes = await request(app)
      .patch(`/api/v1/admin/users/${regularUser._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'suspended' });

    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.user.status).toBe('suspended');

    const activateRes = await request(app)
      .patch(`/api/v1/admin/users/${regularUser._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' });

    expect(activateRes.status).toBe(200);
    expect(activateRes.body.user.status).toBe('active');
  });
});
