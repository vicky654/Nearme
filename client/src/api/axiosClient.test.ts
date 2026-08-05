import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, cancelPendingAuthRefresh } from './axiosClient';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types/user';

const fakeUser = { id: '1', username: 'test' } as User;

describe('apiClient', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    cancelPendingAuthRefresh();
    mock = new MockAdapter(apiClient);
    useAuthStore.getState().clearAuth();
  });

  afterEach(() => {
    mock.restore();
  });

  it('attaches the access token as a Bearer header when present', async () => {
    useAuthStore.getState().setAuth(fakeUser, 'test-token');
    mock.onGet('/whoami').reply((config) => {
      expect(config.headers?.Authorization).toBe('Bearer test-token');
      return [200, {}];
    });

    await apiClient.get('/whoami');
  });

  it('does not attach an Authorization header when there is no token', async () => {
    mock.onGet('/whoami').reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined();
      return [200, {}];
    });

    await apiClient.get('/whoami');
  });

  it('refreshes the access token and retries once on a 401', async () => {
    useAuthStore.getState().setAuth(fakeUser, 'expired-token');

    let attempt = 0;
    mock.onGet('/protected').reply(() => {
      attempt += 1;
      return attempt === 1 ? [401, {}] : [200, { ok: true }];
    });
    mock.onPost('/auth/refresh').reply(200, { accessToken: 'new-token' });

    const res = await apiClient.get('/protected');

    expect(res.data).toEqual({ ok: true });
    expect(useAuthStore.getState().accessToken).toBe('new-token');
  });

  it('clears auth and rejects when the refresh call itself fails', async () => {
    useAuthStore.getState().setAuth(fakeUser, 'expired-token');

    mock.onGet('/protected').reply(401);
    mock.onPost('/auth/refresh').reply(401);

    await expect(apiClient.get('/protected')).rejects.toBeDefined();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('shares a single in-flight refresh across concurrent 401s', async () => {
    useAuthStore.getState().setAuth(fakeUser, 'expired-token');

    let attemptsA = 0;
    let attemptsB = 0;
    mock.onGet('/protected-a').reply(() => {
      attemptsA += 1;
      return attemptsA === 1 ? [401, {}] : [200, { ok: 'a' }];
    });
    mock.onGet('/protected-b').reply(() => {
      attemptsB += 1;
      return attemptsB === 1 ? [401, {}] : [200, { ok: 'b' }];
    });
    mock.onPost('/auth/refresh').reply(200, { accessToken: 'new-token' });

    const [resA, resB] = await Promise.all([
      apiClient.get('/protected-a'),
      apiClient.get('/protected-b'),
    ]);

    expect(resA.data).toEqual({ ok: 'a' });
    expect(resB.data).toEqual({ ok: 'b' });
    expect(useAuthStore.getState().accessToken).toBe('new-token');

    const refreshCalls = mock.history.post.filter((req) => req.url === '/auth/refresh');
    expect(refreshCalls).toHaveLength(1);
  });

  it('does not treat an authentication endpoint 401 as an expired access token', async () => {
    mock.onPost('/auth/login').reply(401, { error: 'Invalid email or password' });
    mock.onPost('/auth/refresh').reply(200, { accessToken: 'unexpected' });

    await expect(apiClient.post('/auth/login', { email: 'a@example.com', password: 'wrong' })).rejects.toBeDefined();
    expect(mock.history.post.filter((request) => request.url === '/auth/refresh')).toHaveLength(0);
  });

  it('prevents a canceled refresh from restoring a logged-out session', async () => {
    useAuthStore.getState().setAuth(fakeUser, 'expired-token');
    let resolveRefresh: ((response: [number, { accessToken: string }]) => void) | undefined;
    mock.onGet('/protected').reply(401);
    mock.onPost('/auth/refresh').reply(() => new Promise((resolve) => { resolveRefresh = resolve; }));

    const pendingRequest = apiClient.get('/protected');
    await new Promise((resolve) => setTimeout(resolve, 0));
    cancelPendingAuthRefresh();
    useAuthStore.getState().clearAuth();
    resolveRefresh?.([200, { accessToken: 'late-token' }]);

    await expect(pendingRequest).rejects.toBeDefined();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
