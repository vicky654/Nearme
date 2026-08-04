import { apiClient } from './axiosClient';
import type { User } from '../types/user';

export interface NearbyUserItem {
  user: User;
  distanceKm: number | null;
  mutualInterests: string[];
  connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'connected';
  friendshipId?: string;
}

export interface SearchUserItem {
  user: User;
  mutualInterests: string[];
  connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'connected';
  friendshipId?: string;
}

export interface FriendItem {
  friendshipId: string;
  user: User;
}

export interface FriendRequestItem {
  id: string;
  user: User;
  createdAt: string;
}

export interface FriendRequestsResponse {
  incoming: FriendRequestItem[];
  outgoing: FriendRequestItem[];
  blocked: User[];
}

export async function updateLocation(latitude: number, longitude: number): Promise<void> {
  await apiClient.patch('/users/location', { latitude, longitude });
}

export async function getNearbyUsers(radius = 20): Promise<{ users: NearbyUserItem[] }> {
  const response = await apiClient.get<{ users: NearbyUserItem[] }>('/users/nearby', {
    params: { radius },
  });
  return response.data;
}

export async function searchUsers(params: {
  q?: string;
  city?: string;
  country?: string;
  interests?: string;
}): Promise<{ users: SearchUserItem[] }> {
  const response = await apiClient.get<{ users: SearchUserItem[] }>('/users/search', { params });
  return response.data;
}

export async function sendFriendRequest(targetUserId: string): Promise<void> {
  await apiClient.post('/friends/request', { targetUserId });
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  await apiClient.post('/friends/accept', { requestId });
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
  await apiClient.post('/friends/reject', { requestId });
}

export async function cancelFriendRequest(requestId: string): Promise<void> {
  await apiClient.post('/friends/cancel', { requestId });
}

export async function removeFriend(friendId: string): Promise<void> {
  await apiClient.delete(`/friends/${friendId}`);
}

export async function blockUser(targetUserId: string): Promise<void> {
  await apiClient.post('/friends/block', { targetUserId });
}

export async function unblockUser(targetUserId: string): Promise<void> {
  await apiClient.post('/friends/unblock', { targetUserId });
}

export async function getFriends(): Promise<{ friends: FriendItem[] }> {
  const response = await apiClient.get<{ friends: FriendItem[] }>('/friends');
  return response.data;
}

export async function getFriendRequests(): Promise<FriendRequestsResponse> {
  const response = await apiClient.get<FriendRequestsResponse>('/friends/requests');
  return response.data;
}

export async function reportUser(targetUserId: string, reason: string, details?: string): Promise<void> {
  await apiClient.post('/users/report', { targetUserId, reason, details });
}
