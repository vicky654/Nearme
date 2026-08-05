import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const rawBaseURL = (import.meta.env.VITE_API_BASE_URL as string) || '/api/v1';
const baseURL = rawBaseURL.replace(/\/$/, '');

export const apiClient = axios.create({ baseURL, withCredentials: true, timeout: 15_000 });
export const axiosClient = apiClient;
export default apiClient;

let sessionRequestController = new AbortController();

apiClient.interceptors.request.use((config) => {
  if (!config.signal) config.signal = sessionRequestController.signal;
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
let refreshController: AbortController | null = null;
let authGeneration = 0;

export function getAuthGeneration(): number {
  return authGeneration;
}

export function cancelPendingAuthRefresh(): void {
  authGeneration += 1;
  refreshController?.abort();
  refreshController = null;
  refreshPromise = null;
}

export function cancelPendingApiRequests(): void {
  cancelPendingAuthRefresh();
  sessionRequestController.abort();
  sessionRequestController = new AbortController();
}

function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    const generation = authGeneration;
    const controller = new AbortController();
    refreshController = controller;
    const request = apiClient
      .post<{ accessToken: string }>('/auth/refresh', undefined, { signal: controller.signal })
      .then((res) => {
        if (generation !== authGeneration) throw new axios.CanceledError('Authentication session changed');
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          useAuthStore.getState().setAuth(currentUser, res.data.accessToken);
        }
        return res.data.accessToken;
      });
    const pendingRefresh = request.finally(() => {
      if (refreshPromise === pendingRefresh) refreshPromise = null;
      if (refreshController === controller) refreshController = null;
    });
    refreshPromise = pendingRefresh;
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
          cancelPendingApiRequests();
          useAuthStore.getState().clearAuth();
          if (hadUser && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nearme:session-expired'));
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
