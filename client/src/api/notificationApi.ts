import { apiClient } from './axiosClient';
import type { User } from '../types/user';

export type NotificationType =
  | 'friend_request_received'
  | 'friend_request_accepted'
  | 'new_message'
  | 'system';

export interface AppNotification {
  _id: string;
  receiverId: string;
  senderId: User;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
  grouped: {
    today: AppNotification[];
    yesterday: AppNotification[];
    earlier: AppNotification[];
  };
}

export async function getNotifications(signal?: AbortSignal): Promise<NotificationsResponse> {
  const response = await apiClient.get<NotificationsResponse>('/notifications', { signal });
  return response.data;
}

export async function markNotificationAsRead(id: string): Promise<{ notification: AppNotification }> {
  const response = await apiClient.patch<{ notification: AppNotification }>(`/notifications/${id}/read`);
  return response.data;
}

export async function markAllNotificationsAsRead(): Promise<void> {
  await apiClient.patch('/notifications/read-all');
}

export async function deleteNotification(id: string): Promise<void> {
  await apiClient.delete(`/notifications/${id}`);
}
