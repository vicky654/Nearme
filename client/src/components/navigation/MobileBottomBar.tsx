import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useNotificationStore } from '../../store/notificationStore';

export function MobileBottomBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const unreadCount = useNotificationStore((state) => state.unreadCount);

  const tabs = [
    { path: '/dashboard', label: 'Home', icon: '🏠' },
    { path: '/nearby', label: 'Nearby', icon: '📍' },
    { path: '/search', label: 'Search', icon: '🔍' },
    { path: '/chat', label: 'Chat', icon: '💬' },
    { path: '/friends', label: 'Friends', icon: '👥' },
    { path: '/profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 block md:hidden">
      <nav className="relative flex h-[70px] items-center justify-around rounded-t-3xl border-t border-gray-200/80 bg-white/90 px-2 shadow-2xl backdrop-blur-lg dark:border-gray-800/80 dark:bg-gray-900/90 pb-safe">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="relative flex flex-col items-center justify-center py-1 flex-1 text-center"
            >
              {isActive && (
                <motion.div
                  layoutId="mobile-active-pill"
                  className="absolute inset-0 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}

              <span className={`relative z-10 text-lg transition-transform ${isActive ? 'scale-115 -translate-y-0.5' : 'opacity-70'}`}>
                {tab.icon}
              </span>

              <span className={`relative z-10 text-[10px] font-bold mt-0.5 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500'}`}>
                {tab.label}
              </span>

              {tab.path === '/chat' && unreadCount > 0 && (
                <span className="absolute top-1 right-2 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm">
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
