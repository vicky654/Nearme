import { create } from 'zustand';
import type { ChatMessage, ConversationItem } from '../api/chatApi';

export interface TypingUser {
  userId: string;
  displayName: string;
  activity?: 'typing' | 'recording';
}

interface ChatStore {
  activeConversationId: string | null;
  visibleConversationId: string | null;
  conversations: ConversationItem[];
  messagesMap: Record<string, ChatMessage[]>;
  typingMap: Record<string, TypingUser[]>;
  onlineUsers: Set<string>;
  lastSeenMap: Record<string, string | null>;
  drafts: Record<string, string>;

  setActiveConversationId: (id: string | null) => void;
  setVisibleConversationId: (id: string | null) => void;
  setConversations: (conversations: ConversationItem[]) => void;
  updateConversation: (conversationId: string, patch: Partial<ConversationItem>) => void;
  updateConversationFromMessage: (conversationId: string, message: ChatMessage, unreadDelta?: number) => void;
  setMessages: (conversationId: string, messages: ChatMessage[]) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  addMessages: (conversationId: string, messages: ChatMessage[]) => void;
  reconcileMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessage: (conversationId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  updateMessagesStatus: (conversationId: string, status: ChatMessage['status'], currentUserId: string) => void;
  deleteMessageInStore: (conversationId: string, messageId: string) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  setTyping: (conversationId: string, user: TypingUser | null) => void;
  removeTyping: (conversationId: string, userId: string) => void;
  setUserPresence: (userId: string, isOnline: boolean, lastSeenAt?: string | null) => void;
  setDraft: (conversationId: string, draft: string) => void;
  reset: () => void;
}

const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const MAX_CACHED_MESSAGES_PER_CONVERSATION = 10_000;
const STATUS_RANK: Record<ChatMessage['status'], number> = {
  failed: -1,
  sending: 0,
  sent: 1,
  delivered: 2,
  seen: 3,
};

function sortMessages(messages: ChatMessage[]) {
  return messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]) {
  const merged = new Map(existing.map((message) => [message._id, message]));
  incoming.forEach((message) => {
    const optimisticMatch = message.clientId
      ? [...merged.values()].find((candidate) => candidate.clientId === message.clientId)
      : undefined;
    if (optimisticMatch && optimisticMatch._id !== message._id) merged.delete(optimisticMatch._id);
    merged.set(message._id, { ...merged.get(message._id), ...message });
  });
  return sortMessages([...merged.values()]).slice(-MAX_CACHED_MESSAGES_PER_CONVERSATION);
}

function sortConversations(conversations: ConversationItem[]) {
  return [...conversations].sort((a, b) =>
    new Date(b.lastMessageAt || b.updatedAt).getTime() - new Date(a.lastMessageAt || a.updatedAt).getTime()
  );
}

export const useChatStore = create<ChatStore>((set) => ({
  activeConversationId: null,
  visibleConversationId: null,
  conversations: [],
  messagesMap: {},
  typingMap: {},
  onlineUsers: new Set<string>(),
  lastSeenMap: {},
  drafts: {},

  setActiveConversationId: (id) => set({ activeConversationId: id }),
  setVisibleConversationId: (id) => set({ visibleConversationId: id }),
  setConversations: (conversations) => set({ conversations: sortConversations(conversations) }),

  updateConversation: (conversationId, patch) => set((state) => ({
    conversations: sortConversations(
      state.conversations.map((conversation) =>
        conversation._id === conversationId ? { ...conversation, ...patch } : conversation
      )
    ),
  })),

  updateConversationFromMessage: (conversationId, message, unreadDelta = 0) => set((state) => ({
    conversations: sortConversations(state.conversations.map((conversation) =>
      conversation._id === conversationId
        ? {
            ...conversation,
            lastMessage: message,
            lastMessageAt: message.createdAt,
            unreadCount: Math.max(0, conversation.unreadCount + unreadDelta),
          }
        : conversation
    )),
  })),

  setMessages: (conversationId, messages) => set((state) => ({
    messagesMap: { ...state.messagesMap, [conversationId]: mergeMessages([], messages) },
  })),

  addMessage: (conversationId, message) => set((state) => ({
    messagesMap: {
      ...state.messagesMap,
      [conversationId]: mergeMessages(state.messagesMap[conversationId] || [], [message]),
    },
  })),

  addMessages: (conversationId, messages) => set((state) => ({
    messagesMap: {
      ...state.messagesMap,
      [conversationId]: mergeMessages(state.messagesMap[conversationId] || [], messages),
    },
  })),

  reconcileMessage: (conversationId, message) => set((state) => ({
    messagesMap: {
      ...state.messagesMap,
      [conversationId]: mergeMessages(state.messagesMap[conversationId] || [], [message]),
    },
  })),

  updateMessage: (conversationId, messageId, patch) => set((state) => ({
    messagesMap: {
      ...state.messagesMap,
      [conversationId]: (state.messagesMap[conversationId] || []).map((message) =>
        message._id === messageId ? { ...message, ...patch } : message
      ),
    },
  })),

  updateMessagesStatus: (conversationId, status, currentUserId) => set((state) => ({
    messagesMap: {
      ...state.messagesMap,
      [conversationId]: (state.messagesMap[conversationId] || []).map((message) => {
        const senderId = typeof message.senderId === 'string' ? message.senderId : message.senderId._id || message.senderId.id;
        if (senderId !== currentUserId || STATUS_RANK[message.status] >= STATUS_RANK[status]) return message;
        return { ...message, status };
      }),
    },
  })),

  deleteMessageInStore: (conversationId, messageId) => set((state) => ({
    messagesMap: {
      ...state.messagesMap,
      [conversationId]: (state.messagesMap[conversationId] || []).map((message) =>
        message._id === messageId
          ? { ...message, deletedAt: new Date().toISOString(), content: 'This message was deleted' }
          : message
      ),
    },
  })),

  removeMessage: (conversationId, messageId) => set((state) => ({
    messagesMap: {
      ...state.messagesMap,
      [conversationId]: (state.messagesMap[conversationId] || []).filter((message) => message._id !== messageId),
    },
  })),

  setTyping: (conversationId, user) => set((state) => {
    if (!user) return { typingMap: { ...state.typingMap, [conversationId]: [] } };
    const key = `${conversationId}:${user.userId}`;
    const existingTimer = typingTimers.get(key);
    if (existingTimer) clearTimeout(existingTimer);
    typingTimers.set(key, setTimeout(() => {
      useChatStore.getState().removeTyping(conversationId, user.userId);
      typingTimers.delete(key);
    }, 4_500));
    const existing = state.typingMap[conversationId] || [];
    return {
      typingMap: {
        ...state.typingMap,
        [conversationId]: [...existing.filter((candidate) => candidate.userId !== user.userId), user],
      },
    };
  }),

  removeTyping: (conversationId, userId) => set((state) => {
    const key = `${conversationId}:${userId}`;
    const timer = typingTimers.get(key);
    if (timer) clearTimeout(timer);
    typingTimers.delete(key);
    return {
      typingMap: {
        ...state.typingMap,
        [conversationId]: (state.typingMap[conversationId] || []).filter((user) => user.userId !== userId),
      },
    };
  }),

  setUserPresence: (userId, isOnline, lastSeenAt) => set((state) => {
    const onlineUsers = new Set(state.onlineUsers);
    if (isOnline) onlineUsers.add(userId);
    else onlineUsers.delete(userId);
    return {
      onlineUsers,
      lastSeenMap: lastSeenAt === undefined
        ? state.lastSeenMap
        : { ...state.lastSeenMap, [userId]: lastSeenAt },
    };
  }),

  setDraft: (conversationId, draft) => set((state) => {
    const drafts = { ...state.drafts };
    if (draft) drafts[conversationId] = draft;
    else delete drafts[conversationId];
    return { drafts };
  }),

  reset: () => {
    typingTimers.forEach(clearTimeout);
    typingTimers.clear();
    set({
      activeConversationId: null,
      visibleConversationId: null,
      conversations: [],
      messagesMap: {},
      typingMap: {},
      onlineUsers: new Set<string>(),
      lastSeenMap: {},
      drafts: {},
    });
  },
}));
