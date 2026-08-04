import { useEffect, useState } from 'react';
import { apiClient } from '../api/axiosClient';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import type { User } from '../types/user';

export function useAuthBootstrap(): boolean {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const setAuth = useAuthStore((state) => state.setAuth);
  const setTheme = useThemeStore((state) => state.setTheme);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const refreshRes = await apiClient.post<{ accessToken: string }>('/auth/refresh');
        const accessToken = refreshRes.data.accessToken;
        const meRes = await apiClient.get<{ user: User }>('/users/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!cancelled) {
          setAuth(meRes.data.user, accessToken);
          // Apply the user's server-persisted theme preference so it's
          // consistent across devices, not just whatever this browser's
          // localStorage last recorded.
          setTheme(meRes.data.user.theme);
        }
      } catch {
        // No valid session — the user remains logged out; this is expected on a first visit.
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [setAuth, setTheme]);

  return isBootstrapping;
}
