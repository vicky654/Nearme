import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { logoutUser } from '../../api/authApi';
import { toast } from '../../store/toastStore';

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
      await logoutUser();
    } catch {
      // Best effort
    } finally {
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
        <div className="relative">
          <img
            src={user.avatarUrl}
            alt={user.displayName}
            className="h-9 w-9 rounded-full object-cover shadow-sm border border-gray-200 dark:border-gray-800"
          />
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500 dark:border-gray-900" />
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-64 rounded-3xl border border-gray-200 bg-white p-3 shadow-2xl animate-in fade-in dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3 border-b border-gray-100 p-3 dark:border-gray-800">
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="h-10 w-10 rounded-full object-cover"
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
