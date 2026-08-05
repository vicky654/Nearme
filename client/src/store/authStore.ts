import { create } from 'zustand';
import type { User } from '../types/user';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  sessionMode: 'online' | 'offline' | 'signed-out';
  setAuth: (user: User, accessToken: string) => void;
  restoreCachedUser: () => User | null;
  clearAuth: () => void;
}

const USER_CACHE_KEY = 'nearme.cached-user';

function cacheUser(user: User): void {
  try { localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user)); } catch { /* Storage can be unavailable in privacy mode. */ }
}

function readCachedUser(): User | null {
  try {
    const value = localStorage.getItem(USER_CACHE_KEY);
    return value ? JSON.parse(value) as User : null;
  } catch { return null; }
}

function removeCachedUser(): void {
  try { localStorage.removeItem(USER_CACHE_KEY); } catch { /* Best effort. */ }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  sessionMode: 'signed-out',
  setAuth: (user, accessToken) => { cacheUser(user); set({ user, accessToken, sessionMode: 'online' }); },
  restoreCachedUser: () => {
    const user = readCachedUser();
    if (user) set({ user, accessToken: null, sessionMode: 'offline' });
    return user;
  },
  clearAuth: () => { removeCachedUser(); set({ user: null, accessToken: null, sessionMode: 'signed-out' }); },
}));
