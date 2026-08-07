import { useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';
import { useLocationStore, LocationPermissionStatus } from '../store/locationStore';

const ASKED_BEFORE_KEY = 'nearme.location.asked-before';

function hasAskedBefore(): boolean {
  return localStorage.getItem(ASKED_BEFORE_KEY) === 'true';
}

function markAskedBefore(): void {
  localStorage.setItem(ASKED_BEFORE_KEY, 'true');
}

function mapPermissionState(state: string): 'prompt' | 'granted' | 'denied' {
  if (state === 'granted') return 'granted';
  if (state === 'denied') return 'denied';
  return 'prompt';
}

async function checkStatus(): Promise<LocationPermissionStatus> {
  try {
    const result = await Geolocation.checkPermissions();
    const mapped = mapPermissionState(result.location);
    if (mapped !== 'denied') return mapped;
    // Native: a single denial is still recoverable via a fresh OS prompt; only
    // treat it as permanently blocked once we know we've already asked before.
    if (Capacitor.isNativePlatform()) return hasAskedBefore() ? 'blocked' : 'denied';
    // Web: the Permissions API's "denied" already means the browser won't
    // prompt again, so denied and blocked are the same state.
    return 'blocked';
  } catch {
    // Native throws when system location services are disabled; web throws
    // when the Permissions API itself isn't supported (e.g. Safari).
    return Capacitor.isNativePlatform() ? 'unknown' : 'prompt';
  }
}

async function requestStatus(): Promise<LocationPermissionStatus> {
  const askedBefore = hasAskedBefore();
  markAskedBefore();

  if (Capacitor.isNativePlatform()) {
    try {
      const result = await Geolocation.requestPermissions();
      const mapped = mapPermissionState(result.location);
      return mapped === 'denied' && askedBefore ? 'blocked' : mapped;
    } catch {
      return askedBefore ? 'blocked' : 'denied';
    }
  }

  // @capacitor/geolocation has no requestPermissions implementation on web —
  // the browser's own permission prompt appears as a side effect of the first
  // getCurrentPosition call.
  try {
    await Geolocation.getCurrentPosition();
    return 'granted';
  } catch {
    return 'blocked';
  }
}

/**
 * Re-runs the underlying permission check and writes the result to the shared
 * store. Exported so other hooks (e.g. `useLocationTracking`) can re-probe
 * permission status outside of `useLocationPermission`'s own mount effect —
 * on a watch error, or when the app returns to the foreground — without
 * duplicating the check/mapping logic above.
 */
export async function refreshLocationPermissionStatus(): Promise<LocationPermissionStatus> {
  const next = await checkStatus();
  useLocationStore.getState().setPermissionStatus(next);
  return next;
}

export function useLocationPermission() {
  const status = useLocationStore((state) => state.permissionStatus);
  const setStatus = useLocationStore((state) => state.setPermissionStatus);

  useEffect(() => {
    void checkStatus().then(setStatus);
  }, [setStatus]);

  const request = useCallback(async () => {
    const next = await requestStatus();
    setStatus(next);
    return next;
  }, [setStatus]);

  const openSettings = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    await NativeSettings.open({ optionAndroid: AndroidSettings.ApplicationDetails, optionIOS: IOSSettings.App });
  }, []);

  return { status, request, openSettings, isNative: Capacitor.isNativePlatform() };
}
