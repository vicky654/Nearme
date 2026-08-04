import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from './axiosClient';
import { getMe, updateMe, changePassword, getSettings, updateSettings } from './userApi';

describe('userApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });

  afterEach(() => {
    mock.restore();
  });

  it('getMe fetches /users/me', async () => {
    mock.onGet('/users/me').reply(200, { user: { id: '1', username: 'alice' } });
    const result = await getMe();
    expect(result.user).toEqual({ id: '1', username: 'alice' });
  });

  it('updateMe patches /users/me with the given fields', async () => {
    const input = { displayName: 'New Name', interests: ['chess'] };
    mock.onPatch('/users/me', input).reply(200, { user: { id: '1', displayName: 'New Name' } });
    const result = await updateMe(input);
    expect(result.user.displayName).toBe('New Name');
  });

  it('changePassword patches /users/me/password', async () => {
    const input = { currentPassword: 'old-pass', newPassword: 'new-pass' };
    mock.onPatch('/users/me/password', input).reply(200, { message: 'updated' });
    const result = await changePassword(input);
    expect(result.message).toBe('updated');
  });

  it('getSettings fetches /users/me/settings', async () => {
    const payload = {
      theme: 'dark',
      privacy: {
        hideOnlineStatus: false,
        hideDistance: false,
        hideProfile: false,
        invisibleMode: false,
        privateAccount: false,
      },
    };
    mock.onGet('/users/me/settings').reply(200, payload);
    const result = await getSettings();
    expect(result).toEqual(payload);
  });

  it('updateSettings patches /users/me/settings with the given fields', async () => {
    mock
      .onPatch('/users/me/settings', { privacy: { invisibleMode: true } })
      .reply(200, { theme: 'system', privacy: { invisibleMode: true } });
    const result = await updateSettings({ privacy: { invisibleMode: true } });
    expect(result.privacy.invisibleMode).toBe(true);
  });
});
