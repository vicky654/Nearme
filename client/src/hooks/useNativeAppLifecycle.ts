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

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const appStateListener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
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
      try {
        const parsed = new URL(url);
        const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        if (path.startsWith('/')) navigate(path);
      } catch { /* Ignore malformed external URLs. */ }
    });

    const backListener = CapacitorApp.addListener('backButton', () => {
      if (drawerOpen) return closeDrawer();
      if (location.pathname !== '/dashboard') navigate(-1);
      else void CapacitorApp.minimizeApp().catch(() => undefined);
    });

    const keyboardShow = Keyboard.addListener('keyboardWillShow', ({ keyboardHeight }) => {
      document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
      document.documentElement.dataset.keyboardOpen = 'true';
    });
    const keyboardHide = Keyboard.addListener('keyboardWillHide', () => {
      document.documentElement.style.setProperty('--keyboard-height', '0px');
      delete document.documentElement.dataset.keyboardOpen;
    });

    const pushAction = PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const data = notification.data as { conversationId?: string; path?: string } | undefined;
      if (data?.conversationId) navigate('/chat', { state: { conversationId: data.conversationId } });
      else if (data?.path?.startsWith('/')) navigate(data.path);
      else navigate('/notifications');
    });
    const pushRegistration = PushNotifications.addListener('registration', ({ value }) => {
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
      .then((permission) => { if (permission.receive === 'granted') return PushNotifications.register(); })
      .catch(() => undefined);

    return () => {
      for (const listener of [appStateListener, urlListener, backListener, keyboardShow, keyboardHide, pushAction, pushRegistration]) {
        void listener.then((handle) => handle.remove());
      }
    };
  }, [closeDrawer, drawerOpen, location.pathname, navigate]);
}
