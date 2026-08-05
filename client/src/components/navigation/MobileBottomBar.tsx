import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { IonIcon } from '@ionic/react';
import { home, homeOutline, navigate, navigateOutline, chatbubbleEllipses, chatbubbleEllipsesOutline, notifications, notificationsOutline, person, personOutline } from 'ionicons/icons';
import { ImpactStyle } from '@capacitor/haptics';
import { useNotificationStore } from '../../store/notificationStore';
import { hapticImpact } from '../../utils/hapticService';
import { preloadPage } from '../../routes/preload';

const tabs = [
  { path: '/dashboard', label: 'Home', icon: homeOutline, activeIcon: home },
  { path: '/nearby', label: 'Nearby', icon: navigateOutline, activeIcon: navigate },
  { path: '/chat', label: 'Chats', icon: chatbubbleEllipsesOutline, activeIcon: chatbubbleEllipses },
  { path: '/notifications', label: 'Alerts', icon: notificationsOutline, activeIcon: notifications },
  { path: '/profile', label: 'Profile', icon: personOutline, activeIcon: person },
];

export function MobileBottomBar({ hidden = false }: { hidden?: boolean }) {
  const location = useLocation();
  const navigateTo = useNavigate();
  const unreadCount = useNotificationStore((state) => state.unreadCount);

  function select(path: string) {
    hapticImpact(ImpactStyle.Light, 'navigation');
    preloadPage(path);
    navigateTo(path);
  }

  return (
    <motion.div
      initial={false}
      animate={{ y: hidden ? 110 : 0, opacity: hidden ? 0 : 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 38 }}
      className="keyboard-hide fixed inset-x-0 bottom-0 z-40 md:hidden"
    >
      <nav aria-label="Primary navigation" className="mx-auto max-w-lg border-t border-gray-200/70 bg-white/80 px-2 pb-[max(.55rem,var(--sab))] pt-2 shadow-[0_-10px_35px_rgba(32,38,70,.10)] backdrop-blur-2xl dark:border-gray-800 dark:bg-gray-950/82">
        <div className="grid grid-cols-5">
          {tabs.map((tab) => {
            const active = location.pathname === tab.path;
            const badge = tab.path === '/notifications' || tab.path === '/chat';
            return (
              <button key={tab.path} type="button" aria-current={active ? 'page' : undefined} aria-label={tab.label} onPointerEnter={() => preloadPage(tab.path)} onTouchStart={() => preloadPage(tab.path)} onClick={() => select(tab.path)} className="relative flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-2xl text-gray-400">
                {active && <motion.span layoutId="mobile-tab" className="absolute inset-x-2 top-0 h-9 rounded-2xl bg-brand-50 dark:bg-brand-500/15" transition={{ type: 'spring', stiffness: 450, damping: 35 }} />}
                <IonIcon icon={active ? tab.activeIcon : tab.icon} className={`relative z-10 text-[22px] transition-colors ${active ? 'text-brand-600 dark:text-brand-500' : ''}`} />
                <span className={`relative z-10 text-[10px] font-semibold ${active ? 'text-brand-600 dark:text-brand-500' : ''}`}>{tab.label}</span>
                {badge && unreadCount > 0 && <span className="absolute right-[22%] top-0.5 z-20 min-w-4 rounded-full bg-coral px-1 text-[9px] font-bold leading-4 text-white ring-2 ring-white dark:ring-gray-950">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </button>
            );
          })}
        </div>
      </nav>
    </motion.div>
  );
}
