import { apiClient } from './axiosClient';
import type { User } from '../types/user';

export interface ChatMessage {
  _id: string;
  clientId?: string;
  conversationId: string;
  senderId: User | string;
  content: string;
  status: 'sending' | 'failed' | 'sent' | 'delivered' | 'seen';
  readBy: string[];
  replyTo?: Pick<ChatMessage, '_id' | 'senderId' | 'content' | 'deletedAt'> | string;
  reactions?: Array<{ emoji: string; userId: string }>;
  attachments?: ChatAttachment[];
  editedAt?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatAttachment {
  type: 'image' | 'audio' | 'file';
  url: string;
  name: string;
  mimeType: string;
  size: number;
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

export async function sendMessage(
  conversationId: string,
  content: string,
  options?: { clientId?: string; replyToId?: string; attachments?: ChatAttachment[] }
): Promise<{ message: ChatMessage }> {
  const response = await apiClient.post<{ message: ChatMessage }>(`/chats/${conversationId}/messages`, {
    content,
    ...options,
  });
  return response.data;
}

export async function uploadChatAttachment(
  conversationId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ attachment: ChatAttachment }> {
  const data = new FormData();
  data.append('attachment', file);
  const response = await apiClient.post<{ attachment: ChatAttachment }>(`/chats/${conversationId}/attachments`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30_000,
    onUploadProgress: (event) => {
      if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100));
    },
  });
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
