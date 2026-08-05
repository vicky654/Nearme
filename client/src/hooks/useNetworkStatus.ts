import { useEffect, useRef, useState } from 'react';
import { Network } from '@capacitor/network';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '../store/toastStore';

export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const wasOnline = useRef(isOnline);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    const update = (connected: boolean) => {
      if (!active) return;
      setIsOnline(connected);
      if (connected && !wasOnline.current) {
        toast.success('You’re back online');
        void queryClient.invalidateQueries({ type: 'active' });
      }
      wasOnline.current = connected;
    };

    const online = () => update(true);
    const offline = () => update(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);

    const nativeListener = Network.addListener('networkStatusChange', (status) => update(status.connected));
    void Network.getStatus().then((status) => update(status.connected)).catch(() => undefined);

    return () => {
      active = false;
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      void nativeListener.then((listener) => listener.remove());
    };
  }, [queryClient]);

  return isOnline;
}
