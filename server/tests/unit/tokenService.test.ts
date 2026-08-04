import { describe, it, expect } from 'vitest';
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  signPurposeToken,
  verifyPurposeToken,
} from '../../src/services/tokenService';
import { AppError } from '../../src/utils/AppError';

describe('tokenService', () => {
  it('signs and verifies an access token round-trip', () => {
    const token = signAccessToken('user-123');
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('user-123');
  });

  it('throws AppError for a malformed access token', () => {
    expect(() => verifyAccessToken('not-a-real-token')).toThrow(AppError);
  });

  it('generates a refresh token that is a non-empty hex string', () => {
    const token = generateRefreshToken();
    expect(token).toMatch(/^[a-f0-9]+$/);
    expect(token.length).toBeGreaterThanOrEqual(40);
  });

  it('hashes a refresh token deterministically', () => {
    const token = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(hashRefreshToken(token)).not.toBe(token);
  });

  it('signs and verifies a purpose token round-trip for the correct purpose', () => {
    const token = signPurposeToken('user-123', 'email-verify');
    const payload = verifyPurposeToken(token, 'email-verify');
    expect(payload.sub).toBe('user-123');
  });

  it('rejects a purpose token verified against the wrong purpose', () => {
    const token = signPurposeToken('user-123', 'email-verify');
    expect(() => verifyPurposeToken(token, 'password-reset')).toThrow(AppError);
  });
});
