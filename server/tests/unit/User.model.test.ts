import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';
import User from '../../src/models/User';

describe('User model', () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  it('creates a user with defaults applied', async () => {
    const user = await User.create({
      username: 'alice',
      displayName: 'Alice',
      email: 'alice@example.com',
      passwordHash: 'hashed',
      avatarUrl: 'https://example.com/default-avatar.png',
    });

    expect(user.interests).toEqual([]);
    expect(user.languages).toEqual([]);
    expect(user.privacy.hideOnlineStatus).toBe(false);
    expect(user.privacy.invisibleMode).toBe(false);
    expect(user.theme).toBe('system');
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.role).toBe('user');
    expect(user.status).toBe('active');
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('rejects a second user with a duplicate email', async () => {
    await User.create({
      username: 'bob',
      displayName: 'Bob',
      email: 'dup@example.com',
      passwordHash: 'hashed',
      avatarUrl: 'https://example.com/default-avatar.png',
    });

    await expect(
      User.create({
        username: 'bob2',
        displayName: 'Bob Two',
        email: 'dup@example.com',
        passwordHash: 'hashed',
        avatarUrl: 'https://example.com/default-avatar.png',
      })
    ).rejects.toThrow();
  });

  it('rejects a second user with a duplicate username', async () => {
    await User.create({
      username: 'carol',
      displayName: 'Carol',
      email: 'carol@example.com',
      passwordHash: 'hashed',
      avatarUrl: 'https://example.com/default-avatar.png',
    });

    await expect(
      User.create({
        username: 'carol',
        displayName: 'Carol Two',
        email: 'carol2@example.com',
        passwordHash: 'hashed',
        avatarUrl: 'https://example.com/default-avatar.png',
      })
    ).rejects.toThrow();
  });

  it('requires username, displayName, email, and avatarUrl', async () => {
    await expect(User.create({})).rejects.toThrow();
  });
});
