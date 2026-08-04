import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { VerifyEmailBanner } from '../auth/VerifyEmailBanner';
import { NotificationBell } from '../notifications/NotificationBell';
import { ActionToast } from '../notifications/ActionToast';
import { WelcomeBackModal } from '../notifications/WelcomeBackModal';
import { ProfileDropdown } from '../navigation/ProfileDropdown';
import { MobileBottomBar } from '../navigation/MobileBottomBar';
import { CommandPalette } from '../navigation/CommandPalette';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useNotificationStore } from '../../store/notificationStore';
import { requestBrowserNotificationPermission } from '../../utils/browserNotificationService';

export default function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const bindSocketListeners = useNotificationStore((state) => state.bindSocketListeners);

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    if (user) {
      const cleanup = bindSocketListeners((path, state) => navigate(path, { state }));
      requestBrowserNotificationPermission();
      return () => cleanup();
    }
  }, [user, bindSocketListeners, navigate]);

  // Listen for Ctrl+K / Cmd+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navItems = [
    { path: '/dashboard', label: 'Home', icon: '🏠' },
    { path: '/nearby', label: 'Nearby', icon: '📍' },
    { path: '/search', label: 'Search', icon: '🔍' },
    { path: '/friends', label: 'Friends', icon: '👥' },
    { path: '/chat', label: 'Messages', icon: '💬' },
    { path: '/notifications', label: 'Notifications', icon: '🔔' },
  ];

  // Hide bottom tab bar on mobile if inside chat page with active conversation selected
  const isChatActive = location.pathname === '/chat' && Boolean(location.state?.conversationId);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      {/* DESKTOP STICKY NAVBAR (68-72px) */}
      <header className="sticky top-0 z-40 hidden h-[72px] items-center justify-between border-b border-gray-200/80 bg-white/80 px-6 backdrop-blur-md dark:border-gray-800/80 dark:bg-gray-900/80 md:flex">
        {/* Left: Brand Logo */}
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-xl font-bold text-white shadow-md transition-transform group-hover:scale-105">
            📍
          </div>
          <span className="text-xl font-black tracking-tight text-gray-900 dark:text-gray-100">
            Near<span className="text-indigo-600 dark:text-indigo-400">Me</span>
          </span>
        </Link>

        {/* Center: Animated Navigation Pills (Framer Motion) */}
        <nav className="flex items-center gap-1 rounded-2xl border border-gray-200/60 bg-gray-100/70 p-1.5 dark:border-gray-800/60 dark:bg-gray-800/50">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative rounded-xl px-4 py-2 text-xs font-bold transition-colors"
              >
                {isActive && (
                  <motion.div
                    layoutId="desktop-active-pill"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 shadow-md"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className={`relative z-10 flex items-center gap-1.5 ${isActive ? 'text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'}`}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Right: Quick Tools, Search, Bell, Profile Menu */}
        <div className="flex items-center gap-3">
          {/* Global Search Trigger (Ctrl + K) */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            <span>🔍</span>
            <span className="hidden lg:inline">Search...</span>
            <kbd className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              Ctrl K
            </kbd>
          </button>

          {/* Notification Bell */}
          <NotificationBell />

          {/* Quick Theme Toggle */}
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="rounded-xl p-2 text-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Toggle Theme"
          >
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>

          {/* Profile Menu Dropdown */}
          <ProfileDropdown />
        </div>
      </header>

      {/* MOBILE TOP BAR (60px) */}
      <header className="sticky top-0 z-40 flex h-[60px] items-center justify-between border-b border-gray-200/80 bg-white/80 px-4 backdrop-blur-md dark:border-gray-800/80 dark:bg-gray-900/80 md:hidden pt-safe">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-sm font-bold text-white shadow-sm">
            📍
          </div>
          <span className="text-lg font-black tracking-tight text-gray-900 dark:text-gray-100">
            Near<span className="text-indigo-600 dark:text-indigo-400">Me</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="rounded-xl p-2 text-base text-gray-600 dark:text-gray-300"
          >
            🔍
          </button>
          <NotificationBell />
          <ProfileDropdown />
        </div>
      </header>

      {/* Verification Email Banner */}
      <VerifyEmailBanner />

      {/* Main App Content Area */}
      <main className="flex-1 pb-20 md:pb-6">{children}</main>

      {/* Mobile Bottom Navigation Bar (Hidden when inside full chat view) */}
      {!isChatActive && <MobileBottomBar />}

      {/* Real-Time Action Toasts & Welcome Back Popup Modal */}
      <ActionToast />
      <WelcomeBackModal />

      {/* Global Command Palette Modal (Ctrl + K) */}
      <CommandPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
}
