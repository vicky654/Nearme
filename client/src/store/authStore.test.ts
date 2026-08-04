import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';
import type { User } from '../types/user';

const fakeUser: User = {
  id: '1',
  username: 'test',
  displayName: 'Test',
  email: 'test@example.com',
  avatarUrl: '',
  interests: [],
  languages: [],
  role: 'user',
  status: 'active',
  theme: 'system',
  emailVerifiedAt: null,
  createdAt: new Date().toISOString(),
  privacy: {
    hideOnlineStatus: false,
    hideDistance: false,
    hideProfile: false,
    invisibleMode: false,
    privateAccount: false,
  },
};

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('starts with no user and no access token', () => {
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('sets the user and access token via setAuth', () => {
    useAuthStore.getState().setAuth(fakeUser, 'token-123');
    expect(useAuthStore.getState().user).toEqual(fakeUser);
    expect(useAuthStore.getState().accessToken).toBe('token-123');
  });

  it('clears the user and access token via clearAuth', () => {
    useAuthStore.getState().setAuth(fakeUser, 'token-123');
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
