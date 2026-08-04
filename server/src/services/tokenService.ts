import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

const ACCESS_TOKEN_TTL = '15m';
const PURPOSE_TOKEN_TTL = '30m';

export type PurposeTokenKind = 'email-verify' | 'password-reset';

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): { sub: string } {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string };
    return { sub: payload.sub };
  } catch {
    throw new AppError(401, 'Invalid or expired access token');
  }
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signPurposeToken(userId: string, purpose: PurposeTokenKind): string {
  return jwt.sign({ sub: userId, purpose }, env.JWT_PURPOSE_SECRET, {
    expiresIn: PURPOSE_TOKEN_TTL,
  });
}

export function verifyPurposeToken(
  token: string,
  purpose: PurposeTokenKind
): { sub: string; iat: number } {
  try {
    const payload = jwt.verify(token, env.JWT_PURPOSE_SECRET) as {
      sub: string;
      purpose: PurposeTokenKind;
      iat: number;
    };
    if (payload.purpose !== purpose) {
      throw new Error('purpose mismatch');
    }
    return { sub: payload.sub, iat: payload.iat };
  } catch {
    throw new AppError(400, 'Invalid or expired token');
  }
}
