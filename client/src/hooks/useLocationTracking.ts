import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { Geolocation, CallbackID } from '@capacitor/geolocation';
import { App as CapacitorApp } from '@capacitor/app';
import { useLocationStore } from '../store/locationStore';
import { useNetworkStatus } from './useNetworkStatus';
import { shouldSendLocationUpdate, LocationFix, MIN_INTERVAL_MS } from '../utils/locationGate';
import { cachePendingLocation, readPendingLocation, clearPendingLocation } from '../utils/locationOfflineCache';
import { updateLocation } from '../api/friendApi';
import { refreshLocationPermissionStatus } from './useLocationPermission';

const WATCH_OPTIONS = { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10_000 };
// A fix is considered stale (gpsState -> 'lost') once we've gone this long
// without a new one, per the design spec's "2x the send interval" rule.
const STALE_FIX_THRESHOLD_MS = 2 * MIN_INTERVAL_MS;
const STALE_CHECK_INTERVAL_MS = 5_000;
// Discard (rather than upload) a cached offline fix once it's old enough that
// reporting it as "now" would be misleading.
const MAX_CACHED_FIX_AGE_MS = 5 * 60 * 1000;

function isHttpRejection(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && 'response' in err && (err as { response?: unknown }).response);
}

export function useLocationTracking(): void {
  const status = useLocationStore((state) => state.permissionStatus);
  const setGpsState = useLocationStore((state) => state.setGpsState);
  const setLastKnownPosition = useLocationStore((state) => state.setLastKnownPosition);
  const setLastSentAt = useLocationStore((state) => state.setLastSentAt);
  const isOnline = useNetworkStatus();
  const queryClient = useQueryClient();
  const lastSentRef = useRef<LocationFix | null>(null);
  const watchIdRef = useRef<CallbackID | null>(null);

  useEffect(() => {
    if (status !== 'granted') return;
    let disposed = false;
    let lastFixAt: number | null = null;

    async function sendFix(fix: LocationFix, accuracy?: number) {
      try {
        await updateLocation(fix.lat, fix.lng, accuracy);
        lastSentRef.current = fix;
        setLastSentAt(fix.at);
        clearPendingLocation();
        // A moved user's proximity to everyone else has changed — keep the
        // Nearby list from going stale while continuous tracking is running.
        void queryClient.invalidateQueries({ queryKey: ['nearby'] });
      } catch {
        cachePendingLocation({ lat: fix.lat, lng: fix.lng, accuracy, at: fix.at });
      }
    }

    function handleFix(latitude: number, longitude: number, accuracy: number, timestamp: number) {
      if (disposed) return;
      lastFixAt = Date.now();
      setGpsState('active');
      setLastKnownPosition({ lat: latitude, lng: longitude, accuracy });
      const fix: LocationFix = { lat: latitude, lng: longitude, at: timestamp };
      if (shouldSendLocationUpdate(lastSentRef.current, fix)) void sendFix(fix, accuracy);
    }

    function handleWatchError() {
      if (disposed) return;
      // Capacitor Geolocation errors aren't uniformly typed across platforms
      // (PERMISSION_DENIED / POSITION_UNAVAILABLE / TIMEOUT can all show up
      // here) — treat any watch error as cause to re-check permission status
      // and surface the loss in gpsState rather than silently swallowing it.
      setGpsState('lost');
      void refreshLocationPermissionStatus();
    }

    async function startWatch() {
      if (disposed || watchIdRef.current) return;
      setGpsState('searching');
      const id = await Geolocation.watchPosition(WATCH_OPTIONS, (position, err) => {
        if (err || !position) {
          handleWatchError();
          return;
        }
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

    // Belt-and-suspenders staleness check: some platforms/situations (e.g.
    // GPS lost indoors) never invoke the watch's error callback at all —
    // they just stop delivering fixes. Downgrade to 'lost' if too much time
    // has passed since the last one; handleFix upgrades back to 'active'.
    const staleCheckId = setInterval(() => {
      if (lastFixAt !== null && Date.now() - lastFixAt >= STALE_FIX_THRESHOLD_MS) {
        setGpsState('lost');
      }
    }, STALE_CHECK_INTERVAL_MS);

    // Starting/stopping the watch on foreground/background is this hook's
    // job; keeping `permissionStatus` itself current is useLocationPermission's
    // job (it re-probes on every foreground transition regardless of this
    // hook's status, which is what lets tracking resume automatically after
    // an external grant — see useLocationPermission.ts).
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
      clearInterval(staleCheckId);
      void stopWatch();
      if (appStateListener) void appStateListener.then((listener) => listener.remove());
      else document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [status, setGpsState, setLastKnownPosition, setLastSentAt, queryClient]);

  useEffect(() => {
    if (!isOnline) return;
    const pending = readPendingLocation();
    if (!pending) return;

    // A fix cached before permission was revoked (or the OS killed it) should
    // not be uploaded after the fact — and shouldn't be left to retry forever.
    if (status !== 'granted') {
      clearPendingLocation();
      return;
    }

    // The server stamps `locationUpdatedAt` on receipt, so an old cached fix
    // would be recorded as "just now" — discard it instead of sending it stale.
    if (Date.now() - pending.at > MAX_CACHED_FIX_AGE_MS) {
      clearPendingLocation();
      return;
    }

    void updateLocation(pending.lat, pending.lng, pending.accuracy)
      .then(() => {
        clearPendingLocation();
        lastSentRef.current = { lat: pending.lat, lng: pending.lng, at: pending.at };
        setLastSentAt(pending.at);
        void queryClient.invalidateQueries({ queryKey: ['nearby'] });
      })
      .catch((err: unknown) => {
        // A network failure leaves the cache in place to retry later; a
        // rejection with an HTTP response means the server actively refused
        // it (4xx/5xx), so retrying forever would be pointless — discard it.
        if (isHttpRejection(err)) clearPendingLocation();
      });
  }, [isOnline, status, setLastSentAt, queryClient]);
}
