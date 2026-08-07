import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';

const isNativePlatform = vi.fn().mockReturnValue(false);
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: (...args: unknown[]) => isNativePlatform(...args) } }));

const watchPosition = vi.fn();
const clearWatch = vi.fn().mockResolvedValue(undefined);
vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    watchPosition: (...args: unknown[]) => watchPosition(...args),
    clearWatch: (...args: unknown[]) => clearWatch(...args),
  },
}));

const addListener = vi.fn();
vi.mock('@capacitor/app', () => ({ App: { addListener: (...args: unknown[]) => addListener(...args) } }));

const useNetworkStatusMock = vi.fn().mockReturnValue(true);
vi.mock('./useNetworkStatus', () => ({ useNetworkStatus: () => useNetworkStatusMock() }));

const updateLocationMock = vi.fn();
vi.mock('../api/friendApi', () => ({ updateLocation: (...args: unknown[]) => updateLocationMock(...args) }));

import { useLocationTracking } from './useLocationTracking';
import { useLocationStore } from '../store/locationStore';
import { cachePendingLocation, readPendingLocation } from '../utils/locationOfflineCache';

describe('useLocationTracking', () => {
  beforeEach(() => {
    localStorage.clear();
    useLocationStore.setState({ permissionStatus: 'unknown', gpsState: 'idle', lastKnownPosition: null, lastSentAt: null });
    isNativePlatform.mockReset().mockReturnValue(false);
    watchPosition.mockReset().mockResolvedValue('watch-1');
    clearWatch.mockClear();
    addListener.mockReset();
    updateLocationMock.mockReset().mockResolvedValue(undefined);
    useNetworkStatusMock.mockReturnValue(true);
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

  it('flushes a previously cached fix once online, without starting the watch', async () => {
    cachePendingLocation({ lat: 5, lng: 6, accuracy: 3, at: 3_000 });
    useLocationStore.setState({ permissionStatus: 'prompt' });
    useNetworkStatusMock.mockReturnValue(true);

    renderHook(() => useLocationTracking());

    await waitFor(() => expect(updateLocationMock).toHaveBeenCalledWith(5, 6, 3));
    expect(readPendingLocation()).toBeNull();
    expect(watchPosition).not.toHaveBeenCalled();
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
  });
});
