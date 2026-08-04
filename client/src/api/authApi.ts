import { apiClient } from './axiosClient';
import type { User } from '../types/user';

export interface RegisterInput {
  username: string;
  displayName: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export async function registerUser(input: RegisterInput): Promise<{ user: User }> {
  const res = await apiClient.post<{ user: User }>('/auth/register', input);
  return res.data;
}

export async function loginUser(input: LoginInput): Promise<{ user: User; accessToken: string }> {
  const res = await apiClient.post<{ user: User; accessToken: string }>('/auth/login', input);
  return res.data;
}

export async function logoutUser(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function verifyEmail(token: string): Promise<{ user: User }> {
  const res = await apiClient.post<{ user: User }>('/auth/verify-email', { token });
  return res.data;
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const res = await apiClient.post<{ message: string }>('/auth/forgot-password', { email });
  return res.data;
}

export async function resendVerification(email: string): Promise<{ message: string }> {
  const res = await apiClient.post<{ message: string }>('/auth/resend-verification', { email });
  return res.data;
}

export async function resetPassword(input: {
  token: string;
  password: string;
}): Promise<{ message: string }> {
  const res = await apiClient.post<{ message: string }>('/auth/reset-password', input);
  return res.data;
}

export async function googleLogin(idToken: string): Promise<{ user: User; accessToken: string }> {
  const res = await apiClient.post<{ user: User; accessToken: string }>('/auth/google', { idToken });
  return res.data;
}
