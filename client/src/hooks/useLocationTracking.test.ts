import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';

const isNativePlatform = vi.fn().mockReturnValue(false);
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: (...args: unknown[]) => isNativePlatform(...args) } }));

const watchPosition = vi.fn();
const clearWatch = vi.fn().mockResolvedValue(undefined);
const checkPermissions = vi.fn();
vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    watchPosition: (...args: unknown[]) => watchPosition(...args),
    clearWatch: (...args: unknown[]) => clearWatch(...args),
    // Pulled in transitively via `refreshLocationPermissionStatus`
    // (useLocationPermission.ts) for the watch-error / foreground re-probe.
    checkPermissions: (...args: unknown[]) => checkPermissions(...args),
    requestPermissions: vi.fn(),
    getCurrentPosition: vi.fn(),
  },
}));

// useLocationPermission.ts imports this for openSettings(); unused by these
// tests but must be mocked so the module graph resolves under jsdom.
vi.mock('capacitor-native-settings', () => ({
  NativeSettings: { open: vi.fn() },
  AndroidSettings: { ApplicationDetails: 'application_details' },
  IOSSettings: { App: 'app' },
}));

const addListener = vi.fn();
vi.mock('@capacitor/app', () => ({ App: { addListener: (...args: unknown[]) => addListener(...args) } }));

const useNetworkStatusMock = vi.fn().mockReturnValue(true);
vi.mock('./useNetworkStatus', () => ({ useNetworkStatus: () => useNetworkStatusMock() }));

const updateLocationMock = vi.fn();
vi.mock('../api/friendApi', () => ({ updateLocation: (...args: unknown[]) => updateLocationMock(...args) }));

const invalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries }) }));

import { useLocationTracking } from './useLocationTracking';
import { useLocationStore } from '../store/locationStore';
import { cachePendingLocation, readPendingLocation } from '../utils/locationOfflineCache';
import { MIN_INTERVAL_MS } from '../utils/locationGate';

describe('useLocationTracking', () => {
  beforeEach(() => {
    localStorage.clear();
    useLocationStore.setState({ permissionStatus: 'unknown', gpsState: 'idle', lastKnownPosition: null, lastSentAt: null });
    isNativePlatform.mockReset().mockReturnValue(false);
    watchPosition.mockReset().mockResolvedValue('watch-1');
    clearWatch.mockClear();
    addListener.mockReset();
    updateLocationMock.mockReset().mockResolvedValue(undefined);
    invalidateQueries.mockReset();
    useNetworkStatusMock.mockReturnValue(true);
    // Default: permission stays granted across any re-probe triggered by the
    // foreground handlers / watch-error handler, so existing watch lifecycle
    // tests aren't affected unless a test explicitly overrides this.
    checkPermissions.mockReset().mockResolvedValue({ location: 'granted', coarseLocation: 'granted' });
  });

  afterEach(() => {
    cleanup();
  });

  it('does not start watching when permission is not granted', async () => {
    useLocationStore.setState({ permissionStatus: 'prompt' });
    renderHook(() => useLocationTracking());

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(watchPosition).not.toHaveBeenCalled();
  });

  it('starts watching and sends the first fix once permission is granted', async () => {
    useLocationStore.setState({ permissionStatus: 'granted' });
    watchPosition.mockImplementation((_options, callback) => {
      callback({ coords: { latitude: 10, longitude: 20, accuracy: 8 }, timestamp: 1_000 }, undefined);
      return Promise.resolve('watch-1');
    });

    renderHook(() => useLocationTracking());

    await waitFor(() => expect(updateLocationMock).toHaveBeenCalledWith(10, 20, 8));
    expect(useLocationStore.getState().gpsState).toBe('active');
    expect(useLocationStore.getState().lastSentAt).toBe(1_000);
  });

  it('caches the fix locally when sending it fails', async () => {
    useLocationStore.setState({ permissionStatus: 'granted' });
    updateLocationMock.mockRejectedValue(new Error('network down'));
    watchPosition.mockImplementation((_options, callback) => {
      callback({ coords: { latitude: 10, longitude: 20, accuracy: 8 }, timestamp: 2_000 }, undefined);
      return Promise.resolve('watch-1');
    });

    renderHook(() => useLocationTracking());

    await waitFor(() => expect(updateLocationMock).toHaveBeenCalled());
    expect(readPendingLocation()).toEqual({ lat: 10, lng: 20, accuracy: 8, at: 2_000 });
  });

  it('flushes a previously cached fix once online while permission remains granted', async () => {
    cachePendingLocation({ lat: 5, lng: 6, accuracy: 3, at: Date.now() });
    useLocationStore.setState({ permissionStatus: 'granted' });
    useNetworkStatusMock.mockReturnValue(true);

    renderHook(() => useLocationTracking());

    await waitFor(() => expect(updateLocationMock).toHaveBeenCalledWith(5, 6, 3));
    expect(readPendingLocation()).toBeNull();
  });

  it('does not flush (and discards) a cached fix when permission is not granted', async () => {
    cachePendingLocation({ lat: 5, lng: 6, accuracy: 3, at: Date.now() });
    useLocationStore.setState({ permissionStatus: 'denied' });
    useNetworkStatusMock.mockReturnValue(true);

    renderHook(() => useLocationTracking());

    await waitFor(() => expect(readPendingLocation()).toBeNull());
    expect(updateLocationMock).not.toHaveBeenCalled();
  });

  it('discards a cached fix older than the max cache age instead of sending it as "now"', async () => {
    cachePendingLocation({ lat: 5, lng: 6, accuracy: 3, at: Date.now() - 6 * 60 * 1000 });
    useLocationStore.setState({ permissionStatus: 'granted' });
    useNetworkStatusMock.mockReturnValue(true);

    renderHook(() => useLocationTracking());

    await waitFor(() => expect(readPendingLocation()).toBeNull());
    expect(updateLocationMock).not.toHaveBeenCalled();
  });

  it('discards the cached fix on flush when the server rejects it with an HTTP response (not a network failure)', async () => {
    const at = Date.now();
    cachePendingLocation({ lat: 5, lng: 6, accuracy: 3, at });
    useLocationStore.setState({ permissionStatus: 'granted' });
    useNetworkStatusMock.mockReturnValue(true);
    updateLocationMock.mockRejectedValue({ response: { status: 429 } });

    renderHook(() => useLocationTracking());

    await waitFor(() => expect(updateLocationMock).toHaveBeenCalledWith(5, 6, 3));
    await waitFor(() => expect(readPendingLocation()).toBeNull());
  });

  it('keeps the cached fix for a later retry when the flush fails with a plain network error', async () => {
    const at = Date.now();
    cachePendingLocation({ lat: 5, lng: 6, accuracy: 3, at });
    useLocationStore.setState({ permissionStatus: 'granted' });
    useNetworkStatusMock.mockReturnValue(true);
    updateLocationMock.mockRejectedValue(new Error('network down'));

    renderHook(() => useLocationTracking());

    await waitFor(() => expect(updateLocationMock).toHaveBeenCalledWith(5, 6, 3));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(readPendingLocation()).toEqual({ lat: 5, lng: 6, accuracy: 3, at });
  });

  it('does not start a second watch if startWatch is invoked while one is already active', async () => {
    useLocationStore.setState({ permissionStatus: 'granted' });

    renderHook(() => useLocationTracking());
    await waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(1));

    // Simulate a spurious extra "visible" event (no intervening "hidden") on web.
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    document.dispatchEvent(new Event('visibilitychange'));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(watchPosition).toHaveBeenCalledTimes(1);
    expect(clearWatch).not.toHaveBeenCalled();
  });

  it('pauses the watch on visibilitychange to hidden and resumes it on visibilitychange to visible (web)', async () => {
    useLocationStore.setState({ permissionStatus: 'granted' });

    renderHook(() => useLocationTracking());
    await waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(1));

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(clearWatch).toHaveBeenCalledWith({ id: 'watch-1' }));
    expect(useLocationStore.getState().gpsState).toBe('idle');

    watchPosition.mockResolvedValue('watch-2');
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(2));
    // Re-checking permission on foreground is useLocationPermission's job now
    // (it's mounted app-wide and must work even when this hook isn't tracking
    // yet) — this hook only ever starts/stops the watch.
    expect(checkPermissions).not.toHaveBeenCalled();
  });

  it('clears the watch and removes the visibilitychange listener on unmount (web)', async () => {
    useLocationStore.setState({ permissionStatus: 'granted' });
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useLocationTracking());
    await waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(1));
    const [, registeredListener] = addSpy.mock.calls.find(([type]) => type === 'visibilitychange')!;

    unmount();

    await waitFor(() => expect(clearWatch).toHaveBeenCalledWith({ id: 'watch-1' }));
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', registeredListener);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('pauses and resumes the watch via the native appStateChange listener', async () => {
    isNativePlatform.mockReturnValue(true);
    const remove = vi.fn().mockResolvedValue(undefined);
    let appStateCallback: ((state: { isActive: boolean }) => void) | undefined;
    addListener.mockImplementation((event: string, callback: (state: { isActive: boolean }) => void) => {
      if (event === 'appStateChange') appStateCallback = callback;
      return Promise.resolve({ remove });
    });
    useLocationStore.setState({ permissionStatus: 'granted' });

    renderHook(() => useLocationTracking());
    await waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(1));
    expect(appStateCallback).toBeDefined();

    appStateCallback!({ isActive: false });
    await waitFor(() => expect(clearWatch).toHaveBeenCalledWith({ id: 'watch-1' }));

    watchPosition.mockResolvedValue('watch-2');
    appStateCallback!({ isActive: true });
    await waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(2));
    // Re-checking permission on foreground is useLocationPermission's job now
    // (it's mounted app-wide and must work even when this hook isn't tracking
    // yet) — this hook only ever starts/stops the watch.
    expect(checkPermissions).not.toHaveBeenCalled();
  });

  it('treats any watch error as cause to re-check permission and marks gpsState as lost', async () => {
    useLocationStore.setState({ permissionStatus: 'granted' });
    // On web, a "denied" Permissions API result maps straight to 'blocked'
    // (see useLocationPermission.ts's checkStatus) — same mapping used here.
    checkPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });
    watchPosition.mockImplementation((_options, callback) => {
      callback(undefined, { message: 'Location permission was denied' });
      return Promise.resolve('watch-1');
    });

    renderHook(() => useLocationTracking());

    await waitFor(() => expect(useLocationStore.getState().gpsState).toBe('lost'));
    await waitFor(() => expect(checkPermissions).toHaveBeenCalled());
    await waitFor(() => expect(useLocationStore.getState().permissionStatus).toBe('blocked'));
  });

  it('invalidates the nearby-users query after successfully sending a fix', async () => {
    useLocationStore.setState({ permissionStatus: 'granted' });
    watchPosition.mockImplementation((_options, callback) => {
      callback({ coords: { latitude: 10, longitude: 20, accuracy: 8 }, timestamp: 1_000 }, undefined);
      return Promise.resolve('watch-1');
    });

    renderHook(() => useLocationTracking());

    await waitFor(() => expect(updateLocationMock).toHaveBeenCalled());
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['nearby'] });
  });

  it('invalidates the nearby-users query after flushing a previously cached fix', async () => {
    cachePendingLocation({ lat: 5, lng: 6, accuracy: 3, at: Date.now() });
    useLocationStore.setState({ permissionStatus: 'granted' });

    renderHook(() => useLocationTracking());

    await waitFor(() => expect(updateLocationMock).toHaveBeenCalledWith(5, 6, 3));
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['nearby'] }));
  });

  it('does not invalidate the nearby-users query when sending a fix fails', async () => {
    useLocationStore.setState({ permissionStatus: 'granted' });
    updateLocationMock.mockRejectedValue(new Error('network down'));
    watchPosition.mockImplementation((_options, callback) => {
      callback({ coords: { latitude: 10, longitude: 20, accuracy: 8 }, timestamp: 1_000 }, undefined);
      return Promise.resolve('watch-1');
    });

    renderHook(() => useLocationTracking());

    await waitFor(() => expect(updateLocationMock).toHaveBeenCalled());
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('resumes tracking on its own once permission flips to granted (e.g. via useLocationPermission re-probing after the user grants it in OS Settings)', async () => {
    useLocationStore.setState({ permissionStatus: 'blocked' });
    const { rerender } = renderHook(() => useLocationTracking());

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(watchPosition).not.toHaveBeenCalled();

    useLocationStore.setState({ permissionStatus: 'granted' });
    rerender();

    await waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(1));
  });

  it('downgrades gpsState to lost when no fix arrives within 2x the send interval, and back to active on the next fix', async () => {
    useLocationStore.setState({ permissionStatus: 'granted' });
    let watchCallback: ((position: unknown, err: unknown) => void) | undefined;
    watchPosition.mockImplementation((_options, callback) => {
      watchCallback = callback;
      return Promise.resolve('watch-1');
    });

    // Install fake timers before mounting so the hook's own staleness-check
    // `setInterval` is itself created against the fake clock — a `setInterval`
    // created under real timers keeps ticking on the real event loop and
    // would never fire when only the fake clock is advanced.
    vi.useFakeTimers();
    try {
      renderHook(() => useLocationTracking());
      await vi.advanceTimersByTimeAsync(0);
      expect(watchPosition).toHaveBeenCalledTimes(1);

      watchCallback!({ coords: { latitude: 1, longitude: 2, accuracy: 5 }, timestamp: Date.now() }, undefined);
      expect(useLocationStore.getState().gpsState).toBe('active');

      await vi.advanceTimersByTimeAsync(2 * MIN_INTERVAL_MS + 5_000);
      expect(useLocationStore.getState().gpsState).toBe('lost');

      watchCallback!({ coords: { latitude: 1, longitude: 2, accuracy: 5 }, timestamp: Date.now() }, undefined);
      expect(useLocationStore.getState().gpsState).toBe('active');
    } finally {
      vi.useRealTimers();
    }
  });
});
