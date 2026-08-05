import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const rawBaseURL = (import.meta.env.VITE_API_BASE_URL as string) || '/api/v1';
const baseURL = rawBaseURL.replace(/\/$/, '');

export const apiClient = axios.create({ baseURL, withCredentials: true, timeout: 15_000 });
export const axiosClient = apiClient;
export default apiClient;

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post<{ accessToken: string }>('/auth/refresh')
      .then((res) => {
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          useAuthStore.getState().setAuth(currentUser, res.data.accessToken);
        }
        return res.data.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalConfig = error.config as RetryableConfig | undefined;
    const isAuthCall = originalConfig?.url?.includes('/auth/') ?? false;
    const hasAuthenticatedSession = Boolean(useAuthStore.getState().accessToken);

    if (error.response?.status === 401 && originalConfig && !originalConfig._retry && !isAuthCall && hasAuthenticatedSession) {
      originalConfig._retry = true;
      try {
        const newAccessToken = await refreshAccessToken();
        originalConfig.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalConfig);
      } catch (refreshError) {
        const refreshStatus = (refreshError as AxiosError).response?.status;
        if (refreshStatus === 401 || refreshStatus === 403) {
          const hadUser = Boolean(useAuthStore.getState().user);
          useAuthStore.getState().clearAuth();
          if (hadUser && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nearme:session-expired'));
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
