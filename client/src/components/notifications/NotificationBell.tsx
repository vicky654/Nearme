import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../../store/notificationStore';
import { Avatar } from '../ui/Avatar';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { notifications, unreadCount, markAsRead, markAllRead, fetchNotifications } =
    useNotificationStore();

  const prevUnreadRef = useRef(unreadCount);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Shake animation when unread count increases
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setIsShaking(true);
      const timer = setTimeout(() => setIsShaking(false), 800);
      prevUnreadRef.current = unreadCount;
      return () => clearTimeout(timer);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleItemClick(notif: any) {
    if (!notif.isRead) {
      markAsRead(notif._id);
    }
    setIsOpen(false);

    if (notif.type === 'new_message' && notif.relatedId) {
      navigate('/chat', { state: { conversationId: notif.relatedId } });
    } else if (
      notif.type === 'friend_request_received' ||
      notif.type === 'friend_request_accepted'
    ) {
      navigate('/friends');
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative rounded-xl p-2 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 ${
          isShaking ? 'animate-bounce text-indigo-600' : ''
        }`}
        title="Notifications"
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-sm animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
            <h3 className="font-bold text-gray-900 dark:text-gray-100">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">No notifications yet</div>
            ) : (
              notifications.slice(0, 10).map((notif) => (
                <div
                  key={notif._id}
                  onClick={() => handleItemClick(notif)}
                  className={`flex cursor-pointer items-start gap-3 p-3 transition-colors ${
                    notif.isRead
                      ? 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      : 'bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-50'
                  }`}
                >
                  <Avatar
                    src={notif.senderId?.avatarUrl}
                    alt={notif.senderId?.displayName || 'Notification'}
                    seed={notif.senderId?.username || notif.senderId?.displayName || notif._id}
                    size="sm"
                    shape="squircle"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                        {notif.title}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(notif.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-600 truncate dark:text-gray-300">
                      {notif.message}
                    </p>
                  </div>
                  {!notif.isRead && (
                    <span className="h-2 w-2 rounded-full bg-indigo-600 flex-shrink-0 mt-1" />
                  )}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-gray-100 pt-3 text-center dark:border-gray-800">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
