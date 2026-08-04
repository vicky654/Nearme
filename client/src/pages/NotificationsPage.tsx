import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../store/notificationStore';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { AppNotification } from '../api/notificationApi';

type FilterType = 'all' | 'unread' | 'requests' | 'messages';

export default function NotificationsPage() {
  const [filter, setFilter] = useState<FilterType>('all');
  const navigate = useNavigate();

  const {
    notifications,
    grouped,
    isLoading,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllRead,
    removeNotification,
  } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  function filterItems(items: AppNotification[]) {
    return items.filter((n) => {
      if (filter === 'unread') return !n.isRead;
      if (filter === 'requests')
        return n.type === 'friend_request_received' || n.type === 'friend_request_accepted';
      if (filter === 'messages') return n.type === 'new_message';
      return true;
    });
  }

  const todayItems = filterItems(grouped.today || []);
  const yesterdayItems = filterItems(grouped.yesterday || []);
  const earlierItems = filterItems(grouped.earlier || []);

  const totalFilteredCount = todayItems.length + yesterdayItems.length + earlierItems.length;

  function handleNotificationClick(n: AppNotification) {
    if (!n.isRead) {
      markAsRead(n._id);
    }
    if (n.type === 'new_message' && n.relatedId) {
      navigate('/chat', { state: { conversationId: n.relatedId } });
    } else if (
      n.type === 'friend_request_received' ||
      n.type === 'friend_request_accepted'
    ) {
      navigate('/friends');
    }
  }

  function renderGroup(title: string, items: AppNotification[]) {
    if (items.length === 0) return null;

    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {title} ({items.length})
        </h3>
        <div className="flex flex-col gap-2">
          {items.map((n) => (
            <div
              key={n._id}
              onClick={() => handleNotificationClick(n)}
              className={`flex cursor-pointer items-start justify-between gap-4 rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md ${
                n.isRead
                  ? 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
                  : 'border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/60 dark:bg-indigo-950/30'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <img
                  src={n.senderId?.avatarUrl || 'https://via.placeholder.com/40'}
                  alt={n.senderId?.displayName || 'User'}
                  className="h-11 w-11 rounded-full object-cover flex-shrink-0"
                />
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{n.title}</span>
                    {!n.isRead && (
                      <span className="h-2 w-2 rounded-full bg-indigo-600 flex-shrink-0" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{n.message}</p>
                  <span className="mt-2 text-[10px] text-gray-400">
                    {new Date(n.createdAt).toLocaleDateString()} at{' '}
                    {new Date(n.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!n.isRead && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(n._id);
                    }}
                    className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    Mark read
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeNotification(n._id);
                  }}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Delete Notification"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Notification Center</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            View and manage all your real-time activity and alerts
          </p>
        </div>

        {unreadCount > 0 && (
          <Button size="sm" variant="secondary" onClick={markAllRead}>
            ✓ Mark all as read
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3 dark:border-gray-800">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
            filter === 'all'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
            filter === 'unread'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          onClick={() => setFilter('requests')}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
            filter === 'requests'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          Friend Requests
        </button>
        <button
          onClick={() => setFilter('messages')}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
            filter === 'messages'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          Messages
        </button>
      </div>

      {/* Content */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {!isLoading && totalFilteredCount === 0 && (
        <EmptyState
          title="No notifications"
          description="You are all caught up! New friend requests and messages will appear here instantly."
        />
      )}

      {!isLoading && totalFilteredCount > 0 && (
        <div className="flex flex-col gap-6">
          {renderGroup('Today', todayItems)}
          {renderGroup('Yesterday', yesterdayItems)}
          {renderGroup('Earlier', earlierItems)}
        </div>
      )}
    </div>
  );
}
