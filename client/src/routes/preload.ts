const pageLoaders: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('../pages/DashboardPage'),
  '/nearby': () => import('../pages/NearbyPage'),
  '/chat': () => import('../pages/ChatPage'),
  '/notifications': () => import('../pages/NotificationsPage'),
  '/profile': () => import('../pages/ProfilePage'),
  '/friends': () => import('../pages/FriendsPage'),
  '/search': () => import('../pages/SearchPage'),
  '/settings': () => import('../pages/settings/SettingsPage'),
};

export function preloadPage(path: string): void {
  void pageLoaders[path]?.().catch(() => undefined);
}
