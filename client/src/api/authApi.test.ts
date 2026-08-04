import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from './axiosClient';
import {
  registerUser,
  loginUser,
  logoutUser,
  verifyEmail,
  forgotPassword,
  resetPassword,
  resendVerification,
  googleLogin,
} from './authApi';

describe('authApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });

  afterEach(() => {
    mock.restore();
  });

  it('registerUser posts to /auth/register with the given payload', async () => {
    const input = { username: 'a', displayName: 'A', email: 'a@b.com', password: 'password123' };
    mock.onPost('/auth/register', input).reply(201, { user: { id: '1' } });

    const result = await registerUser(input);
    expect(result.user).toEqual({ id: '1' });
  });

  it('loginUser posts to /auth/login and returns the user and access token', async () => {
    const input = { email: 'a@b.com', password: 'password123' };
    mock.onPost('/auth/login', input).reply(200, { user: { id: '1' }, accessToken: 'tok' });

    const result = await loginUser(input);
    expect(result).toEqual({ user: { id: '1' }, accessToken: 'tok' });
  });

  it('logoutUser posts to /auth/logout', async () => {
    mock.onPost('/auth/logout').reply(204);
    await expect(logoutUser()).resolves.toBeUndefined();
  });

  it('verifyEmail posts the token to /auth/verify-email', async () => {
    mock.onPost('/auth/verify-email', { token: 'tok123' }).reply(200, { user: { id: '1' } });
    const result = await verifyEmail('tok123');
    expect(result.user).toEqual({ id: '1' });
  });

  it('forgotPassword posts the email to /auth/forgot-password', async () => {
    mock.onPost('/auth/forgot-password', { email: 'a@b.com' }).reply(200, { message: 'sent' });
    const result = await forgotPassword('a@b.com');
    expect(result.message).toBe('sent');
  });

  it('resetPassword posts the token and password to /auth/reset-password', async () => {
    mock
      .onPost('/auth/reset-password', { token: 'tok', password: 'newpass123' })
      .reply(200, { message: 'ok' });
    const result = await resetPassword({ token: 'tok', password: 'newpass123' });
    expect(result.message).toBe('ok');
  });

  it('resendVerification posts the email to /auth/resend-verification', async () => {
    mock
      .onPost('/auth/resend-verification', { email: 'a@b.com' })
      .reply(200, { message: 'sent' });
    const result = await resendVerification('a@b.com');
    expect(result.message).toBe('sent');
  });

  it('googleLogin posts the idToken to /auth/google', async () => {
    mock
      .onPost('/auth/google', { idToken: 'id-token' })
      .reply(200, { user: { id: '1' }, accessToken: 'tok' });
    const result = await googleLogin('id-token');
    expect(result.accessToken).toBe('tok');
  });
});
