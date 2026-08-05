import http from 'http';
import type { AddressInfo } from 'net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { io as createClient, type Socket } from 'socket.io-client';
import app from '../../src/app';
import { setupSocketIO } from '../../src/socket';
import User from '../../src/models/User';
import Friendship from '../../src/models/Friendship';
import Conversation from '../../src/models/Conversation';
import Message from '../../src/models/Message';
import Notification from '../../src/models/Notification';
import { signAccessToken } from '../../src/services/tokenService';
import { clearTestDb, startTestDb, stopTestDb } from '../helpers/testDb';

describe('Chat socket behavior', () => {
  const server = http.createServer(app);
  const socketServer = setupSocketIO(server);
  let baseUrl = '';
  let sockets: Socket[] = [];

  beforeAll(async () => {
    await startTestDb();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    sockets.forEach((socket) => socket.disconnect());
    await new Promise<void>((resolve) => socketServer.close(() => resolve()));
    await stopTestDb();
  });

  beforeEach(async () => {
    sockets.forEach((socket) => socket.disconnect());
    sockets = [];
    await clearTestDb();
  });

  async function connect(token: string) {
    const socket = createClient(baseUrl, { auth: { token }, transports: ['websocket'] });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    return socket;
  }

  function emitWithAck<T>(socket: Socket, event: string, payload: unknown) {
    return new Promise<T>((resolve, reject) => {
      socket.timeout(5_000).emit(event, payload, (error: Error | null, response: T) => {
        if (error) reject(new Error(`${event}: ${error.message}`));
        else resolve(response);
      });
    });
  }

  it('suppresses notifications in the visible conversation and reconciles idempotent sends', async () => {
    const alice = await User.create({ username: 'alice', displayName: 'Alice', email: 'alice.socket@example.com', avatarUrl: 'https://example.com/a.png' });
    const bob = await User.create({ username: 'bob', displayName: 'Bob', email: 'bob.socket@example.com', avatarUrl: 'https://example.com/b.png' });
    await Friendship.create({ requesterId: alice._id, recipientId: bob._id, status: 'accepted' });
    const conversation = await Conversation.create({ participants: [alice._id, bob._id] });

    const aliceSocket = await connect(signAccessToken(alice._id.toString()));
    const bobSocket = await connect(signAccessToken(bob._id.toString()));
    await emitWithAck(aliceSocket, 'chat:join', conversation._id.toString());
    await emitWithAck(bobSocket, 'chat:join', conversation._id.toString());

    let bobNotificationCount = 0;
    bobSocket.on('notification:new', () => { bobNotificationCount += 1; });
    const activeResponse = await emitWithAck<{ success: boolean; message: { _id: string; status: string; readBy: string[] } }>(aliceSocket, 'message:send', {
      conversationId: conversation._id.toString(),
      clientId: 'active-message-1',
      content: 'Visible message',
    });

    expect(activeResponse.success).toBe(true);
    expect(activeResponse.message.status).toBe('seen');
    expect(activeResponse.message.readBy).toHaveLength(2);
    expect(bobNotificationCount).toBe(0);
    expect(await Notification.countDocuments()).toBe(0);

    const reactionResponse = await emitWithAck<{ success: boolean; message: { reactions: Array<{ emoji: string }> } }>(bobSocket, 'message:react', {
      conversationId: conversation._id.toString(),
      messageId: activeResponse.message._id,
      emoji: '❤️',
    });
    expect(reactionResponse.success).toBe(true);
    expect(reactionResponse.message.reactions).toHaveLength(1);

    await emitWithAck(bobSocket, 'chat:leave', conversation._id.toString());
    const notificationPromise = new Promise<void>((resolve) => bobSocket.once('notification:new', () => resolve()));
    const inactiveResponse = await emitWithAck<{ success: boolean; message: { _id: string; status: string } }>(aliceSocket, 'message:send', {
      conversationId: conversation._id.toString(),
      clientId: 'inactive-message-1',
      content: 'Background message',
    });
    await notificationPromise;

    expect(inactiveResponse.message.status).toBe('delivered');
    expect(await Notification.countDocuments({ receiverId: bob._id })).toBe(1);

    const duplicateResponse = await emitWithAck<{ success: boolean; message: { _id: string } }>(aliceSocket, 'message:send', {
      conversationId: conversation._id.toString(),
      clientId: 'inactive-message-1',
      content: 'Background message',
    });
    expect(duplicateResponse.message._id.toString()).toBe(inactiveResponse.message._id.toString());
    expect(await Message.countDocuments({ conversationId: conversation._id })).toBe(2);
  });

  it('does not publish a stale online event when a socket disconnects during presence initialization', async () => {
    const alice = await User.create({ username: 'alice', displayName: 'Alice', email: 'alice.presence@example.com', avatarUrl: 'https://example.com/a.png' });
    const bob = await User.create({ username: 'bob', displayName: 'Bob', email: 'bob.presence@example.com', avatarUrl: 'https://example.com/b.png' });
    await Friendship.create({ requesterId: alice._id, recipientId: bob._id, status: 'accepted' });

    const bobSocket = await connect(signAccessToken(bob._id.toString()));
    const updates: Array<{ userId: string; isOnline: boolean }> = [];
    bobSocket.on('presence:update', (update) => updates.push(update));

    const aliceSocket = await connect(signAccessToken(alice._id.toString()));
    aliceSocket.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 150));

    const aliceUpdates = updates.filter((update) => update.userId === alice._id.toString());
    expect(aliceUpdates.at(-1)?.isOnline).not.toBe(true);
  });
});
