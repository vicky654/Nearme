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

  it('shares one refresh request across concurrent Strict Mode-style mounts', async () => {
    let refreshCalls = 0;
    mock.onPost('/auth/refresh').reply(async () => {
      refreshCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return [200, { accessToken: 'shared-token' }];
    });
    mock.onGet('/users/me').reply(200, { user: { id: '1', username: 'alice', theme: 'light' } });

    const first = renderHook(() => useAuthBootstrap());
    const second = renderHook(() => useAuthBootstrap());

    await waitFor(() => expect(first.result.current).toBe(false));
    await waitFor(() => expect(second.result.current).toBe(false));
    expect(refreshCalls).toBe(1);
    expect(useAuthStore.getState().accessToken).toBe('shared-token');
  });

  it('restores the cached profile without persisting a token when startup is offline', async () => {
    localStorage.setItem('nearme.cached-user', JSON.stringify({ id: '1', username: 'offline-alice', theme: 'light' }));
    mock.onPost('/auth/refresh').networkError();

    const { result } = renderHook(() => useAuthBootstrap());
    await waitFor(() => expect(result.current).toBe(false));

    expect(useAuthStore.getState().user?.username).toBe('offline-alice');
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().sessionMode).toBe('offline');
  });
});
