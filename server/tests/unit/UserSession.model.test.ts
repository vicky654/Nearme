import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';
import UserSession from '../../src/models/UserSession';

describe('UserSession model', () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  it('creates a session with revokedAt defaulting to null', async () => {
    const session = await UserSession.create({
      userId: new Types.ObjectId(),
      refreshTokenHash: 'hashed-token',
      userAgent: 'vitest',
      ipAddress: '127.0.0.1',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    });

    expect(session.revokedAt).toBeNull();
    expect(session.createdAt).toBeInstanceOf(Date);
  });

  it('requires userId, refreshTokenHash, and expiresAt', async () => {
    await expect(UserSession.create({})).rejects.toThrow();
  });
});
