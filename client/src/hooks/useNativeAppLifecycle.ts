import { useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useLocation, useNavigate } from 'react-router-dom';
import { restoreSession } from './useAuthBootstrap';
import { useAuthStore } from '../store/authStore';
import { registerPushToken } from '../api/userApi';

export function useNativeAppLifecycle(drawerOpen: boolean, closeDrawer: () => void): void {
  const navigate = useNavigate();
  const location = useLocation();
  const backgroundedAt = useRef<number | null>(null);
  const lifecycleState = useRef({ drawerOpen, closeDrawer, pathname: location.pathname, navigate });
  lifecycleState.current = { drawerOpen, closeDrawer, pathname: location.pathname, navigate };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    const appStateListener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (disposed) return;
      if (!isActive) {
        backgroundedAt.current = Date.now();
        return;
      }
      const wasAwayLongEnough = backgroundedAt.current !== null && Date.now() - backgroundedAt.current > 5 * 60_000;
      const hasOfflineSession = useAuthStore.getState().user && !useAuthStore.getState().accessToken;
      if (wasAwayLongEnough || hasOfflineSession) void restoreSession();
      backgroundedAt.current = null;
    });

    const urlListener = CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      if (disposed) return;
      try {
        const parsed = new URL(url);
        const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        if (path.startsWith('/')) lifecycleState.current.navigate(path);
      } catch { /* Ignore malformed external URLs. */ }
    });

    const backListener = CapacitorApp.addListener('backButton', () => {
      if (disposed) return;
      if (lifecycleState.current.drawerOpen) return lifecycleState.current.closeDrawer();
      if (lifecycleState.current.pathname !== '/dashboard') lifecycleState.current.navigate(-1);
      else void CapacitorApp.minimizeApp().catch(() => undefined);
    });

    const keyboardShow = Keyboard.addListener('keyboardWillShow', ({ keyboardHeight }) => {
      if (disposed) return;
      document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
      document.documentElement.dataset.keyboardOpen = 'true';
    });
    const keyboardHide = Keyboard.addListener('keyboardWillHide', () => {
      if (disposed) return;
      document.documentElement.style.setProperty('--keyboard-height', '0px');
      delete document.documentElement.dataset.keyboardOpen;
    });

    const pushAction = PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      if (disposed) return;
      const data = notification.data as { conversationId?: string; path?: string } | undefined;
      if (data?.conversationId) lifecycleState.current.navigate('/chat', { state: { conversationId: data.conversationId } });
      else if (data?.path?.startsWith('/')) lifecycleState.current.navigate(data.path);
      else lifecycleState.current.navigate('/notifications');
    });
    const pushRegistration = PushNotifications.addListener('registration', ({ value }) => {
      if (disposed || !useAuthStore.getState().user) return;
      localStorage.setItem('nearme.push-token', value);
      void registerPushToken(value).catch(() => undefined);
    });
    if (Capacitor.getPlatform() === 'android') {
      void PushNotifications.createChannel({
        id: 'messages',
        name: 'Messages',
        description: 'New messages and conversation activity',
        importance: 5,
        visibility: 1,
        vibration: true,
      }).catch(() => undefined);
    }
    void PushNotifications.checkPermissions()
      .then((permission) => {
        if (!disposed && permission.receive === 'granted') return PushNotifications.register();
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      document.documentElement.style.setProperty('--keyboard-height', '0px');
      delete document.documentElement.dataset.keyboardOpen;
      for (const listener of [appStateListener, urlListener, backListener, keyboardShow, keyboardHide, pushAction, pushRegistration]) {
        void listener.then((handle) => handle.remove());
      }
    };
  }, []);
}
