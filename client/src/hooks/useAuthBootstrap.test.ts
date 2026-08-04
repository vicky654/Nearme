import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../api/axiosClient';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { useAuthBootstrap } from './useAuthBootstrap';

describe('useAuthBootstrap', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    useAuthStore.getState().clearAuth();
  });

  afterEach(() => {
    mock.restore();
    cleanup();
  });

  it('logs the user in silently when a valid refresh cookie exists', async () => {
    mock.onPost('/auth/refresh').reply(200, { accessToken: 'fresh-token' });
    mock.onGet('/users/me').reply(200, { user: { id: '1', username: 'alice', theme: 'light' } });

    const { result } = renderHook(() => useAuthBootstrap());
    expect(result.current).toBe(true);

    await waitFor(() => expect(result.current).toBe(false));
    expect(useAuthStore.getState().accessToken).toBe('fresh-token');
    expect(useAuthStore.getState().user?.username).toBe('alice');

    // The manually-attached Authorization header is the whole reason this code
    // doesn't rely on the request interceptor here (the access token isn't in
    // the auth store yet at the moment this request fires) — assert it actually
    // reached the /users/me call.
    const meRequest = mock.history.get?.find((req) => req.url === '/users/me');
    expect(meRequest?.headers?.Authorization).toBe('Bearer fresh-token');
  });

  it('applies the server-persisted theme preference on successful bootstrap', async () => {
    mock.onPost('/auth/refresh').reply(200, { accessToken: 'fresh-token' });
    mock.onGet('/users/me').reply(200, { user: { id: '1', username: 'alice', theme: 'dark' } });

    const { result } = renderHook(() => useAuthBootstrap());
    await waitFor(() => expect(result.current).toBe(false));

    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('leaves the user logged out when there is no valid session', async () => {
    mock.onPost('/auth/refresh').reply(401);

    const { result } = renderHook(() => useAuthBootstrap());
    await waitFor(() => expect(result.current).toBe(false));

    expect(useAuthStore.getState().user).toBeNull();
  });
});
