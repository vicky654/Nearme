import { apiClient } from './axiosClient';
import type { User } from '../types/user';

export interface ChatMessage {
  _id: string;
  conversationId: string;
  senderId: User | string;
  content: string;
  status: 'sent' | 'delivered' | 'seen';
  readBy: string[];
  editedAt?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationItem {
  _id: string;
  recipient: User | null;
  lastMessage?: ChatMessage;
  lastMessageAt?: string;
  unreadCount: number;
  isMuted: boolean;
  isArchived: boolean;
  updatedAt: string;
}

export async function getConversations(): Promise<{ conversations: ConversationItem[] }> {
  const response = await apiClient.get<{ conversations: ConversationItem[] }>('/chats');
  return response.data;
}

export async function createOrGetConversation(recipientId: string): Promise<{ conversation: ConversationItem }> {
  const response = await apiClient.post<{ conversation: ConversationItem }>('/chats', { recipientId });
  return response.data;
}

export async function getMessages(
  conversationId: string,
  before?: string,
  limit = 30
): Promise<{ messages: ChatMessage[] }> {
  const response = await apiClient.get<{ messages: ChatMessage[] }>(`/chats/${conversationId}/messages`, {
    params: { before, limit },
  });
  return response.data;
}

export async function sendMessage(conversationId: string, content: string): Promise<{ message: ChatMessage }> {
  const response = await apiClient.post<{ message: ChatMessage }>(`/chats/${conversationId}/messages`, { content });
  return response.data;
}

export async function editMessage(
  conversationId: string,
  messageId: string,
  content: string
): Promise<{ message: ChatMessage }> {
  const response = await apiClient.patch<{ message: ChatMessage }>(
    `/chats/${conversationId}/messages/${messageId}`,
    { content }
  );
  return response.data;
}

export async function deleteMessage(
  conversationId: string,
  messageId: string
): Promise<{ message: ChatMessage }> {
  const response = await apiClient.delete<{ message: ChatMessage }>(
    `/chats/${conversationId}/messages/${messageId}`
  );
  return response.data;
}

export async function markAsRead(conversationId: string): Promise<void> {
  await apiClient.post(`/chats/${conversationId}/read`);
}

export async function toggleMute(conversationId: string): Promise<{ isMuted: boolean }> {
  const response = await apiClient.post<{ isMuted: boolean }>(`/chats/${conversationId}/mute`);
  return response.data;
}

export async function toggleArchive(conversationId: string): Promise<{ isArchived: boolean }> {
  const response = await apiClient.post<{ isArchived: boolean }>(`/chats/${conversationId}/archive`);
  return response.data;
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await apiClient.delete(`/chats/${conversationId}`);
}
