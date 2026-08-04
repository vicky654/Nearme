import { create } from 'zustand';
import { AppNotification, getNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification } from '../api/notificationApi';
import { playNotificationSound, getSoundEnabled, setSoundEnabled } from '../utils/soundService';
import { showBrowserNotification } from '../utils/browserNotificationService';
import { connectSocket } from '../api/socket';

export interface ActionToastData {
  id: string;
  notification: AppNotification;
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
  soundEnabled: getSoundEnabled(),
  activeToast: null,
  showWelcomeBackModal: false,
  welcomeBackCounts: { messages: 0, requests: 0 },

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const data = await getNotifications();
      set({
        notifications: data.notifications,
        unreadCount: data.unreadCount,
        grouped: data.grouped,
        isLoading: false,
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
    } catch {
      set({ isLoading: false });
    }
  },

  markAsRead: async (id: string) => {
    try {
      await markNotificationAsRead(id);
      const notifications = get().notifications.map((n) => (n._id === id ? { ...n, isRead: true } : n));
      const unreadCount = Math.max(0, get().unreadCount - 1);
      set({ notifications, unreadCount });
      get().fetchNotifications();
    } catch {
      // Best effort
    }
  },

  markAllRead: async () => {
    try {
      await markAllNotificationsAsRead();
      const notifications = get().notifications.map((n) => ({ ...n, isRead: true }));
      set({ notifications, unreadCount: 0 });
      get().fetchNotifications();
    } catch {
      // Best effort
    }
  },

  removeNotification: async (id: string) => {
    try {
      await deleteNotification(id);
      const notifications = get().notifications.filter((n) => n._id !== id);
      set({ notifications });
      get().fetchNotifications();
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
      // 1. Update state
      set((state) => ({
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + 1,
        activeToast: { id: `toast-${Date.now()}`, notification },
      }));

      // 2. Play sound
      if (notification.type === 'new_message') {
        playNotificationSound('message');
      } else {
        playNotificationSound('friend_request');
      }

      // 3. Desktop Browser Notification
      showBrowserNotification(notification.title, {
        body: notification.message,
        icon: notification.senderId?.avatarUrl,
        onClick: () => {
          if (notification.type === 'new_message' && notification.relatedId) {
            onNavigate('/chat', { conversationId: notification.relatedId });
          } else if (notification.type === 'friend_request_received') {
            onNavigate('/friends');
          }
        },
      });

      get().fetchNotifications();
    };

    socket.on('notification:new', handleNewNotif);

    return () => {
      socket.off('notification:new', handleNewNotif);
    };
  },
}));
