import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import Friendship from '../models/Friendship';
import BlockedUser from '../models/BlockedUser';
import { AppError } from '../utils/AppError';

export async function getConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;

    const conversations = await Conversation.find({
      participants: userId,
    })
      .sort({ lastMessageAt: -1 })
      .populate('participants', 'username displayName avatarUrl lastSeenAt privacy')
      .populate('lastMessage');

    const result = await Promise.all(
      conversations.map(async (conv) => {
        const recipient = conv.participants.find((p) => p._id.toString() !== userId.toString()) as any;

        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          senderId: { $ne: userId },
          readBy: { $ne: userId },
          deletedAt: null,
        });

        return {
          _id: conv._id,
          recipient: recipient
            ? {
                _id: recipient._id,
                username: recipient.username,
                displayName: recipient.displayName,
                avatarUrl: recipient.avatarUrl,
                lastSeenAt: recipient.privacy?.hideOnlineStatus ? null : recipient.lastSeenAt,
              }
            : null,
          lastMessage: conv.lastMessage,
          lastMessageAt: conv.lastMessageAt,
          unreadCount,
          isMuted: conv.mutedBy.some((id) => id.toString() === userId.toString()),
          isArchived: conv.archivedBy.some((id) => id.toString() === userId.toString()),
          updatedAt: conv.updatedAt,
        };
      })
    );

    res.json({ conversations: result });
  } catch (err) {
    next(err);
  }
}

export async function createOrGetConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { recipientId } = req.body;

    if (!recipientId || !Types.ObjectId.isValid(recipientId)) {
      throw new AppError(400, 'Invalid recipientId');
    }

    if (userId.toString() === recipientId) {
      throw new AppError(400, 'Cannot start a chat with yourself');
    }

    // Check if blocked
    const isBlocked = await BlockedUser.findOne({
      $or: [
        { blockerId: userId, blockedId: recipientId },
        { blockerId: recipientId, blockedId: userId },
      ],
    });

    if (isBlocked) {
      throw new AppError(403, 'Cannot start chat with blocked user');
    }

    // Check connection / friendship
    const isConnected = await Friendship.findOne({
      $or: [
        { requesterId: userId, recipientId, status: 'accepted' },
        { requesterId: recipientId, recipientId: userId, status: 'accepted' },
      ],
    });

    if (!isConnected) {
      throw new AppError(403, 'Only connected friends can start a private chat');
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [userId, recipientId], $size: 2 },
    }).populate('participants', 'username displayName avatarUrl lastSeenAt privacy');

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [userId, recipientId],
      });
      await conversation.populate('participants', 'username displayName avatarUrl lastSeenAt privacy');
    }

    const recipient = conversation.participants.find((p) => p._id.toString() !== userId.toString()) as any;

    res.status(201).json({
      conversation: {
        _id: conversation._id,
        recipient: recipient
          ? {
              _id: recipient._id,
              username: recipient.username,
              displayName: recipient.displayName,
              avatarUrl: recipient.avatarUrl,
              lastSeenAt: recipient.privacy?.hideOnlineStatus ? null : recipient.lastSeenAt,
            }
          : null,
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        unreadCount: 0,
        isMuted: false,
        isArchived: false,
        updatedAt: conversation.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const conversationId = String(req.params.conversationId);
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const before = req.query.before ? new Date(String(req.query.before)) : null;

    if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
      throw new AppError(400, 'Invalid conversationId');
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      throw new AppError(404, 'Conversation not found');
    }

    const queryFilter: any = { conversationId };
    if (before) {
      queryFilter.createdAt = { $lt: before };
    }

    const messages = await Message.find(queryFilter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('senderId', 'username displayName avatarUrl');

    res.json({ messages: messages.reverse() });
  } catch (err) {
    next(err);
  }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { conversationId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      throw new AppError(400, 'Message content cannot be empty');
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      throw new AppError(404, 'Conversation not found');
    }

    const message = await Message.create({
      conversationId: conversation._id,
      senderId: userId,
      content: content.trim(),
      status: 'sent',
      readBy: [userId],
    });

    await message.populate('senderId', 'username displayName avatarUrl');

    conversation.lastMessage = message._id as Types.ObjectId;
    conversation.lastMessageAt = message.createdAt;
    await conversation.save();

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

export async function editMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { conversationId, messageId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      throw new AppError(400, 'Message content cannot be empty');
    }

    const message = await Message.findOne({
      _id: messageId,
      conversationId,
      senderId: userId,
    });

    if (!message) {
      throw new AppError(404, 'Message not found or unauthorized');
    }

    message.content = content.trim();
    message.editedAt = new Date();
    await message.save();

    res.json({ message });
  } catch (err) {
    next(err);
  }
}

export async function deleteMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { conversationId, messageId } = req.params;

    const message = await Message.findOne({
      _id: messageId,
      conversationId,
      senderId: userId,
    });

    if (!message) {
      throw new AppError(404, 'Message not found or unauthorized');
    }

    message.deletedAt = new Date();
    message.content = 'This message was deleted';
    await message.save();

    res.json({ message });
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { conversationId } = req.params;

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

    res.json({ message: 'Conversation marked as read' });
  } catch (err) {
    next(err);
  }
}

export async function toggleMute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { conversationId } = req.params;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      throw new AppError(404, 'Conversation not found');
    }

    const isMuted = conversation.mutedBy.some((id) => id.toString() === userId.toString());
    if (isMuted) {
      conversation.mutedBy = conversation.mutedBy.filter((id) => id.toString() !== userId.toString());
    } else {
      conversation.mutedBy.push(new Types.ObjectId(userId));
    }

    await conversation.save();

    res.json({ isMuted: !isMuted });
  } catch (err) {
    next(err);
  }
}

export async function toggleArchive(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { conversationId } = req.params;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      throw new AppError(404, 'Conversation not found');
    }

    const isArchived = conversation.archivedBy.some((id) => id.toString() === userId.toString());
    if (isArchived) {
      conversation.archivedBy = conversation.archivedBy.filter((id) => id.toString() !== userId.toString());
    } else {
      conversation.archivedBy.push(new Types.ObjectId(userId));
    }

    await conversation.save();

    res.json({ isArchived: !isArchived });
  } catch (err) {
    next(err);
  }
}

export async function deleteConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { conversationId } = req.params;

    await Conversation.findOneAndDelete({
      _id: conversationId,
      participants: userId,
    });

    await Message.deleteMany({ conversationId });

    res.json({ message: 'Conversation deleted' });
  } catch (err) {
    next(err);
  }
}
