import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';

interface CommandItem {
  id: string;
  icon: string;
  title: string;
  category: 'Navigation' | 'Actions' | 'Settings';
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const user = useAuthStore((state) => state.user);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<CommandItem[]>(() => [
    { id: 'nav-dashboard', icon: '🏠', title: 'Go to Dashboard', category: 'Navigation', action: () => navigate('/dashboard') },
    { id: 'nav-nearby', icon: '📍', title: 'Discover Nearby Users', category: 'Navigation', action: () => navigate('/nearby') },
    { id: 'nav-search', icon: '🔍', title: 'Search Users & Passions', category: 'Navigation', action: () => navigate('/search') },
    { id: 'nav-friends', icon: '👥', title: 'View Friends & Requests', category: 'Navigation', action: () => navigate('/friends') },
    { id: 'nav-chat', icon: '💬', title: 'Open Messages & Chat', category: 'Navigation', action: () => navigate('/chat') },
    { id: 'nav-notifications', icon: '🔔', title: 'Notification Center', category: 'Navigation', action: () => navigate('/notifications') },
    { id: 'nav-profile', icon: '👤', title: 'View & Edit Profile', category: 'Navigation', action: () => navigate('/profile') },
    { id: 'nav-settings', icon: '⚙️', title: 'Open App Settings', category: 'Navigation', action: () => navigate('/settings') },
    ...(user?.role === 'admin'
      ? [{ id: 'nav-admin', icon: '🛡️', title: 'Open Admin Control Panel', category: 'Navigation' as const, action: () => navigate('/admin') }]
      : []),
    {
      id: 'act-theme',
      icon: '🌓',
      title: `Switch Theme (Current: ${theme})`,
      category: 'Actions',
      action: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    },
  ], [navigate, setTheme, theme, user?.role]);

  const filteredCommands = useMemo(() => commands.filter((cmd) =>
    cmd.title.toLowerCase().includes(query.toLowerCase())
  ), [commands, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(focusTimer);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-20 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <span className="text-xl text-gray-400 mr-3">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-sm font-medium focus:outline-none dark:text-gray-100"
          />
          <kbd className="rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-500 dark:bg-gray-800">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-400">No matching commands found</div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <div
                key={cmd.id}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                className={`flex cursor-pointer items-center justify-between rounded-xl px-4 py-3 text-xs font-semibold transition-colors ${
                  index === selectedIndex
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{cmd.icon}</span>
                  <span>{cmd.title}</span>
                </div>
                <span
                  className={`text-[10px] uppercase ${
                    index === selectedIndex ? 'text-indigo-200' : 'text-gray-400'
                  }`}
                >
                  {cmd.category}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
