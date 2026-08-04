import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import User from '../../src/models/User';
import Friendship from '../../src/models/Friendship';
import Notification from '../../src/models/Notification';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';
import { signAccessToken } from '../../src/services/tokenService';

describe('Real-Time Notification System API', () => {
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
    });

    userB = await User.create({
      username: 'bob',
      displayName: 'Bob',
      email: 'bob@example.com',
      avatarUrl: 'https://example.com/bob.png',
    });

    tokenA = signAccessToken(userA._id.toString());
    tokenB = signAccessToken(userB._id.toString());
  });

  it('automatically creates notification when sending friend request', async () => {
    const sendRes = await request(app)
      .post('/api/v1/friends/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ targetUserId: userB._id.toString() });

    expect(sendRes.status).toBe(201);

    const notifRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(notifRes.status).toBe(200);
    expect(notifRes.body.unreadCount).toBe(1);
    expect(notifRes.body.notifications.length).toBe(1);
    expect(notifRes.body.notifications[0].type).toBe('friend_request_received');
    expect(notifRes.body.notifications[0].title).toBe('New Friend Request');
  });

  it('marks single notification as read', async () => {
    const notif = await Notification.create({
      receiverId: userA._id,
      senderId: userB._id,
      type: 'new_message',
      title: 'New Message',
      message: 'Hello Alice!',
      isRead: false,
    });

    const readRes = await request(app)
      .patch(`/api/v1/notifications/${notif._id}/read`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(readRes.status).toBe(200);
    expect(readRes.body.notification.isRead).toBe(true);
  });

  it('marks all notifications as read', async () => {
    await Notification.create({
      receiverId: userA._id,
      senderId: userB._id,
      type: 'new_message',
      title: 'Message 1',
      message: 'Hi',
      isRead: false,
    });
    await Notification.create({
      receiverId: userA._id,
      senderId: userB._id,
      type: 'friend_request_accepted',
      title: 'Accepted',
      message: 'Bob accepted your request',
      isRead: false,
    });

    const markAllRes = await request(app)
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(markAllRes.status).toBe(200);

    const getRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(getRes.body.unreadCount).toBe(0);
  });
});
