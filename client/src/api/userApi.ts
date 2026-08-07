import { apiClient } from './axiosClient';
import type { User, PrivacySettings } from '../types/user';

export async function getMe(signal?: AbortSignal): Promise<{ user: User }> {
  const res = await apiClient.get<{ user: User }>('/users/me', { signal });
  return res.data;
}

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  gender?: string;
  age?: number;
  country?: string;
  city?: string;
  interests?: string[];
  languages?: string[];
  avatarUrl?: string;
}

export async function updateMe(input: UpdateProfileInput): Promise<{ user: User }> {
  const res = await apiClient.patch<{ user: User }>('/users/me', input);
  return res.data;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export async function changePassword(input: ChangePasswordInput): Promise<{ message: string }> {
  const res = await apiClient.patch<{ message: string }>('/users/me/password', input);
  return res.data;
}

export interface SettingsPayload {
  theme: 'light' | 'dark' | 'system';
  privacy: PrivacySettings;
}

export async function getSettings(signal?: AbortSignal): Promise<SettingsPayload> {
  const res = await apiClient.get<SettingsPayload>('/users/me/settings', { signal });
  return res.data;
}

export interface UpdateSettingsInput {
  theme?: 'light' | 'dark' | 'system';
  privacy?: Partial<PrivacySettings>;
}

export async function updateSettings(input: UpdateSettingsInput): Promise<SettingsPayload> {
  const res = await apiClient.patch<SettingsPayload>('/users/me/settings', input);
  return res.data;
}

export async function registerPushToken(token: string): Promise<void> {
  await apiClient.put('/users/me/push-token', { token });
}

export async function unregisterPushToken(token: string): Promise<void> {
  await apiClient.delete('/users/me/push-token', { data: { token } });
}
