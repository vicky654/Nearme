import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import User from '../../src/models/User';
import Friendship from '../../src/models/Friendship';
import BlockedUser from '../../src/models/BlockedUser';
import Report from '../../src/models/Report';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';
import { signAccessToken } from '../../src/services/tokenService';

describe('Friends & Connection System API', () => {
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    userA = await User.create({
      username: 'alice',
      displayName: 'Alice',
      email: 'alice@example.com',
      avatarUrl: 'https://example.com/alice.png',
      interests: ['Coding', 'Music'],
    });

    userB = await User.create({
      username: 'bob',
      displayName: 'Bob',
      email: 'bob@example.com',
      avatarUrl: 'https://example.com/bob.png',
      interests: ['Coding', 'Gaming'],
    });

    tokenA = signAccessToken(userA._id.toString());
    tokenB = signAccessToken(userB._id.toString());
  });

  it('sends, accepts, and retrieves friends', async () => {
    // User A sends request to User B
    const sendRes = await request(app)
      .post('/api/v1/friends/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ targetUserId: userB._id.toString() });

    expect(sendRes.status).toBe(201);
    expect(sendRes.body.friendship.status).toBe('pending');

    // Get pending requests for User B
    const reqRes = await request(app)
      .get('/api/v1/friends/requests')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(reqRes.status).toBe(200);
    expect(reqRes.body.incoming.length).toBe(1);
    const requestId = reqRes.body.incoming[0].id;

    // User B accepts request
    const acceptRes = await request(app)
      .post('/api/v1/friends/accept')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ requestId });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.friendship.status).toBe('accepted');

    // Get friends for User A
    const friendsRes = await request(app)
      .get('/api/v1/friends')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(friendsRes.status).toBe(200);
    expect(friendsRes.body.friends.length).toBe(1);
    expect(friendsRes.body.friends[0].user.username).toBe('bob');
  });

  it('allows blocking and unblocking a user', async () => {
    // User A blocks User B
    const blockRes = await request(app)
      .post('/api/v1/friends/block')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ targetUserId: userB._id.toString() });

    expect(blockRes.status).toBe(200);

    // Try sending friend request while blocked
    const sendRes = await request(app)
      .post('/api/v1/friends/request')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ targetUserId: userA._id.toString() });

    expect(sendRes.status).toBe(403);

    // User A unblocks User B
    const unblockRes = await request(app)
      .post('/api/v1/friends/unblock')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ targetUserId: userB._id.toString() });

    expect(unblockRes.status).toBe(200);
  });

  it('submits safety report', async () => {
    const reportRes = await request(app)
      .post('/api/v1/friends/report')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        targetUserId: userB._id.toString(),
        reason: 'harassment',
        details: 'Spamming inappropriate messages',
      });

    expect(reportRes.status).toBe(201);
    const count = await Report.countDocuments({ reporterId: userA._id });
    expect(count).toBe(1);
  });
});
