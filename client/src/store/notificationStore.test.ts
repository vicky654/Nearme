import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppNotification } from '../api/notificationApi';
import { useChatStore } from './chatStore';

const { mockSocketHandlers, mockPlayNotificationSound, mockMarkNotificationAsRead, mockGetNotifications } = vi.hoisted(() => ({
  mockSocketHandlers: new Map<string, (payload: unknown) => void>(),
  mockPlayNotificationSound: vi.fn(),
  mockMarkNotificationAsRead: vi.fn().mockResolvedValue({}),
  mockGetNotifications: vi.fn(),
}));

vi.mock('../api/socket', () => ({
  connectSocket: () => ({
    on: (event: string, handler: (payload: unknown) => void) => mockSocketHandlers.set(event, handler),
    off: (event: string) => mockSocketHandlers.delete(event),
  }),
}));

vi.mock('../api/notificationApi', async () => {
  const actual = await vi.importActual<typeof import('../api/notificationApi')>('../api/notificationApi');
  return {
    ...actual,
    getNotifications: mockGetNotifications,
    markNotificationAsRead: mockMarkNotificationAsRead,
    markAllNotificationsAsRead: vi.fn(),
    deleteNotification: vi.fn(),
  };
});

vi.mock('../utils/soundService', () => ({
  getSoundEnabled: () => true,
  setSoundEnabled: vi.fn(),
  playNotificationSound: mockPlayNotificationSound,
}));

vi.mock('../utils/browserNotificationService', () => ({ showBrowserNotification: vi.fn() }));

import { useNotificationStore } from './notificationStore';

const messageNotification = {
  _id: 'notification-1',
  receiverId: 'user-1',
  senderId: { _id: 'user-2', displayName: 'Bob', avatarUrl: 'bob.png' },
  type: 'new_message',
  title: 'New message from Bob',
  message: 'Hello',
  relatedId: 'conversation-1',
  isRead: false,
  createdAt: new Date().toISOString(),
} as AppNotification;

describe('notificationStore chat suppression', () => {
  beforeEach(() => {
    mockSocketHandlers.clear();
    mockPlayNotificationSound.mockClear();
    mockMarkNotificationAsRead.mockClear();
    mockGetNotifications.mockReset();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    useChatStore.setState({ visibleConversationId: null, conversations: [] });
    useNotificationStore.setState({
      notifications: [],
      unreadCount: 0,
      grouped: { today: [], yesterday: [], earlier: [] },
      activeToast: null,
    });
  });

  it('does not increment badges, toast, or sound for the visible conversation', () => {
    useChatStore.setState({ visibleConversationId: 'conversation-1' });
    const cleanup = useNotificationStore.getState().bindSocketListeners(vi.fn());
    mockSocketHandlers.get('notification:new')?.({ notification: messageNotification });

    expect(useNotificationStore.getState().unreadCount).toBe(0);
    expect(useNotificationStore.getState().activeToast).toBeNull();
    expect(mockPlayNotificationSound).not.toHaveBeenCalled();
    expect(mockMarkNotificationAsRead).toHaveBeenCalledWith('notification-1');
    cleanup();
  });

  it('increments unread state and alerts outside the conversation', () => {
    const cleanup = useNotificationStore.getState().bindSocketListeners(vi.fn());
    mockSocketHandlers.get('notification:new')?.({ notification: messageNotification });

    expect(useNotificationStore.getState().unreadCount).toBe(1);
    expect(useNotificationStore.getState().activeToast?.notification._id).toBe('notification-1');
    expect(mockPlayNotificationSound).toHaveBeenCalledWith('message');
    cleanup();
  });

  it('ignores a duplicate socket notification and alerts only once', () => {
    const cleanup = useNotificationStore.getState().bindSocketListeners(vi.fn());
    const handler = mockSocketHandlers.get('notification:new');
    handler?.({ notification: messageNotification });
    handler?.({ notification: messageNotification });

    expect(useNotificationStore.getState().unreadCount).toBe(1);
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
    expect(mockPlayNotificationSound).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('deduplicates concurrent notification fetches', async () => {
    mockGetNotifications.mockResolvedValue({
      notifications: [],
      unreadCount: 0,
      grouped: { today: [], yesterday: [], earlier: [] },
    });

    await Promise.all([
      useNotificationStore.getState().fetchNotifications(),
      useNotificationStore.getState().fetchNotifications(),
    ]);

    expect(mockGetNotifications).toHaveBeenCalledTimes(1);
    expect(useNotificationStore.getState().isLoading).toBe(false);
  });

  it('aborts an in-flight notification fetch when the store resets', async () => {
    let receivedSignal: AbortSignal | undefined;
    mockGetNotifications.mockImplementation((signal?: AbortSignal) => {
      receivedSignal = signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      });
    });

    const pending = useNotificationStore.getState().fetchNotifications();
    useNotificationStore.getState().reset();
    await pending;

    expect(receivedSignal?.aborted).toBe(true);
    expect(useNotificationStore.getState().isLoading).toBe(false);
  });
});
