import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import Notification from '../models/Notification';
import { AppError } from '../utils/AppError';

export async function getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;

    const notifications = await Notification.find({ receiverId: userId })
      .populate('senderId', 'username displayName avatarUrl')
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      receiverId: userId,
      isRead: false,
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 86400000);

    const today: any[] = [];
    const yesterday: any[] = [];
    const earlier: any[] = [];

    notifications.forEach((item) => {
      const createdAt = new Date(item.createdAt);
      if (createdAt >= startOfToday) {
        today.push(item);
      } else if (createdAt >= startOfYesterday) {
        yesterday.push(item);
      } else {
        earlier.push(item);
      }
    });

    res.json({
      notifications,
      unreadCount,
      grouped: {
        today,
        yesterday,
        earlier,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const notificationId = String(req.params.notificationId);

    if (!notificationId || !Types.ObjectId.isValid(notificationId)) {
      throw new AppError(400, 'Invalid notificationId');
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, receiverId: userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      throw new AppError(404, 'Notification not found');
    }

    res.json({ notification });
  } catch (err) {
    next(err);
  }
}

export async function markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;

    await Notification.updateMany({ receiverId: userId, isRead: false }, { isRead: true });

    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
}

export async function deleteNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const notificationId = String(req.params.notificationId);

    if (!notificationId || !Types.ObjectId.isValid(notificationId)) {
      throw new AppError(400, 'Invalid notificationId');
    }

    await Notification.findOneAndDelete({ _id: notificationId, receiverId: userId });

    res.json({ message: 'Notification deleted' });
  } catch (err) {
    next(err);
  }
}
