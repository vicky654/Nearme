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
    hideOnlineStatus: boolean;
    activeConversationId?: string;
  };
}

const onlineUsersMap = new Map<string, Set<string>>();
const TYPING_IDLE_MS = 4_000;

export function isUserOnline(userId: string): boolean {
  const sockets = onlineUsersMap.get(userId.toString());
  return Boolean(sockets && sockets.size > 0);
}

let ioInstance: Server | null = null;

export function getIO(): Server | null {
  return ioInstance;
}

async function getConversationPresence(io: Server, userId: string, conversationId: string) {
  const sockets = await io.in(`user:${userId}`).fetchSockets();
  return {
    isOnline: sockets.length > 0,
    isViewing: sockets.some((candidate) => candidate.data.activeConversationId === conversationId),
  };
}

function emitToParticipants(io: Server, participantIds: string[], event: string, payload: unknown) {
  participantIds.forEach((participantId) => io.to(`user:${participantId}`).emit(event, payload));
}

export function setupSocketIO(server: HttpServer): Server {
  const io = new Server(server, {
    cors: {
      origin: (requestOrigin, callback) => {
        if (isAllowedOrigin(requestOrigin)) callback(null, true);
        else callback(new Error('CORS error: Origin not allowed for socket'));
      },
      credentials: true,
    },
  });
  ioInstance = io;

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('Authentication token required'));

      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub).select('username displayName privacy.hideOnlineStatus');
      if (!user) return next(new Error('User not found'));

      socket.data.userId = payload.sub;
      socket.data.username = user.username;
      socket.data.displayName = user.displayName;
      socket.data.hideOnlineStatus = Boolean(user.privacy?.hideOnlineStatus);
      next();
    } catch {
      next(new Error('Invalid access token'));
    }
  });

  io.on('connection', async (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const userId = socket.data.userId;
    let typingTimer: ReturnType<typeof setTimeout> | null = null;
    let recentMessageTimes: number[] = [];

    let userSockets = onlineUsersMap.get(userId);
    if (!userSockets) {
      userSockets = new Set();
      onlineUsersMap.set(userId, userSockets);
    }
    userSockets.add(socket.id);
    socket.join(`user:${userId}`);

    let friendIds: string[] = [];
    const initializePresence = async () => {
      await User.findByIdAndUpdate(userId, { lastSeenAt: new Date() });
      const friendships = await Friendship.find({
        $or: [{ requesterId: userId }, { recipientId: userId }],
        status: 'accepted',
      });
      friendIds = friendships.map((friendship) =>
        friendship.requesterId.toString() === userId
          ? friendship.recipientId.toString()
          : friendship.requesterId.toString()
      );

      if (!socket.data.hideOnlineStatus) {
        friendIds.forEach((friendId) => {
          io.to(`user:${friendId}`).emit('presence:update', { userId, isOnline: true });
        });
      }

      const visibleFriends = await User.find({ _id: { $in: friendIds }, 'privacy.hideOnlineStatus': { $ne: true } })
        .select('_id lastSeenAt');
      socket.emit('presence:snapshot', {
        users: visibleFriends.map((friend) => ({
          userId: friend._id.toString(),
          isOnline: isUserOnline(friend._id.toString()),
          lastSeenAt: friend.lastSeenAt,
        })),
      });

      const conversations = await Conversation.find({ participants: userId }).select('_id participants');
      await Promise.all(conversations.map(async (conversation) => {
        const result = await Message.updateMany(
          { conversationId: conversation._id, senderId: { $ne: userId }, status: 'sent' },
          { $set: { status: 'delivered' } }
        );
        if (result.modifiedCount > 0) {
          emitToParticipants(
            io,
            conversation.participants.map((participantId) => participantId.toString()),
            'message:status_update',
            { conversationId: conversation._id.toString(), deliveredToUserId: userId, status: 'delivered' }
          );
        }
      }));
    };

    const stopTyping = () => {
      if (typingTimer) clearTimeout(typingTimer);
      typingTimer = null;
      const conversationId = socket.data.activeConversationId;
      if (conversationId) {
        socket.to(`chat:${conversationId}`).emit('typing:user_stop', { conversationId, userId });
      }
    };

    socket.on('presence:get', async () => {
      const relationships = await Friendship.find({
        $or: [{ requesterId: userId }, { recipientId: userId }],
        status: 'accepted',
      });
      const ids = relationships.map((friendship) =>
        friendship.requesterId.toString() === userId
          ? friendship.recipientId.toString()
          : friendship.requesterId.toString()
      );
      const friends = await User.find({ _id: { $in: ids }, 'privacy.hideOnlineStatus': { $ne: true } }).select('_id lastSeenAt');
      socket.emit('presence:snapshot', {
        users: friends.map((friend) => ({
          userId: friend._id.toString(),
          isOnline: isUserOnline(friend._id.toString()),
          lastSeenAt: friend.lastSeenAt,
        })),
      });
    });

    socket.on('chat:join', async (conversationId: string, ack?: (response: { success: boolean }) => void) => {
      if (!conversationId) return ack?.({ success: false });
      const conversation = await Conversation.findOne({ _id: conversationId, participants: userId }).select('_id');
      if (!conversation) return ack?.({ success: false });

      if (socket.data.activeConversationId && socket.data.activeConversationId !== conversationId) {
        stopTyping();
        socket.leave(`chat:${socket.data.activeConversationId}`);
      }
      socket.data.activeConversationId = conversationId;
      socket.join(`chat:${conversationId}`);
      ack?.({ success: true });
    });

    socket.on('chat:leave', (conversationId: string, ack?: (response: { success: boolean }) => void) => {
      if (!conversationId) return ack?.({ success: false });
      if (socket.data.activeConversationId === conversationId) {
        stopTyping();
        socket.data.activeConversationId = undefined;
      }
      socket.leave(`chat:${conversationId}`);
      ack?.({ success: true });
    });

    socket.on('message:send', async (
      payload: {
        conversationId: string;
        content: string;
        clientId?: string;
        replyToId?: string;
        attachments?: Array<{ type: 'image' | 'audio' | 'file'; url: string; name: string; mimeType: string; size: number }>;
      },
      ack?: (response: { success?: boolean; message?: unknown; error?: string }) => void
    ) => {
      try {
        const now = Date.now();
        recentMessageTimes = recentMessageTimes.filter((timestamp) => now - timestamp < 10_000);
        if (recentMessageTimes.length >= 20) return ack?.({ error: 'You’re sending messages too quickly' });
        recentMessageTimes.push(now);
        const { conversationId, clientId, replyToId } = payload;
        const attachments = Array.isArray(payload.attachments) ? payload.attachments.slice(0, 4) : [];
        const validAttachments = attachments.every((attachment) =>
          ['image', 'audio', 'file'].includes(attachment.type)
          && /\/uploads\/chat\/[a-zA-Z0-9._-]+$/.test(attachment.url)
          && typeof attachment.name === 'string'
          && typeof attachment.mimeType === 'string'
          && Number.isFinite(attachment.size)
          && attachment.size <= 8 * 1024 * 1024
        );
        if (!validAttachments) return ack?.({ error: 'Invalid attachment' });
        const content = payload.content?.trim() || (attachments[0]?.type === 'image' ? 'Photo' : attachments[0]?.type === 'audio' ? 'Voice message' : attachments[0] ? 'Attachment' : '');
        if (!conversationId || !content) return ack?.({ error: 'Conversation ID and content required' });
        if (content.length > 4000) return ack?.({ error: 'Message is too long' });

        const conversation = await Conversation.findOne({ _id: conversationId, participants: userId });
        if (!conversation) return ack?.({ error: 'Conversation not found or unauthorized' });

        if (clientId) {
          const existing = await Message.findOne({ senderId: userId, clientId })
            .populate('senderId', 'username displayName avatarUrl')
            .populate({ path: 'replyTo', select: 'senderId content deletedAt', populate: { path: 'senderId', select: 'username displayName avatarUrl' } });
          if (existing) return ack?.({ success: true, message: existing });
        }

        if (replyToId && !(await Message.exists({ _id: replyToId, conversationId }))) {
          return ack?.({ error: 'Reply message was not found' });
        }

        const participantIds = conversation.participants.map((participantId) => participantId.toString());
        const recipientIds = participantIds.filter((participantId) => participantId !== userId);
        const recipientPresence = await Promise.all(
          recipientIds.map(async (recipientId) => ({
            recipientId,
            ...(await getConversationPresence(io, recipientId, conversationId)),
          }))
        );
        const activeRecipientIds = recipientPresence.filter((state) => state.isViewing).map((state) => state.recipientId);
        const allRecipientsViewing = recipientIds.length > 0 && activeRecipientIds.length === recipientIds.length;
        const allRecipientsOnline = recipientIds.length > 0 && recipientPresence.every((state) => state.isOnline);

        const message = await Message.create({
          conversationId: conversation._id,
          senderId: userId,
          clientId,
          content,
          replyTo: replyToId || undefined,
          attachments,
          status: allRecipientsViewing ? 'seen' : allRecipientsOnline ? 'delivered' : 'sent',
          readBy: [userId, ...activeRecipientIds],
        });
        await message.populate('senderId', 'username displayName avatarUrl');
        await message.populate({ path: 'replyTo', select: 'senderId content deletedAt', populate: { path: 'senderId', select: 'username displayName avatarUrl' } });

        conversation.lastMessage = message._id as any;
        conversation.lastMessageAt = message.createdAt;
        await conversation.save();

        io.to(`chat:${conversationId}`).emit('message:new', { message, conversationId });
        participantIds.forEach((participantId) => {
          const isActiveRecipient = activeRecipientIds.includes(participantId);
          io.to(`user:${participantId}`).emit('conversation:updated', {
            conversationId,
            message,
            unreadDelta: participantId === userId || isActiveRecipient ? 0 : 1,
          });
        });

        const sender = message.senderId as any;
        const senderName = sender?.displayName || socket.data.displayName || 'Someone';
        await Promise.all(recipientPresence
          .filter((state) => !state.isViewing)
          .map((state) => createAndEmitNotification({
            receiverId: state.recipientId,
            senderId: userId,
            type: 'new_message',
            title: `New message from ${senderName}`,
            message: content,
            relatedId: conversationId,
          })));

        ack?.({ success: true, message });
      } catch {
        ack?.({ error: 'Failed to send message' });
      }
    });

    socket.on('message:read', async (payload: { conversationId: string }) => {
      try {
        const { conversationId } = payload;
        const conversation = await Conversation.findOne({ _id: conversationId, participants: userId });
        if (!conversation || socket.data.activeConversationId !== conversationId) return;

        await Message.updateMany(
          { conversationId, senderId: { $ne: userId }, readBy: { $ne: userId } },
          { $addToSet: { readBy: userId }, $set: { status: 'seen' } }
        );
        emitToParticipants(
          io,
          conversation.participants.map((participantId) => participantId.toString()),
          'message:status_update',
          { conversationId, readByUserId: userId, status: 'seen' }
        );
      } catch {
        // Read receipts are best effort and are reconciled by the REST endpoint.
      }
    });

    socket.on('message:react', async (
      payload: { conversationId: string; messageId: string; emoji: string },
      ack?: (response: { success?: boolean; message?: unknown; error?: string }) => void
    ) => {
      try {
        const { conversationId, messageId, emoji } = payload;
        if (!emoji || emoji.length > 16) return ack?.({ error: 'Invalid reaction' });
        const conversation = await Conversation.findOne({ _id: conversationId, participants: userId });
        if (!conversation) return ack?.({ error: 'Conversation not found or unauthorized' });
        const message = await Message.findOne({ _id: messageId, conversationId });
        if (!message) return ack?.({ error: 'Message not found' });

        const existingIndex = message.reactions.findIndex(
          (reaction) => reaction.userId.toString() === userId && reaction.emoji === emoji
        );
        if (existingIndex >= 0) message.reactions.splice(existingIndex, 1);
        else message.reactions.push({ userId: userId as any, emoji });
        await message.save();
        await message.populate('senderId', 'username displayName avatarUrl');
        await message.populate({ path: 'replyTo', select: 'senderId content deletedAt', populate: { path: 'senderId', select: 'username displayName avatarUrl' } });

        emitToParticipants(io, conversation.participants.map((participantId) => participantId.toString()), 'message:updated', {
          conversationId,
          message,
        });
        ack?.({ success: true, message });
      } catch {
        ack?.({ error: 'Unable to update reaction' });
      }
    });

    socket.on('typing:start', (conversationId: string) => {
      if (!conversationId || socket.data.activeConversationId !== conversationId) return;
      socket.to(`chat:${conversationId}`).emit('typing:user_start', {
        conversationId,
        userId,
        displayName: socket.data.displayName,
        activity: 'typing',
      });
      if (typingTimer) clearTimeout(typingTimer);
      typingTimer = setTimeout(stopTyping, TYPING_IDLE_MS);
    });

    socket.on('typing:stop', (conversationId: string) => {
      if (conversationId !== socket.data.activeConversationId) return;
      stopTyping();
    });

    socket.on('recording:start', (conversationId: string) => {
      if (!conversationId || socket.data.activeConversationId !== conversationId) return;
      socket.to(`chat:${conversationId}`).emit('typing:user_start', {
        conversationId,
        userId,
        displayName: socket.data.displayName,
        activity: 'recording',
      });
      if (typingTimer) clearTimeout(typingTimer);
      typingTimer = setTimeout(stopTyping, TYPING_IDLE_MS);
    });

    socket.on('recording:stop', (conversationId: string) => {
      if (conversationId !== socket.data.activeConversationId) return;
      stopTyping();
    });

    void initializePresence().catch(() => undefined);

    socket.on('disconnect', async () => {
      stopTyping();
      const sockets = onlineUsersMap.get(userId);
      if (!sockets) return;
      sockets.delete(socket.id);
      if (sockets.size > 0) return;

      onlineUsersMap.delete(userId);
      const lastSeenAt = new Date();
      await User.findByIdAndUpdate(userId, { lastSeenAt });
      if (!socket.data.hideOnlineStatus) {
        friendIds.forEach((friendId) => {
          io.to(`user:${friendId}`).emit('presence:update', { userId, isOnline: false, lastSeenAt });
        });
      }
    });
  });

  return io;
}
