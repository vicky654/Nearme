import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation, CallbackID } from '@capacitor/geolocation';
import { App as CapacitorApp } from '@capacitor/app';
import { useLocationStore } from '../store/locationStore';
import { useNetworkStatus } from './useNetworkStatus';
import { shouldSendLocationUpdate, LocationFix } from '../utils/locationGate';
import { cachePendingLocation, readPendingLocation, clearPendingLocation } from '../utils/locationOfflineCache';
import { updateLocation } from '../api/friendApi';

const WATCH_OPTIONS = { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10_000 };

export function useLocationTracking(): void {
  const status = useLocationStore((state) => state.permissionStatus);
  const setGpsState = useLocationStore((state) => state.setGpsState);
  const setLastKnownPosition = useLocationStore((state) => state.setLastKnownPosition);
  const setLastSentAt = useLocationStore((state) => state.setLastSentAt);
  const isOnline = useNetworkStatus();
  const lastSentRef = useRef<LocationFix | null>(null);
  const watchIdRef = useRef<CallbackID | null>(null);

  useEffect(() => {
    if (status !== 'granted') return;
    let disposed = false;

    async function sendFix(fix: LocationFix, accuracy?: number) {
      try {
        await updateLocation(fix.lat, fix.lng, accuracy);
        lastSentRef.current = fix;
        setLastSentAt(fix.at);
        clearPendingLocation();
      } catch {
        cachePendingLocation({ lat: fix.lat, lng: fix.lng, accuracy, at: fix.at });
      }
    }

    function handleFix(latitude: number, longitude: number, accuracy: number, timestamp: number) {
      if (disposed) return;
      setGpsState('active');
      setLastKnownPosition({ lat: latitude, lng: longitude, accuracy });
      const fix: LocationFix = { lat: latitude, lng: longitude, at: timestamp };
      if (shouldSendLocationUpdate(lastSentRef.current, fix)) void sendFix(fix, accuracy);
    }

    async function startWatch() {
      if (disposed) return;
      setGpsState('searching');
      const id = await Geolocation.watchPosition(WATCH_OPTIONS, (position, err) => {
        if (err || !position) return;
        handleFix(position.coords.latitude, position.coords.longitude, position.coords.accuracy, position.timestamp);
      });
      if (disposed) {
        void Geolocation.clearWatch({ id });
        return;
      }
      watchIdRef.current = id;
    }

    async function stopWatch() {
      if (watchIdRef.current) {
        const id = watchIdRef.current;
        watchIdRef.current = null;
        await Geolocation.clearWatch({ id });
      }
      setGpsState('idle');
    }

    void startWatch();

    function handleVisibility() {
      if (document.visibilityState === 'hidden') void stopWatch();
      else void startWatch();
    }

    let appStateListener: ReturnType<typeof CapacitorApp.addListener> | undefined;
    if (Capacitor.isNativePlatform()) {
      appStateListener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void startWatch();
        else void stopWatch();
      });
    } else {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      disposed = true;
      void stopWatch();
      if (appStateListener) void appStateListener.then((listener) => listener.remove());
      else document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [status, setGpsState, setLastKnownPosition, setLastSentAt]);

  useEffect(() => {
    if (!isOnline) return;
    const pending = readPendingLocation();
    if (!pending) return;
    void updateLocation(pending.lat, pending.lng, pending.accuracy)
      .then(() => {
        clearPendingLocation();
        lastSentRef.current = { lat: pending.lat, lng: pending.lng, at: pending.at };
        setLastSentAt(pending.at);
      })
      .catch(() => undefined);
  }, [isOnline, setLastSentAt]);
}
