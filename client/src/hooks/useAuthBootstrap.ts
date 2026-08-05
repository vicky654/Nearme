import { useEffect, useState } from 'react';
import { apiClient } from '../api/axiosClient';
import { isDefinitiveSessionFailure } from '../api/errors';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import type { User } from '../types/user';

let restorePromise: Promise<boolean> | null = null;

/**
 * Restores the cookie-backed session exactly once across Strict Mode mounts,
 * foreground events, and concurrent callers. Access tokens remain memory-only.
 */
export function restoreSession(): Promise<boolean> {
  if (restorePromise) return restorePromise;

  restorePromise = (async () => {
    try {
      const refreshRes = await apiClient.post<{ accessToken: string }>('/auth/refresh');
      const accessToken = refreshRes.data.accessToken;
      const meRes = await apiClient.get<{ user: User }>('/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      useAuthStore.getState().setAuth(meRes.data.user, accessToken);
      useThemeStore.getState().setTheme(meRes.data.user.theme);
      return true;
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        useAuthStore.getState().clearAuth();
      } else if (!useAuthStore.getState().user) {
        useAuthStore.getState().restoreCachedUser();
      }
      return false;
    } finally {
      restorePromise = null;
    }
  })();

  return restorePromise;
}

export function useAuthBootstrap(): boolean {
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let active = true;
    void restoreSession().finally(() => { if (active) setIsBootstrapping(false); });
    return () => { active = false; };
  }, []);

  return isBootstrapping;
}
