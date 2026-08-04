import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import Friendship from '../models/Friendship';
import BlockedUser from '../models/BlockedUser';
import Report from '../models/Report';
import User from '../models/User';
import { AppError } from '../utils/AppError';
import { createAndEmitNotification } from '../services/notificationService';

export async function sendFriendRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { targetUserId } = req.body;

    if (!targetUserId || !Types.ObjectId.isValid(targetUserId)) {
      throw new AppError(400, 'Invalid targetUserId');
    }

    if (userId.toString() === targetUserId) {
      throw new AppError(400, 'You cannot send a friend request to yourself');
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      throw new AppError(404, 'User not found');
    }

    // Check if either user has blocked the other
    const isBlocked = await BlockedUser.findOne({
      $or: [
        { blockerId: userId, blockedId: targetUserId },
        { blockerId: targetUserId, blockedId: userId },
      ],
    });

    if (isBlocked) {
      throw new AppError(403, 'Cannot send request to this user');
    }

    // Check existing friendship / request
    let existing = await Friendship.findOne({
      $or: [
        { requesterId: userId, recipientId: targetUserId },
        { requesterId: targetUserId, recipientId: userId },
      ],
    });

    if (existing) {
      if (existing.status === 'accepted') {
        throw new AppError(400, 'You are already connected with this user');
      }
      if (existing.status === 'pending') {
        throw new AppError(400, 'A pending request already exists');
      }
      // If rejected, update to pending
      existing.requesterId = new Types.ObjectId(userId);
      existing.recipientId = new Types.ObjectId(targetUserId);
      existing.status = 'pending';
      await existing.save();
    } else {
      existing = await Friendship.create({
        requesterId: userId,
        recipientId: targetUserId,
        status: 'pending',
      });
    }

    const senderUser = await User.findById(userId).select('displayName');
    const senderName = senderUser?.displayName || 'Someone';

    await createAndEmitNotification({
      receiverId: targetUserId,
      senderId: userId,
      type: 'friend_request_received',
      title: 'New Friend Request',
      message: `${senderName} sent you a friend request.`,
      relatedId: existing._id.toString(),
    });

    res.status(201).json({ message: 'Friend request sent', friendship: existing });
  } catch (err) {
    next(err);
  }
}

export async function acceptFriendRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { requestId } = req.body;

    const friendship = await Friendship.findOne({
      _id: requestId,
      recipientId: userId,
      status: 'pending',
    });

    if (!friendship) {
      throw new AppError(404, 'Friend request not found');
    }

    friendship.status = 'accepted';
    await friendship.save();

    const acceptorUser = await User.findById(userId).select('displayName');
    const acceptorName = acceptorUser?.displayName || 'Someone';

    await createAndEmitNotification({
      receiverId: friendship.requesterId,
      senderId: userId,
      type: 'friend_request_accepted',
      title: 'Friend Request Accepted',
      message: `${acceptorName} accepted your friend request.`,
      relatedId: friendship._id.toString(),
    });

    res.json({ message: 'Friend request accepted', friendship });
  } catch (err) {
    next(err);
  }
}

export async function rejectFriendRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { requestId } = req.body;

    const friendship = await Friendship.findOne({
      _id: requestId,
      recipientId: userId,
      status: 'pending',
    });

    if (!friendship) {
      throw new AppError(404, 'Friend request not found');
    }

    friendship.status = 'rejected';
    await friendship.save();

    res.json({ message: 'Friend request rejected' });
  } catch (err) {
    next(err);
  }
}

export async function cancelFriendRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { requestId } = req.body;

    const friendship = await Friendship.findOneAndDelete({
      _id: requestId,
      requesterId: userId,
      status: 'pending',
    });

    if (!friendship) {
      throw new AppError(404, 'Friend request not found');
    }

    res.json({ message: 'Friend request cancelled' });
  } catch (err) {
    next(err);
  }
}

export async function removeFriend(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const friendId = String(req.params.friendId);

    if (!friendId || !Types.ObjectId.isValid(friendId)) {
      throw new AppError(400, 'Invalid friendId');
    }

    await Friendship.findOneAndDelete({
      $or: [
        { requesterId: userId, recipientId: friendId, status: 'accepted' },
        { requesterId: friendId, recipientId: userId, status: 'accepted' },
      ],
    });

    res.json({ message: 'Friend removed' });
  } catch (err) {
    next(err);
  }
}

export async function blockUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { targetUserId } = req.body;

    if (!targetUserId || !Types.ObjectId.isValid(targetUserId)) {
      throw new AppError(400, 'Invalid targetUserId');
    }

    if (userId.toString() === targetUserId) {
      throw new AppError(400, 'You cannot block yourself');
    }

    await BlockedUser.updateOne(
      { blockerId: userId, blockedId: targetUserId },
      { blockerId: userId, blockedId: targetUserId },
      { upsert: true }
    );

    // Delete any existing friendship
    await Friendship.findOneAndDelete({
      $or: [
        { requesterId: userId, recipientId: targetUserId },
        { requesterId: targetUserId, recipientId: userId },
      ],
    });

    res.json({ message: 'User blocked' });
  } catch (err) {
    next(err);
  }
}

export async function unblockUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { targetUserId } = req.body;

    if (!targetUserId || !Types.ObjectId.isValid(targetUserId)) {
      throw new AppError(400, 'Invalid targetUserId');
    }

    await BlockedUser.findOneAndDelete({ blockerId: userId, blockedId: targetUserId });

    res.json({ message: 'User unblocked' });
  } catch (err) {
    next(err);
  }
}

export async function getFriends(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;

    const friendships = await Friendship.find({
      $or: [{ requesterId: userId }, { recipientId: userId }],
      status: 'accepted',
    }).populate('requesterId recipientId', 'username displayName avatarUrl bio country city interests lastSeenAt privacy');

    const friends = friendships.map((f) => {
      const isRequester = f.requesterId._id.toString() === userId.toString();
      const friendObj = (isRequester ? f.recipientId : f.requesterId) as any;
      return {
        friendshipId: f._id,
        user: {
          _id: friendObj._id,
          username: friendObj.username,
          displayName: friendObj.displayName,
          avatarUrl: friendObj.avatarUrl,
          bio: friendObj.bio,
          country: friendObj.country,
          city: friendObj.city,
          interests: friendObj.interests,
          lastSeenAt: friendObj.privacy?.hideOnlineStatus ? null : friendObj.lastSeenAt,
        },
      };
    });

    res.json({ friends });
  } catch (err) {
    next(err);
  }
}

export async function getFriendRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;

    const incoming = await Friendship.find({
      recipientId: userId,
      status: 'pending',
    }).populate('requesterId', 'username displayName avatarUrl bio country city interests');

    const outgoing = await Friendship.find({
      requesterId: userId,
      status: 'pending',
    }).populate('recipientId', 'username displayName avatarUrl bio country city interests');

    const blocked = await BlockedUser.find({ blockerId: userId }).populate(
      'blockedId',
      'username displayName avatarUrl'
    );

    res.json({
      incoming: incoming.map((f) => ({
        id: f._id,
        user: f.requesterId,
        createdAt: f.createdAt,
      })),
      outgoing: outgoing.map((f) => ({
        id: f._id,
        user: f.recipientId,
        createdAt: f.createdAt,
      })),
      blocked: blocked.map((b) => b.blockedId),
    });
  } catch (err) {
    next(err);
  }
}

export async function reportUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { targetUserId, reason, details } = req.body;

    if (!targetUserId || !reason) {
      throw new AppError(400, 'targetUserId and reason are required');
    }

    const report = await Report.create({
      reporterId: userId,
      reportedId: targetUserId,
      reason,
      details,
    });

    res.status(201).json({ message: 'Report submitted successfully', report });
  } catch (err) {
    next(err);
  }
}
