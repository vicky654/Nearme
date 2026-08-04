import { RequestHandler } from 'express';
import User from '../models/User';
import UserSession from '../models/UserSession';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { toPublicUser } from '../utils/toPublicUser';
import { hashPassword, comparePassword } from '../services/passwordService';
import {
  signPurposeToken,
  verifyPurposeToken,
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from '../services/tokenService';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService';
import { isGoogleLoginEnabled, verifyGoogleIdToken } from '../services/googleAuthService';
import { REFRESH_COOKIE_NAME, setRefreshCookie, clearRefreshCookie } from '../utils/cookies';

const DEFAULT_AVATAR_URL = 'https://api.dicebear.com/9.x/initials/svg';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const register: RequestHandler = asyncHandler(async (req, res) => {
  const { username, displayName, email, password } = req.body as {
    username: string;
    displayName: string;
    email: string;
    password: string;
  };

  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) {
    throw new AppError(409, 'A user with that email or username already exists');
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({
    username,
    displayName,
    email,
    passwordHash,
    avatarUrl: `${DEFAULT_AVATAR_URL}?seed=${encodeURIComponent(username)}`,
  });

  const verifyToken = signPurposeToken(user.id, 'email-verify');
  try {
    await sendVerificationEmail(user.email, verifyToken);
  } catch {
    // Registration still succeeds even if the verification email fails to send;
    // the user can request a fresh link later. Don't leave them stuck unregistered.
  }

  res.status(201).json({ user: toPublicUser(user) });
});

export const verifyEmail: RequestHandler = asyncHandler(async (req, res) => {
  const { token } = req.body as { token: string };

  const { sub } = verifyPurposeToken(token, 'email-verify');
  const user = await User.findById(sub);
  if (!user) {
    throw new AppError(404, 'User not found');
  }

  user.emailVerifiedAt = new Date();
  await user.save();

  res.status(200).json({ user: toPublicUser(user) });
});

export const login: RequestHandler = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body as {
    email: string;
    password: string;
    rememberMe: boolean;
  };

  const user = await User.findOne({ email });
  if (!user || !user.passwordHash) {
    throw new AppError(401, 'Invalid email or password');
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError(401, 'Invalid email or password');
  }

  if (user.status !== 'active') {
    throw new AppError(403, 'This account is not active');
  }

  const accessToken = signAccessToken(user.id);
  const rawRefreshToken = generateRefreshToken();

  await UserSession.create({
    userId: user._id,
    refreshTokenHash: hashRefreshToken(rawRefreshToken),
    userAgent: req.headers['user-agent'] ?? '',
    ipAddress: req.ip ?? '',
    expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
    rememberMe,
  });

  setRefreshCookie(res, rawRefreshToken, rememberMe);
  user.lastSeenAt = new Date();
  await user.save();

  res.status(200).json({ user: toPublicUser(user), accessToken });
});

export const refresh: RequestHandler = asyncHandler(async (req, res) => {
  const rawToken = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE_NAME];
  if (!rawToken) {
    throw new AppError(401, 'No refresh token provided');
  }

  const tokenHash = hashRefreshToken(rawToken);
  const session = await UserSession.findOne({
    refreshTokenHash: tokenHash,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!session) {
    throw new AppError(401, 'Invalid or expired session');
  }

  const user = await User.findById(session.userId);
  if (!user || user.status !== 'active') {
    throw new AppError(403, 'This account is not active');
  }

  const { rememberMe } = session;

  session.revokedAt = new Date();
  await session.save();

  const newRawToken = generateRefreshToken();
  await UserSession.create({
    userId: session.userId,
    refreshTokenHash: hashRefreshToken(newRawToken),
    userAgent: req.headers['user-agent'] ?? '',
    ipAddress: req.ip ?? '',
    expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
    rememberMe,
  });

  setRefreshCookie(res, newRawToken, rememberMe);
  const accessToken = signAccessToken(session.userId.toString());

  res.status(200).json({ accessToken });
});

export const logout: RequestHandler = asyncHandler(async (req, res) => {
  const rawToken = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE_NAME];
  if (rawToken) {
    const tokenHash = hashRefreshToken(rawToken);
    await UserSession.updateOne(
      { refreshTokenHash: tokenHash, revokedAt: null },
      { revokedAt: new Date() }
    );
  }

  clearRefreshCookie(res);
  res.status(204).send();
});

export const forgotPassword: RequestHandler = asyncHandler(async (req, res) => {
  const { email } = req.body as { email: string };

  const user = await User.findOne({ email });
  if (user) {
    const token = signPurposeToken(user.id, 'password-reset');
    try {
      await sendPasswordResetEmail(user.email, token);
    } catch {
      // Always return the generic message below regardless of whether the email
      // provider succeeded, so a transient send failure doesn't leak account
      // existence or turn into an error response.
    }
  }

  res.status(200).json({
    message: 'If an account exists for that email, a reset link has been sent.',
  });
});

export const resendVerification: RequestHandler = asyncHandler(async (req, res) => {
  const { email } = req.body as { email: string };

  const user = await User.findOne({ email });
  if (user && !user.emailVerifiedAt) {
    const token = signPurposeToken(user.id, 'email-verify');
    try {
      await sendVerificationEmail(user.email, token);
    } catch {
      // Same privacy-preserving pattern as forgotPassword/register: a transient
      // email-provider failure must not turn into an error response, since that
      // would let a caller distinguish "account exists" from "email failed".
    }
  }

  res.status(200).json({
    message: 'If an unverified account exists for that email, a new verification link has been sent.',
  });
});

export const resetPassword: RequestHandler = asyncHandler(async (req, res) => {
  const { token, password } = req.body as { token: string; password: string };

  const { sub, iat } = verifyPurposeToken(token, 'password-reset');
  const user = await User.findById(sub);
  if (!user) {
    throw new AppError(400, 'Invalid or expired token');
  }

  // Reset tokens are stateless JWTs, so they remain cryptographically valid for
  // their entire 30-minute window even after being used once. Enforce single-use
  // by rejecting any token issued before the last successful password change.
  if (user.passwordChangedAt && iat * 1000 < user.passwordChangedAt.getTime()) {
    throw new AppError(400, 'Invalid or expired token');
  }

  user.passwordHash = await hashPassword(password);
  user.passwordChangedAt = new Date();
  await user.save();

  await UserSession.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });

  res.status(200).json({ message: 'Password reset successfully' });
});

export const googleLogin: RequestHandler = asyncHandler(async (req, res) => {
  if (!isGoogleLoginEnabled()) {
    throw new AppError(503, 'Google login is not configured');
  }

  const { idToken } = req.body as { idToken: string };
  const profile = await verifyGoogleIdToken(idToken);

  let user = await User.findOne({ googleId: profile.googleId });
  if (!user) {
    user = await User.findOne({ email: profile.email });
    if (user) {
      user.googleId = profile.googleId;
      // Google has already verified ownership of this email address, so linking
      // an existing password account to a Google identity should also mark the
      // email verified (preserving an existing verification timestamp if present).
      user.emailVerifiedAt = user.emailVerifiedAt ?? new Date();
    } else {
      const usernameBase = profile.email.split('@')[0]!.replace(/[^a-zA-Z0-9_]/g, '');
      let username = usernameBase;
      while (await User.findOne({ username })) {
        username = `${usernameBase}${Math.floor(1000 + Math.random() * 9000)}`;
      }
      user = new User({
        username,
        displayName: profile.name,
        email: profile.email,
        passwordHash: null,
        avatarUrl: profile.picture ?? `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(username)}`,
        googleId: profile.googleId,
        emailVerifiedAt: new Date(),
      });
    }
    await user.save();
  }

  const accessToken = signAccessToken(user.id);
  const rawRefreshToken = generateRefreshToken();
  await UserSession.create({
    userId: user._id,
    refreshTokenHash: hashRefreshToken(rawRefreshToken),
    userAgent: req.headers['user-agent'] ?? '',
    ipAddress: req.ip ?? '',
    expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
    // Google logins are always persistent (see setRefreshCookie call below) — the
    // session record must agree, or a subsequent /auth/refresh silently downgrades
    // this to a session-only cookie because it reads rememberMe off the session.
    rememberMe: true,
  });
  setRefreshCookie(res, rawRefreshToken, true);

  res.status(200).json({ user: toPublicUser(user), accessToken });
});
