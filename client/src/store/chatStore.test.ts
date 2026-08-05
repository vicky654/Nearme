import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage, ConversationItem } from '../api/chatApi';
import { useChatStore } from './chatStore';

const baseMessage: ChatMessage = {
  _id: 'message-1',
  clientId: 'client-1',
  conversationId: 'conversation-1',
  senderId: 'user-1',
  content: 'Hello',
  status: 'sending',
  readBy: ['user-1'],
  reactions: [],
  attachments: [],
  createdAt: '2026-08-05T10:00:00.000Z',
  updatedAt: '2026-08-05T10:00:00.000Z',
};

const conversations: ConversationItem[] = [
  { _id: 'conversation-1', recipient: null, unreadCount: 0, isMuted: false, isArchived: false, updatedAt: '2026-08-05T09:00:00.000Z' },
  { _id: 'conversation-2', recipient: null, unreadCount: 1, isMuted: false, isArchived: false, updatedAt: '2026-08-05T09:30:00.000Z' },
];

describe('chatStore', () => {
  beforeEach(() => {
    useChatStore.setState({
      activeConversationId: null,
      visibleConversationId: null,
      conversations: [],
      messagesMap: {},
      typingMap: {},
      onlineUsers: new Set(),
      lastSeenMap: {},
      drafts: {},
    });
    vi.useRealTimers();
  });

  it('reconciles an optimistic message by client ID without creating a duplicate', () => {
    useChatStore.getState().addMessage('conversation-1', { ...baseMessage, _id: 'temp-client-1' });
    useChatStore.getState().reconcileMessage('conversation-1', { ...baseMessage, _id: 'server-message-1', status: 'delivered' });

    expect(useChatStore.getState().messagesMap['conversation-1']).toEqual([
      expect.objectContaining({ _id: 'server-message-1', status: 'delivered' }),
    ]);
  });

  it('moves an updated conversation to the top and applies only its unread delta', () => {
    useChatStore.getState().setConversations(conversations);
    useChatStore.getState().updateConversationFromMessage('conversation-1', { ...baseMessage, createdAt: '2026-08-05T11:00:00.000Z' }, 2);

    const state = useChatStore.getState();
    expect(state.conversations[0]?._id).toBe('conversation-1');
    expect(state.conversations[0]?.unreadCount).toBe(2);
    expect(state.conversations[1]?.unreadCount).toBe(1);
  });

  it('advances delivery state for the current user’s outgoing messages only', () => {
    useChatStore.getState().setMessages('conversation-1', [
      { ...baseMessage, status: 'sent' },
      { ...baseMessage, _id: 'incoming', clientId: undefined, senderId: 'user-2', status: 'sent' },
    ]);
    useChatStore.getState().updateMessagesStatus('conversation-1', 'seen', 'user-1');

    expect(useChatStore.getState().messagesMap['conversation-1']?.map((message) => message.status)).toEqual(['seen', 'sent']);
  });

  it('expires a typing indicator if a stop event is lost', () => {
    vi.useFakeTimers();
    useChatStore.getState().setTyping('conversation-1', { userId: 'user-2', displayName: 'Bob' });
    expect(useChatStore.getState().typingMap['conversation-1']).toHaveLength(1);
    vi.advanceTimersByTime(4_501);
    expect(useChatStore.getState().typingMap['conversation-1']).toHaveLength(0);
  });

  it('clears retained chat data and pending typing timers on reset', () => {
    vi.useFakeTimers();
    useChatStore.getState().setConversations(conversations);
    useChatStore.getState().setMessages('conversation-1', [baseMessage]);
    useChatStore.getState().setDraft('conversation-1', 'unfinished');
    useChatStore.getState().setTyping('conversation-1', { userId: 'user-2', displayName: 'Bob' });

    useChatStore.getState().reset();
    vi.advanceTimersByTime(5_000);

    expect(useChatStore.getState()).toMatchObject({
      activeConversationId: null,
      visibleConversationId: null,
      conversations: [],
      messagesMap: {},
      typingMap: {},
      drafts: {},
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds inactive conversation message caches', () => {
    for (let index = 0; index < 21; index += 1) {
      useChatStore.getState().setMessages(`conversation-${index}`, [{
        ...baseMessage,
        _id: `message-${index}`,
        conversationId: `conversation-${index}`,
      }]);
    }

    expect(Object.keys(useChatStore.getState().messagesMap)).toHaveLength(20);
    expect(useChatStore.getState().messagesMap['conversation-0']).toBeUndefined();
    expect(useChatStore.getState().messagesMap['conversation-20']).toHaveLength(1);
  });
});
