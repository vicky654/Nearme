import { apiClient } from './axiosClient';
import type { User } from '../types/user';

export interface NearbyUserItem {
  user: User;
  location: {
    latitude: number | null;
    longitude: number | null;
    hasLocation: boolean;
  };
  distanceKm: number | null;
  mutualInterests: string[];
  connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'connected';
  friendshipId?: string;
}

export interface NearbyMeta {
  showingAllUsers: boolean;
  totalRegistered: number;
  totalOnline: number;
  radiusKm: number;
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

export async function updateLocation(latitude: number, longitude: number, accuracy?: number): Promise<void> {
  await apiClient.patch('/users/location', { latitude, longitude, accuracy });
}

export async function getNearbyUsers(radius = 20, signal?: AbortSignal): Promise<{ users: NearbyUserItem[]; meta?: NearbyMeta }> {
  const response = await apiClient.get<{ users: NearbyUserItem[]; meta?: NearbyMeta }>('/users/nearby', {
    params: { radius },
    signal,
  });
  return response.data;
}

export async function searchUsers(params: {
  q?: string;
  city?: string;
  country?: string;
  interests?: string;
}, signal?: AbortSignal): Promise<{ users: SearchUserItem[] }> {
  const response = await apiClient.get<{ users: SearchUserItem[] }>('/users/search', { params, signal });
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

export async function getFriends(signal?: AbortSignal): Promise<{ friends: FriendItem[] }> {
  const response = await apiClient.get<{ friends: FriendItem[] }>('/friends', { signal });
  return response.data;
}

export async function getFriendRequests(signal?: AbortSignal): Promise<FriendRequestsResponse> {
  const response = await apiClient.get<FriendRequestsResponse>('/friends/requests', { signal });
  return response.data;
}

export async function reportUser(targetUserId: string, reason: string, details?: string): Promise<void> {
  await apiClient.post('/users/report', { targetUserId, reason, details });
}
