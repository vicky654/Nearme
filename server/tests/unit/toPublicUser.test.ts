import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';
import User from '../../src/models/User';
import { toPublicUser } from '../../src/utils/toPublicUser';

describe('toPublicUser', () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  it('excludes passwordHash and googleId', async () => {
    const user = await User.create({
      username: 'dave',
      displayName: 'Dave',
      email: 'dave@example.com',
      passwordHash: 'super-secret-hash',
      avatarUrl: 'https://example.com/default-avatar.png',
      googleId: 'google-123',
    });

    const publicUser = toPublicUser(user);

    expect(publicUser).not.toHaveProperty('passwordHash');
    expect(publicUser).not.toHaveProperty('googleId');
    expect(publicUser.id).toBe(user.id);
    expect(publicUser.username).toBe('dave');
  });
});
