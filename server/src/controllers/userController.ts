import { RequestHandler } from 'express';
import User from '../models/User';
import UserSession from '../models/UserSession';
import BlockedUser from '../models/BlockedUser';
import Friendship from '../models/Friendship';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { toPublicUser } from '../utils/toPublicUser';
import { comparePassword, hashPassword } from '../services/passwordService';

async function requireUser(userId: string | undefined) {
  if (!userId) {
    throw new AppError(401, 'Not authenticated');
  }
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(404, 'User not found');
  }
  return user;
}

export const getMe: RequestHandler = asyncHandler(async (req, res) => {
  const user = await requireUser(req.userId);
  res.status(200).json({ user: toPublicUser(user) });
});

export const updateMe: RequestHandler = asyncHandler(async (req, res) => {
  const user = await requireUser(req.userId);
  const updates = req.body as Partial<{
    displayName: string;
    bio: string;
    gender: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
    age: number;
    country: string;
    city: string;
    interests: string[];
    languages: string[];
  }>;

  Object.assign(user, updates);
  await user.save();

  res.status(200).json({ user: toPublicUser(user) });
});

export const changePassword: RequestHandler = asyncHandler(async (req, res) => {
  const user = await requireUser(req.userId);
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };

  if (!user.passwordHash || !(await comparePassword(currentPassword, user.passwordHash))) {
    throw new AppError(401, 'Current password is incorrect');
  }

  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  await user.save();

  // changePassword is authenticated via the (stateless) access token, not the
  // refresh cookie, so there is no reliable way to identify "the current session"
  // among this user's UserSessions to exclude it from revocation. resetPassword
  // (forgot-password flow) already revokes ALL sessions on a successful reset;
  // do the same here for a consistent security posture — the user is forced to
  // log back in on every device, including this one, which is an acceptable and
  // much simpler trade-off than trying to thread a session identifier through the
  // access-token-authenticated request.
  await UserSession.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date(), revokedReason: 'password_change' });

  res.status(200).json({ message: 'Password updated successfully' });
});

export const getSettings: RequestHandler = asyncHandler(async (req, res) => {
  const user = await requireUser(req.userId);
  res.status(200).json({ theme: user.theme, privacy: user.privacy });
});

export const updateSettings: RequestHandler = asyncHandler(async (req, res) => {
  const user = await requireUser(req.userId);
  const { theme, privacy } = req.body as {
    theme?: 'light' | 'dark' | 'system';
    privacy?: Partial<typeof user.privacy>;
  };

  if (theme) {
    user.theme = theme;
  }
  if (privacy) {
    Object.assign(user.privacy, privacy);
  }
  await user.save();

  res.status(200).json({ theme: user.theme, privacy: user.privacy });
});

export const registerPushToken: RequestHandler = asyncHandler(async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  if (token.length < 20 || token.length > 4096) throw new AppError(400, 'Invalid push token');
  await User.updateOne({ _id: req.userId }, { $addToSet: { pushTokens: token } });
  res.status(204).send();
});

export const unregisterPushToken: RequestHandler = asyncHandler(async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  if (token) await User.updateOne({ _id: req.userId }, { $pull: { pushTokens: token } });
  res.status(204).send();
});

export const updateLocation: RequestHandler = asyncHandler(async (req, res) => {
  const user = await requireUser(req.userId);
  const { latitude, longitude } = req.body as { latitude: number; longitude: number };

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new AppError(400, 'Valid latitude and longitude numbers are required');
  }

  user.location = {
    type: 'Point',
    coordinates: [longitude, latitude],
  };
  await user.save();

  res.status(200).json({ message: 'Location updated', location: user.location });
});

function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export const getNearbyUsers: RequestHandler = asyncHandler(async (req, res) => {
  const user = await requireUser(req.userId);
  const radius = Number(req.query.radius) || 20;

  const blockedDocs = await BlockedUser.find({
    $or: [{ blockerId: user._id }, { blockedId: user._id }],
  });
  const blockedUserIds = blockedDocs.map((b: any) =>
    b.blockerId.toString() === user._id.toString() ? b.blockedId : b.blockerId
  );

  const friendships = await Friendship.find({
    $or: [{ requesterId: user._id }, { recipientId: user._id }],
  });

  const friendshipMap = new Map<string, { status: string; isRequester: boolean; id: string }>();
  for (const f of friendships) {
    const friendId = f.requesterId.toString() === user._id.toString() ? f.recipientId.toString() : f.requesterId.toString();
    friendshipMap.set(friendId, {
      status: f.status,
      isRequester: f.requesterId.toString() === user._id.toString(),
      id: f._id.toString(),
    });
  }

  const queryFilter: any = {
    _id: { $ne: user._id, $nin: blockedUserIds },
    'privacy.hideProfile': { $ne: true },
    status: 'active',
  };

  const candidateUsers = await User.find(queryFilter);

  const userLat = user.location?.coordinates[1] ?? 0;
  const userLon = user.location?.coordinates[0] ?? 0;

  const nearbyUsers = candidateUsers
    .map((u) => {
      const uLat = u.location?.coordinates[1] ?? 0;
      const uLon = u.location?.coordinates[0] ?? 0;
      const distance = user.location && u.location ? calculateHaversineKm(userLat, userLon, uLat, uLon) : null;
      const mutualInterests = u.interests.filter((i) => user.interests.includes(i));
      const fInfo = friendshipMap.get(u._id.toString());

      let connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'connected' = 'none';
      if (fInfo) {
        if (fInfo.status === 'accepted') connectionStatus = 'connected';
        else if (fInfo.status === 'pending') {
          connectionStatus = fInfo.isRequester ? 'pending_sent' : 'pending_received';
        }
      }

      return {
        user: {
          _id: u._id,
          username: u.username,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
          bio: u.bio,
          country: u.country,
          city: u.city,
          interests: u.interests,
          lastSeenAt: u.privacy?.hideOnlineStatus ? null : u.lastSeenAt,
        },
        distanceKm: u.privacy?.hideDistance ? null : distance,
        mutualInterests,
        connectionStatus,
        friendshipId: fInfo?.id,
      };
    })
    .filter((item) => item.distanceKm === null || item.distanceKm <= radius);

  res.status(200).json({ users: nearbyUsers });
});

export const searchUsers: RequestHandler = asyncHandler(async (req, res) => {
  const user = await requireUser(req.userId);
  const q = String(req.query.q ?? '').trim();
  const city = String(req.query.city ?? '').trim();
  const country = String(req.query.country ?? '').trim();
  const interests = String(req.query.interests ?? '').trim();

  const blockedDocs = await BlockedUser.find({
    $or: [{ blockerId: user._id }, { blockedId: user._id }],
  });
  const blockedUserIds = blockedDocs.map((b: any) =>
    b.blockerId.toString() === user._id.toString() ? b.blockedId : b.blockerId
  );

  const friendships = await Friendship.find({
    $or: [{ requesterId: user._id }, { recipientId: user._id }],
  });

  const friendshipMap = new Map<string, { status: string; isRequester: boolean; id: string }>();
  for (const f of friendships) {
    const friendId = f.requesterId.toString() === user._id.toString() ? f.recipientId.toString() : f.requesterId.toString();
    friendshipMap.set(friendId, {
      status: f.status,
      isRequester: f.requesterId.toString() === user._id.toString(),
      id: f._id.toString(),
    });
  }

  const queryFilter: any = {
    _id: { $ne: user._id, $nin: blockedUserIds },
    'privacy.hideProfile': { $ne: true },
    status: 'active',
  };

  if (q) {
    queryFilter.$or = [
      { username: { $regex: q, $options: 'i' } },
      { displayName: { $regex: q, $options: 'i' } },
    ];
  }

  if (city) {
    queryFilter.city = { $regex: city, $options: 'i' };
  }

  if (country) {
    queryFilter.country = { $regex: country, $options: 'i' };
  }

  if (interests) {
    const interestList = interests.split(',').map((s) => s.trim()).filter(Boolean);
    if (interestList.length > 0) {
      queryFilter.interests = { $in: interestList.map((i) => new RegExp(i, 'i')) };
    }
  }

  const results = await User.find(queryFilter).limit(50);

  const matchedUsers = results.map((u) => {
    const fInfo = friendshipMap.get(u._id.toString());
    let connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'connected' = 'none';
    if (fInfo) {
      if (fInfo.status === 'accepted') connectionStatus = 'connected';
      else if (fInfo.status === 'pending') {
        connectionStatus = fInfo.isRequester ? 'pending_sent' : 'pending_received';
      }
    }

    return {
      user: {
        _id: u._id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        bio: u.bio,
        country: u.country,
        city: u.city,
        interests: u.interests,
        lastSeenAt: u.privacy?.hideOnlineStatus ? null : u.lastSeenAt,
      },
      mutualInterests: u.interests.filter((i) => user.interests.includes(i)),
      connectionStatus,
      friendshipId: fInfo?.id,
    };
  });

  res.status(200).json({ users: matchedUsers });
});
