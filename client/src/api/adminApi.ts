import { apiClient } from './axiosClient';
import type { User } from '../types/user';

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  totalFriendships: number;
  totalMessages: number;
  totalReports: number;
}

export interface AdminReportItem {
  _id: string;
  reporterId: User;
  targetUserId: User;
  reason: string;
  details?: string;
  status: 'pending' | 'reviewed' | 'resolved';
  createdAt: string;
}

export async function getAdminStats(signal?: AbortSignal): Promise<{ stats: AdminStats }> {
  const response = await apiClient.get<{ stats: AdminStats }>('/admin/stats', { signal });
  return response.data;
}

export async function getAdminUsers(params?: {
  q?: string;
  status?: string;
  role?: string;
}, signal?: AbortSignal): Promise<{ users: User[] }> {
  const response = await apiClient.get<{ users: User[] }>('/admin/users', { params, signal });
  return response.data;
}

export async function updateAdminUserStatus(
  targetUserId: string,
  payload: { status?: 'active' | 'suspended' | 'banned'; role?: 'user' | 'admin' }
): Promise<{ user: User }> {
  const response = await apiClient.patch<{ user: User }>(`/admin/users/${targetUserId}`, payload);
  return response.data;
}

export async function deleteAdminUserAccount(targetUserId: string): Promise<void> {
  await apiClient.delete(`/admin/users/${targetUserId}`);
}

export async function getAdminReports(signal?: AbortSignal): Promise<{ reports: AdminReportItem[] }> {
  const response = await apiClient.get<{ reports: AdminReportItem[] }>('/admin/reports', { signal });
  return response.data;
}
