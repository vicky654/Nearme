import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import User from '../models/User';
import Friendship from '../models/Friendship';
import Message from '../models/Message';
import Conversation from '../models/Conversation';
import Report from '../models/Report';
import UserSession from '../models/UserSession';
import { AppError } from '../utils/AppError';

export async function getAdminStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const suspendedUsers = await User.countDocuments({ status: 'suspended' });
    const totalFriendships = await Friendship.countDocuments({ status: 'accepted' });
    const totalMessages = await Message.countDocuments();
    const totalReports = await Report.countDocuments({ status: 'pending' });

    res.json({
      stats: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        totalFriendships,
        totalMessages,
        totalReports,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = String(req.query.q ?? '').trim();
    const status = String(req.query.status ?? '').trim();
    const role = String(req.query.role ?? '').trim();

    const queryFilter: any = {};

    if (q) {
      queryFilter.$or = [
        { username: { $regex: q, $options: 'i' } },
        { displayName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ];
    }

    if (status) queryFilter.status = status;
    if (role) queryFilter.role = role;

    const users = await User.find(queryFilter)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ users });
  } catch (err) {
    next(err);
  }
}

export async function updateUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const targetUserId = String(req.params.targetUserId);
    const { status, role } = req.body;

    if (!targetUserId || !Types.ObjectId.isValid(targetUserId)) {
      throw new AppError(400, 'Invalid targetUserId');
    }

    const updates: any = {};
    if (status && ['active', 'suspended', 'banned'].includes(status)) {
      updates.status = status;
    }
    if (role && ['user', 'admin'].includes(role)) {
      updates.role = role;
    }

    const updatedUser = await User.findByIdAndUpdate(targetUserId, updates, { new: true }).select(
      '-passwordHash'
    );

    if (!updatedUser) {
      throw new AppError(404, 'User not found');
    }

    // If suspended or banned, revoke sessions
    if (status === 'suspended' || status === 'banned') {
      await UserSession.deleteMany({ userId: targetUserId });
    }

    res.json({ user: updatedUser });
  } catch (err) {
    next(err);
  }
}

export async function deleteUserAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const targetUserId = String(req.params.targetUserId);

    if (!targetUserId || !Types.ObjectId.isValid(targetUserId)) {
      throw new AppError(400, 'Invalid targetUserId');
    }

    const user = await User.findByIdAndDelete(targetUserId);
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    await UserSession.deleteMany({ userId: targetUserId });
    await Friendship.deleteMany({
      $or: [{ requesterId: targetUserId }, { recipientId: targetUserId }],
    });
    await Conversation.deleteMany({ participants: targetUserId });

    res.json({ message: 'User account and associated data deleted' });
  } catch (err) {
    next(err);
  }
}

export async function getAdminReports(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reports = await Report.find()
      .populate('reporterId', 'username displayName avatarUrl')
      .populate('targetUserId', 'username displayName avatarUrl status')
      .sort({ createdAt: -1 });

    res.json({ reports });
  } catch (err) {
    next(err);
  }
}
