import { RequestHandler } from 'express';
import User from '../models/User';
import UserSession from '../models/UserSession';
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
  await UserSession.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });

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
