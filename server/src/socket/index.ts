import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../services/tokenService';
import User from '../models/User';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import Friendship from '../models/Friendship';
import { createAndEmitNotification } from '../services/notificationService';
import { isAllowedOrigin } from '../utils/cors';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    username: string;
    displayName: string;
  };
}

const onlineUsersMap = new Map<string, Set<string>>(); // userId -> Set<socketId>

export function isUserOnline(userId: string): boolean {
  const sockets = onlineUsersMap.get(userId.toString());
  return Boolean(sockets && sockets.size > 0);
}

let ioInstance: Server | null = null;

export function getIO(): Server | null {
  return ioInstance;
}

export function setupSocketIO(server: HttpServer): Server {
  const io = new Server(server, {
    cors: {
      origin: (requestOrigin, callback) => {
        if (isAllowedOrigin(requestOrigin)) {
          callback(null, true);
        } else {
          callback(new Error('CORS error: Origin not allowed for socket'));
        }
      },
      credentials: true,
    },
  });
  ioInstance = io;

  // Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;

      const user = await User.findById(payload.sub).select('username displayName');
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.data.username = user.username;
      socket.data.displayName = user.displayName;
      next();
    } catch (err) {
      next(new Error('Invalid access token'));
    }
  });

  io.on('connection', async (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const userId = socket.data.userId;

    // Track online presence
    let userSockets = onlineUsersMap.get(userId);
    if (!userSockets) {
      userSockets = new Set();
      onlineUsersMap.set(userId, userSockets);
    }
    userSockets.add(socket.id);

    // Join personal user room
    socket.join(`user:${userId}`);

    // Update lastSeenAt & notify friends
    await User.findByIdAndUpdate(userId, { lastSeenAt: new Date() });

    // Notify connected friends that user is online
    const friendships = await Friendship.find({
      $or: [{ requesterId: userId }, { recipientId: userId }],
      status: 'accepted',
    });

    friendships.forEach((f) => {
      const friendId = f.requesterId.toString() === userId ? f.recipientId.toString() : f.requesterId.toString();
      io.to(`user:${friendId}`).emit('presence:update', { userId, isOnline: true });
    });

    // Room join/leave for chats
    socket.on('chat:join', (conversationId: string) => {
      if (conversationId) {
        socket.join(`chat:${conversationId}`);
      }
    });

    socket.on('chat:leave', (conversationId: string) => {
      if (conversationId) {
        socket.leave(`chat:${conversationId}`);
      }
    });

    // Send Message
    socket.on('message:send', async (payload: { conversationId: string; content: string }, ack?: (res: any) => void) => {
      try {
        const { conversationId, content } = payload;
        if (!conversationId || !content || !content.trim()) {
          if (ack) ack({ error: 'Conversation ID and content required' });
          return;
        }

        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: userId,
        });

        if (!conversation) {
          if (ack) ack({ error: 'Conversation not found or unauthorized' });
          return;
        }

        const message = await Message.create({
          conversationId: conversation._id,
          senderId: userId,
          content: content.trim(),
          status: 'sent',
          readBy: [userId],
        });

        await message.populate('senderId', 'username displayName avatarUrl');

        conversation.lastMessage = message._id as any;
        conversation.lastMessageAt = message.createdAt;
        await conversation.save();

        // Broadcast message to room
        io.to(`chat:${conversationId}`).emit('message:new', { message, conversationId });

        // Broadcast persistent in-app & socket notification to recipients outside the room
        const senderObj = message.senderId as any;
        const senderName = senderObj?.displayName || socket.data.displayName || 'Someone';

        for (const pId of conversation.participants) {
          if (pId.toString() !== userId) {
            await createAndEmitNotification({
              receiverId: pId.toString(),
              senderId: userId,
              type: 'new_message',
              title: `New Message from ${senderName}`,
              message: content.trim(),
              relatedId: conversationId,
            });
          }
        }

        if (ack) ack({ success: true, message });
      } catch (err) {
        if (ack) ack({ error: 'Failed to send message' });
      }
    });

    // Read receipts
    socket.on('message:read', async (payload: { conversationId: string }) => {
      try {
        const { conversationId } = payload;
        await Message.updateMany(
          {
            conversationId,
            senderId: { $ne: userId },
            readBy: { $ne: userId },
          },
          {
            $addToSet: { readBy: userId },
            $set: { status: 'seen' },
          }
        );

        io.to(`chat:${conversationId}`).emit('message:status_update', {
          conversationId,
          readByUserId: userId,
          status: 'seen',
        });
      } catch (err) {
        // Silent error handling
      }
    });

    // Typing indicators
    socket.on('typing:start', (conversationId: string) => {
      socket.to(`chat:${conversationId}`).emit('typing:user_start', {
        conversationId,
        userId,
        displayName: socket.data.displayName,
      });
    });

    socket.on('typing:stop', (conversationId: string) => {
      socket.to(`chat:${conversationId}`).emit('typing:user_stop', {
        conversationId,
        userId,
      });
    });

    // Disconnect
    socket.on('disconnect', async () => {
      const userSockets = onlineUsersMap.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsersMap.delete(userId);
          await User.findByIdAndUpdate(userId, { lastSeenAt: new Date() });

          friendships.forEach((f) => {
            const friendId = f.requesterId.toString() === userId ? f.recipientId.toString() : f.requesterId.toString();
            io.to(`user:${friendId}`).emit('presence:update', { userId, isOnline: false, lastSeenAt: new Date() });
          });
        }
      }
    });
  });

  return io;
}
