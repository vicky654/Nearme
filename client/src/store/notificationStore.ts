import { create } from 'zustand';
import { AppNotification, getNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification } from '../api/notificationApi';
import { playNotificationSound, getSoundEnabled, setSoundEnabled } from '../utils/soundService';
import { showBrowserNotification } from '../utils/browserNotificationService';
import { connectSocket } from '../api/socket';
import { getFriendlyApiError } from '../api/errors';
import { useChatStore } from './chatStore';
import { Capacitor } from '@capacitor/core';
import { Haptics, NotificationType as HapticNotificationType } from '@capacitor/haptics';

export interface ActionToastData {
  id: string;
  notification: AppNotification;
}

function groupNotifications(notifications: AppNotification[]) {
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  return notifications.reduce<NotificationStore['grouped']>((groups, notification) => {
    const createdAt = new Date(notification.createdAt);
    if (createdAt >= startToday) groups.today.push(notification);
    else if (createdAt >= startYesterday) groups.yesterday.push(notification);
    else groups.earlier.push(notification);
    return groups;
  }, { today: [], yesterday: [], earlier: [] });
}

interface NotificationStore {
  notifications: AppNotification[];
  unreadCount: number;
  grouped: {
    today: AppNotification[];
    yesterday: AppNotification[];
    earlier: AppNotification[];
  };
  isLoading: boolean;
  error: string | null;
  soundEnabled: boolean;
  activeToast: ActionToastData | null; // Latest incoming toast
  showWelcomeBackModal: boolean;
  welcomeBackCounts: { messages: number; requests: number };

  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  removeNotification: (id: string) => Promise<void>;
  toggleSound: () => void;
  closeToast: () => void;
  closeWelcomeBackModal: () => void;
  bindSocketListeners: (onNavigate: (path: string, state?: any) => void) => () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  grouped: { today: [], yesterday: [], earlier: [] },
  isLoading: false,
  error: null,
  soundEnabled: getSoundEnabled(),
  activeToast: null,
  showWelcomeBackModal: false,
  welcomeBackCounts: { messages: 0, requests: 0 },

  fetchNotifications: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await getNotifications();
      set({
        notifications: data.notifications,
        unreadCount: data.unreadCount,
        grouped: data.grouped,
        isLoading: false,
        error: null,
      });

      // Check if user returned with unread items and popup hasn't been shown this session
      const hasShownPopup = sessionStorage.getItem('nearme_welcome_popup_shown');
      if (!hasShownPopup && data.unreadCount > 0) {
        let msgCount = 0;
        let reqCount = 0;
        data.notifications.forEach((n) => {
          if (!n.isRead) {
            if (n.type === 'new_message') msgCount++;
            if (n.type === 'friend_request_received') reqCount++;
          }
        });

        if (msgCount > 0 || reqCount > 0) {
          sessionStorage.setItem('nearme_welcome_popup_shown', 'true');
          set({
            showWelcomeBackModal: true,
            welcomeBackCounts: { messages: msgCount, requests: reqCount },
          });
        }
      }
    } catch (error) {
      set({ isLoading: false, error: getFriendlyApiError(error, 'Unable to load notifications.').message });
    }
  },

  markAsRead: async (id: string) => {
    try {
      await markNotificationAsRead(id);
      const wasUnread = get().notifications.some((notification) => notification._id === id && !notification.isRead);
      const notifications = get().notifications.map((n) => (n._id === id ? { ...n, isRead: true } : n));
      const unreadCount = Math.max(0, get().unreadCount - (wasUnread ? 1 : 0));
      set({ notifications, unreadCount, grouped: groupNotifications(notifications) });
    } catch {
      // Best effort
    }
  },

  markAllRead: async () => {
    try {
      await markAllNotificationsAsRead();
      const notifications = get().notifications.map((n) => ({ ...n, isRead: true }));
      set({ notifications, unreadCount: 0, grouped: groupNotifications(notifications) });
    } catch {
      // Best effort
    }
  },

  removeNotification: async (id: string) => {
    try {
      await deleteNotification(id);
      const removed = get().notifications.find((notification) => notification._id === id);
      const notifications = get().notifications.filter((n) => n._id !== id);
      set({
        notifications,
        unreadCount: Math.max(0, get().unreadCount - (removed && !removed.isRead ? 1 : 0)),
        grouped: groupNotifications(notifications),
      });
    } catch {
      // Best effort
    }
  },

  toggleSound: () => {
    const next = !get().soundEnabled;
    setSoundEnabled(next);
    set({ soundEnabled: next });
  },

  closeToast: () => set({ activeToast: null }),

  closeWelcomeBackModal: () => set({ showWelcomeBackModal: false }),

  bindSocketListeners: (onNavigate) => {
    const socket = connectSocket();

    const handleNewNotif = ({ notification }: { notification: AppNotification }) => {
      const chatState = useChatStore.getState();
      const isVisibleConversation = notification.type === 'new_message'
        && notification.relatedId === chatState.visibleConversationId
        && document.visibilityState !== 'hidden';

      if (isVisibleConversation) {
        void markNotificationAsRead(notification._id).catch(() => undefined);
        return;
      }

      const existing = get().notifications.some((candidate) => candidate._id === notification._id);
      if (!existing) {
        set((state) => {
          const notifications = [notification, ...state.notifications];
          return {
            notifications,
            grouped: groupNotifications(notifications),
            unreadCount: state.unreadCount + 1,
            activeToast: { id: `toast-${notification._id}`, notification },
          };
        });
      }

      const conversation = notification.relatedId
        ? chatState.conversations.find((candidate) => candidate._id === notification.relatedId)
        : undefined;
      const shouldAlert = !conversation?.isMuted;

      if (shouldAlert && notification.type === 'new_message') {
        playNotificationSound('message');
        if (Capacitor.isNativePlatform()) {
          void Haptics.notification({ type: HapticNotificationType.Success }).catch(() => undefined);
        }
      } else if (shouldAlert) {
        playNotificationSound('friend_request');
      }

      if (shouldAlert && document.visibilityState === 'hidden') {
        showBrowserNotification(notification.title, {
          body: notification.message,
          icon: notification.senderId?.avatarUrl,
          onClick: () => {
            if (notification.type === 'new_message' && notification.relatedId) {
              onNavigate('/chat', { conversationId: notification.relatedId });
            } else if (notification.type === 'friend_request_received') {
              onNavigate('/friends');
            }
          }
        });
      }
    };

    socket.on('notification:new', handleNewNotif);

    return () => {
      socket.off('notification:new', handleNewNotif);
    };
  },
}));
