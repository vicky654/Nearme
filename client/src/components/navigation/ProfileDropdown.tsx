import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { logoutUser } from '../../api/authApi';
import { toast } from '../../store/toastStore';
import { unregisterPushToken } from '../../api/userApi';
import { Capacitor } from '@capacitor/core';
import { disconnectSocket } from '../../api/socket';
import { useChatStore } from '../../store/chatStore';
import { useNotificationStore } from '../../store/notificationStore';
import { cancelPendingApiRequests } from '../../api/axiosClient';
import { Avatar } from '../ui/Avatar';

export function ProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    try {
      const pushToken = import.meta.env.MODE !== 'test' && Capacitor.isNativePlatform()
        ? localStorage.getItem('nearme.push-token')
        : null;
      if (pushToken) {
        await unregisterPushToken(pushToken).catch(() => undefined);
        localStorage.removeItem('nearme.push-token');
      }
      await logoutUser();
    } catch {
      // Best effort
    } finally {
      cancelPendingApiRequests();
      disconnectSocket();
      useChatStore.getState().reset();
      useNotificationStore.getState().reset();
      clearAuth();
      toast.success('Logged out');
      navigate('/login');
    }
  }

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full p-1 transition-transform hover:scale-105"
      >
        <Avatar
          src={user.avatarUrl}
          alt={user.displayName}
          seed={user.username || user.displayName}
          size="sm"
          border
          showOnlineStatus
          isOnline
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-64 rounded-3xl border border-gray-200 bg-white p-3 shadow-2xl animate-in fade-in dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3 border-b border-gray-100 p-3 dark:border-gray-800">
            <Avatar
              src={user.avatarUrl}
              alt={user.displayName}
              seed={user.username || user.displayName}
              size="md"
              shape="squircle"
            />
            <div className="min-w-0">
              <h4 className="font-bold text-xs text-gray-900 truncate dark:text-gray-100">
                {user.displayName}
              </h4>
              <p className="text-[10px] text-gray-400 truncate">@{user.username}</p>
            </div>
          </div>

          <div className="py-2 flex flex-col gap-1 text-xs font-semibold">
            <Link
              to="/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              👤 View Profile
            </Link>
            <Link
              to="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              ⚙️ Settings
            </Link>

            {user.role === 'admin' && (
              <Link
                to="/admin"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-purple-700 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950 dark:text-purple-300"
              >
                🛡️ Admin Control Panel
              </Link>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              🚪 Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
