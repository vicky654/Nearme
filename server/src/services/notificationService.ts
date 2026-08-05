import { Types } from 'mongoose';
import Notification, { NotificationType } from '../models/Notification';
import { getIO } from '../socket';
import { sendPushNotification } from './pushService';

export interface CreateNotificationParams {
  receiverId: string | Types.ObjectId;
  senderId: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: string;
}

export async function createAndEmitNotification(params: CreateNotificationParams) {
  const { receiverId, senderId, type, title, message, relatedId } = params;

  // Don't send notification to self
  if (receiverId.toString() === senderId.toString()) {
    return null;
  }

  const notification = await Notification.create({
    receiverId: new Types.ObjectId(receiverId.toString()),
    senderId: new Types.ObjectId(senderId.toString()),
    type,
    title,
    message,
    relatedId,
    isRead: false,
  });

  await notification.populate('senderId', 'username displayName avatarUrl');

  // Broadcast real-time event to receiver via Socket.IO
  const io = getIO();
  if (io) {
    io.to(`user:${receiverId.toString()}`).emit('notification:new', {
      notification,
    });
    // Emit type-specific events for client convenience
    io.to(`user:${receiverId.toString()}`).emit(type, {
      notification,
    });
  }

  void sendPushNotification(receiverId.toString(), {
    title,
    body: message,
    data: {
      type,
      conversationId: type === 'new_message' ? relatedId : undefined,
      path: type === 'new_message' && relatedId ? '/chat' : type === 'friend_request_received' ? '/friends' : '/notifications',
    },
  }).catch(() => undefined);

  return notification;
}
