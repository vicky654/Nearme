import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import User from '../../src/models/User';
import Friendship from '../../src/models/Friendship';
import Conversation from '../../src/models/Conversation';
import Message from '../../src/models/Message';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';
import { signAccessToken } from '../../src/services/tokenService';
import { access, unlink } from 'fs/promises';
import path from 'path';
import { chatUploadDirectory } from '../../src/middleware/chatUpload';

describe('Chat API', () => {
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;
  let uploadedPath: string | null = null;

  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    if (uploadedPath) await unlink(uploadedPath).catch(() => undefined);
    uploadedPath = null;
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

  it('rejects starting a chat between non-connected users', async () => {
    const res = await request(app)
      .post('/api/v1/chats')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ recipientId: userB._id.toString() });

    expect(res.status).toBe(403);
  });

  it('creates conversation and handles messages for connected friends', async () => {
    // Establish accepted friendship
    await Friendship.create({
      requesterId: userA._id,
      recipientId: userB._id,
      status: 'accepted',
    });

    // Create conversation
    const convRes = await request(app)
      .post('/api/v1/chats')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ recipientId: userB._id.toString() });

    expect(convRes.status).toBe(201);
    const convId = convRes.body.conversation._id;

    const outsider = await User.create({
      username: 'charlie',
      displayName: 'Charlie',
      email: 'charlie@example.com',
      avatarUrl: 'https://example.com/charlie.png',
    });
    const outsiderToken = signAccessToken(outsider._id.toString());
    const unauthorizedRead = await request(app)
      .post(`/api/v1/chats/${convId}/read`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(unauthorizedRead.status).toBe(404);

    const uploadRes = await request(app)
      .post(`/api/v1/chats/${convId}/attachments`)
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('attachment', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), { filename: 'photo.jpg', contentType: 'image/jpeg' });
    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.attachment).toEqual(expect.objectContaining({ type: 'image', name: 'photo.jpg' }));
    const messageAttachmentPath = path.join(chatUploadDirectory, path.basename(uploadRes.body.attachment.url));
    uploadedPath = messageAttachmentPath;

    // Send message
    const msgRes = await request(app)
      .post(`/api/v1/chats/${convId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: 'Hello Bob!', attachments: [uploadRes.body.attachment] });

    expect(msgRes.status).toBe(201);
    expect(msgRes.body.message.content).toBe('Hello Bob!');
    const msgId = msgRes.body.message._id;

    // Fetch messages
    const getMsgRes = await request(app)
      .get(`/api/v1/chats/${convId}/messages`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(getMsgRes.status).toBe(200);
    expect(getMsgRes.body.messages.length).toBe(1);

    // Edit message
    const editRes = await request(app)
      .patch(`/api/v1/chats/${convId}/messages/${msgId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: 'Hello Bob! (edited)' });

    expect(editRes.status).toBe(200);
    expect(editRes.body.message.content).toBe('Hello Bob! (edited)');

    // Mark as read
    const readRes = await request(app)
      .post(`/api/v1/chats/${convId}/read`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(readRes.status).toBe(200);

    // Delete message
    const delMsgRes = await request(app)
      .delete(`/api/v1/chats/${convId}/messages/${msgId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(delMsgRes.status).toBe(200);
    expect(delMsgRes.body.message.deletedAt).toBeDefined();
    await expect(access(messageAttachmentPath)).rejects.toBeDefined();
    uploadedPath = null;
  });
});
