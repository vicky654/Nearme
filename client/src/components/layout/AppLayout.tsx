import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import '@ionic/react/css/core.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { IonApp, IonContent, IonIcon, IonRefresher, IonRefresherContent, setupIonicReact } from '@ionic/react';
import { useQueryClient } from '@tanstack/react-query';
import { close, compassOutline, helpCircleOutline, lockClosedOutline, menu, peopleOutline, search, settingsOutline, bookmarkOutline, giftOutline, chevronForward, locationOutline } from 'ionicons/icons';
import { VerifyEmailBanner } from '../auth/VerifyEmailBanner';
import { NotificationBell } from '../notifications/NotificationBell';
import { ActionToast } from '../notifications/ActionToast';
import { WelcomeBackModal } from '../notifications/WelcomeBackModal';
import { ProfileDropdown } from '../navigation/ProfileDropdown';
import { MobileBottomBar } from '../navigation/MobileBottomBar';
import { CommandPalette } from '../navigation/CommandPalette';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { NetworkBanner } from '../ui/NetworkBanner';
import { Avatar } from '../ui/Avatar';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useNativeAppLifecycle } from '../../hooks/useNativeAppLifecycle';
import { hapticNotification } from '../../utils/hapticService';
import { NotificationType as HapticNotificationType } from '@capacitor/haptics';
import { toast } from '../../store/toastStore';
import { preloadPage } from '../../routes/preload';

const scrollPositions = new Map<string, number>();
setupIonicReact({ mode: 'ios' });

const titles: Record<string, string> = { '/dashboard': 'For you', '/nearby': 'Discover', '/chat': 'Messages', '/notifications': 'Activity', '/profile': 'Profile', '/friends': 'Friends', '/search': 'Search', '/settings': 'Settings' };
const desktopNav: ReadonlyArray<readonly [string, string]> = [
  ['/dashboard', 'Home'], ['/nearby', 'Nearby'], ['/chat', 'Chats'], ['/notifications', 'Notifications'], ['/profile', 'Profile'],
];
const drawerItems = [
  ['/friends', 'Friends', peopleOutline], ['/search', 'Discover people', compassOutline], ['/settings', 'Settings', settingsOutline], ['#saved', 'Saved', bookmarkOutline], ['#invite', 'Invite friends', giftOutline], ['#privacy', 'Privacy & safety', lockClosedOutline], ['#help', 'Help & support', helpCircleOutline],
] as const;

export default function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const bindSocketListeners = useNotificationStore((state) => state.bindSocketListeners);
  const queryClient = useQueryClient();
  const isOnline = useNetworkStatus();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);
  const lastScroll = useRef(0);
  const refreshing = useRef(false);
  const contentRef = useRef<HTMLIonContentElement>(null);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);
  useNativeAppLifecycle(drawerOpen, closeDrawer);

  useEffect(() => {
    if (!user || import.meta.env.MODE === 'test') return;
    const cleanup = bindSocketListeners((path, state) => navigate(path, { state }));
    return cleanup;
  }, [user, bindSocketListeners, navigate]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setIsSearchOpen((v) => !v); } };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); };
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
    const savedTop = scrollPositions.get(location.pathname) ?? 0;
    const frame = requestAnimationFrame(() => { void contentRef.current?.scrollToPoint(0, savedTop, 0); });
    return () => cancelAnimationFrame(frame);
  }, [location.pathname]);

  function handleScroll(event: CustomEvent<{ scrollTop: number }>) {
    const next = event.detail.scrollTop;
    scrollPositions.set(location.pathname, next);
    setChromeHidden(next > lastScroll.current && next > 90);
    lastScroll.current = next;
  }

  async function handleRefresh(event: CustomEvent<{ complete: () => void }>) {
    if (refreshing.current) return event.detail.complete();
    refreshing.current = true;
    try {
      await queryClient.invalidateQueries({ type: 'active', refetchType: 'active' });
      hapticNotification(HapticNotificationType.Success, 'pull-to-refresh');
    } catch {
      toast.error('Refresh failed. Check your connection and try again.');
      hapticNotification(HapticNotificationType.Error, 'pull-to-refresh');
    }
    finally {
      refreshing.current = false;
      event.detail.complete();
    }
  }

  useEffect(() => {
    const expired = () => navigate('/login', { replace: true, state: { reason: 'session-expired', from: location } });
    window.addEventListener('nearme:session-expired', expired);
    return () => window.removeEventListener('nearme:session-expired', expired);
  }, [location, navigate]);

  const isFullChat = location.pathname === '/chat' && Boolean(location.state?.conversationId);
  const isChatRoute = location.pathname === '/chat';
  const title = titles[location.pathname] ?? 'NearMe';

  return (
    <IonApp>
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[rgb(var(--canvas))] text-ink dark:text-gray-100">
      <NetworkBanner isOnline={isOnline} />
      <motion.header initial={false} animate={{ y: chromeHidden ? -90 : 0, marginBottom: chromeHidden ? -64 : 0 }} className="relative z-40 shrink-0 border-b border-gray-200/60 bg-white/80 pt-[var(--sat)] backdrop-blur-2xl dark:border-gray-800 dark:bg-gray-950/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <button aria-label="Open menu" onClick={() => setDrawerOpen(true)} className="-ml-1 grid h-11 w-11 place-items-center rounded-2xl text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 md:hidden"><IonIcon icon={menu} className="text-2xl" /></button>
          <Link to="/dashboard" className="hidden items-center gap-2.5 md:flex">
            <span className="grid h-10 w-10 place-items-center rounded-[15px] bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-lg shadow-brand-500/20"><IonIcon icon={locationOutline} className="text-xl" /></span>
            <span className="text-xl font-black tracking-[-.04em]">near<span className="text-brand-600">me</span></span>
          </Link>
          <div className="min-w-0 flex-1 md:hidden"><p className="truncate text-[11px] font-semibold text-gray-400">Near you · Live</p><h1 className="truncate text-[19px] font-extrabold tracking-tight">{title}</h1></div>
          <nav className="mx-auto hidden items-center rounded-2xl bg-gray-100/80 p-1 dark:bg-gray-900 md:flex">
            {desktopNav.map(([path, label]) => { const active = location.pathname === path; return <Link key={path} to={path} onPointerEnter={() => preloadPage(path)} onFocus={() => preloadPage(path)} className={`relative rounded-xl px-4 py-2 text-sm font-semibold ${active ? 'text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>{active && <motion.span layoutId="desktop-tab" className="absolute inset-0 rounded-xl bg-brand-600 shadow-sm" />}<span className="relative">{label}</span></Link>; })}
          </nav>
          <div className="flex items-center gap-1.5">
            <button aria-label="Search" onClick={() => setIsSearchOpen(true)} className="grid h-10 w-10 place-items-center rounded-2xl text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"><IonIcon icon={search} className="text-xl" /></button>
            <NotificationBell />
            <ProfileDropdown />
          </div>
        </div>
      </motion.header>

      <div className="shrink-0"><VerifyEmailBanner /></div>
      {isChatRoute ? <main className="min-h-0 flex-1 overflow-hidden">{children}</main> : <IonContent ref={contentRef} scrollEvents onIonScroll={(event) => handleScroll(event as CustomEvent<{ scrollTop: number }>)} className="min-h-0 flex-1" style={{ '--background': 'transparent' }}>
        <IonRefresher slot="fixed" pullFactor={0.65} pullMin={70} pullMax={130} onIonRefresh={(event) => void handleRefresh(event as CustomEvent<{ complete: () => void }>)}><IonRefresherContent pullingText="Pull to refresh" refreshingSpinner="crescent" /></IonRefresher>
        <main className={isFullChat ? '' : 'pb-24 md:pb-6'}>{children}</main>
      </IonContent>}
      {!isFullChat && <MobileBottomBar hidden={chromeHidden} />}

      <AnimatePresence>
        {drawerOpen && <>
          <motion.button aria-label="Close menu" className="fixed inset-0 z-50 bg-gray-950/40 backdrop-blur-sm md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeDrawer} />
          <motion.aside className="fixed inset-y-0 left-0 z-50 w-[86%] max-w-[340px] overflow-y-auto rounded-r-[2rem] bg-white pb-[max(1.5rem,var(--sab))] pt-[max(1rem,var(--sat))] shadow-2xl dark:bg-gray-900 md:hidden" initial={{ x: '-105%' }} animate={{ x: 0 }} exit={{ x: '-105%' }} transition={{ type: 'spring', stiffness: 360, damping: 34 }}>
            <div className="flex items-center justify-between px-5"><span className="text-lg font-black tracking-tight">near<span className="text-brand-600">me</span></span><button aria-label="Close menu" onClick={closeDrawer} className="grid h-10 w-10 place-items-center rounded-full bg-gray-100 dark:bg-gray-800"><IonIcon icon={close} /></button></div>
            <div className="mx-4 mt-5 overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-brand-600 to-violet-600 p-5 text-white shadow-xl shadow-brand-600/20">
              <div className="flex items-center gap-3"><Avatar src={user?.avatarUrl} alt={user?.displayName} seed={user?.username || user?.displayName} size="lg" shape="squircle" border /><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-bold">{user?.displayName}</p><span className="rounded-full bg-amber-300 px-1.5 py-0.5 text-[8px] font-black uppercase text-amber-950">Plus</span></div><p className="truncate text-xs text-white/70">@{user?.username}</p></div></div>
              <div className="mt-5 flex gap-2"><div className="rounded-xl bg-white/12 px-3 py-2 text-xs"><strong className="block text-base">12</strong>Connections</div><div className="rounded-xl bg-white/12 px-3 py-2 text-xs"><strong className="block text-base">240</strong>Coins</div></div>
            </div>
            <div className="mt-4 px-3">{drawerItems.map(([path, label, icon]) => <button key={label} onClick={() => path.startsWith('/') ? navigate(path) : undefined} className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gray-100 text-brand-600 dark:bg-gray-800"><IonIcon icon={icon} /></span><span className="flex-1">{label}</span><IonIcon icon={chevronForward} className="text-gray-300" /></button>)}</div>
          </motion.aside>
        </>}
      </AnimatePresence>
      <ActionToast /><WelcomeBackModal /><CommandPalette isOpen={isSearchOpen} onClose={closeSearch} />
    </div>
    </IonApp>
  );
}
