import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const baseURL = import.meta.env.VITE_API_BASE_URL as string;

export const apiClient = axios.create({ baseURL, withCredentials: true });

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
    const isRefreshCall = originalConfig?.url?.includes('/auth/refresh') ?? false;

    if (error.response?.status === 401 && originalConfig && !originalConfig._retry && !isRefreshCall) {
      originalConfig._retry = true;
      try {
        const newAccessToken = await refreshAccessToken();
        originalConfig.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalConfig);
      } catch (refreshError) {
        useAuthStore.getState().clearAuth();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
