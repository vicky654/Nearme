import { create } from 'zustand';
import type { ChatMessage, ConversationItem } from '../api/chatApi';

interface ChatStore {
  activeConversationId: string | null;
  conversations: ConversationItem[];
  messagesMap: Record<string, ChatMessage[]>;
  typingMap: Record<string, { userId: string; displayName: string }[]>; // conversationId -> typing users
  onlineUsers: Set<string>; // userIds online

  setActiveConversationId: (id: string | null) => void;
  setConversations: (conversations: ConversationItem[]) => void;
  updateConversation: (conversationId: string, patch: Partial<ConversationItem>) => void;
  setMessages: (conversationId: string, messages: ChatMessage[]) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessage: (conversationId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  deleteMessageInStore: (conversationId: string, messageId: string) => void;
  setTyping: (conversationId: string, user: { userId: string; displayName: string } | null) => void;
  removeTyping: (conversationId: string, userId: string) => void;
  setUserOnline: (userId: string, isOnline: boolean) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  activeConversationId: null,
  conversations: [],
  messagesMap: {},
  typingMap: {},
  onlineUsers: new Set<string>(),

  setActiveConversationId: (id) => set({ activeConversationId: id }),

  setConversations: (conversations) => set({ conversations }),

  updateConversation: (conversationId, patch) =>
    set((state) => ({
      conversations: state.conversations.map((c) => (c._id === conversationId ? { ...c, ...patch } : c)),
    })),

  setMessages: (conversationId, messages) =>
    set((state) => ({
      messagesMap: { ...state.messagesMap, [conversationId]: messages },
    })),

  addMessage: (conversationId, message) =>
    set((state) => {
      const existing = state.messagesMap[conversationId] || [];
      // Replace optimistic or append
      const filtered = existing.filter((m) => m._id !== message._id);
      return {
        messagesMap: { ...state.messagesMap, [conversationId]: [...filtered, message] },
      };
    }),

  updateMessage: (conversationId, messageId, patch) =>
    set((state) => {
      const existing = state.messagesMap[conversationId] || [];
      const updated = existing.map((m) => (m._id === messageId ? { ...m, ...patch } : m));
      return {
        messagesMap: { ...state.messagesMap, [conversationId]: updated },
      };
    }),

  deleteMessageInStore: (conversationId, messageId) =>
    set((state) => {
      const existing = state.messagesMap[conversationId] || [];
      const updated = existing.map((m) =>
        m._id === messageId ? { ...m, deletedAt: new Date().toISOString(), content: 'This message was deleted' } : m
      );
      return {
        messagesMap: { ...state.messagesMap, [conversationId]: updated },
      };
    }),

  setTyping: (conversationId, user) =>
    set((state) => {
      if (!user) {
        return { typingMap: { ...state.typingMap, [conversationId]: [] } };
      }
      const existing = state.typingMap[conversationId] || [];
      if (existing.some((u) => u.userId === user.userId)) return state;
      return {
        typingMap: { ...state.typingMap, [conversationId]: [...existing, user] },
      };
    }),

  removeTyping: (conversationId, userId) =>
    set((state) => {
      const existing = state.typingMap[conversationId] || [];
      const updated = existing.filter((u) => u.userId !== userId);
      return {
        typingMap: { ...state.typingMap, [conversationId]: updated },
      };
    }),

  setUserOnline: (userId, isOnline) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      if (isOnline) next.add(userId.toString());
      else next.delete(userId.toString());
      return { onlineUsers: next };
    }),
}));
