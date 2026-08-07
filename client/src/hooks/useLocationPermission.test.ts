import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const isNativePlatform = vi.fn();
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: (...args: unknown[]) => isNativePlatform(...args) } }));

const checkPermissions = vi.fn();
const requestPermissions = vi.fn();
const getCurrentPosition = vi.fn();
vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    checkPermissions: (...args: unknown[]) => checkPermissions(...args),
    requestPermissions: (...args: unknown[]) => requestPermissions(...args),
    getCurrentPosition: (...args: unknown[]) => getCurrentPosition(...args),
  },
}));

const openSettings = vi.fn();
vi.mock('capacitor-native-settings', () => ({
  NativeSettings: { open: (...args: unknown[]) => openSettings(...args) },
  AndroidSettings: { ApplicationDetails: 'application_details' },
  IOSSettings: { App: 'app' },
}));

const addListener = vi.fn();
vi.mock('@capacitor/app', () => ({ App: { addListener: (...args: unknown[]) => addListener(...args) } }));

import { useLocationPermission, refreshLocationPermissionStatus } from './useLocationPermission';
import { useLocationStore } from '../store/locationStore';

describe('useLocationPermission', () => {
  beforeEach(() => {
    localStorage.clear();
    useLocationStore.setState({ permissionStatus: 'unknown', gpsState: 'idle', lastKnownPosition: null, lastSentAt: null });
    checkPermissions.mockReset();
    requestPermissions.mockReset();
    getCurrentPosition.mockReset();
    openSettings.mockReset();
    addListener.mockReset();
  });

  afterEach(() => {
    isNativePlatform.mockReset();
  });

  it('reports granted on native when checkPermissions resolves granted', async () => {
    isNativePlatform.mockReturnValue(true);
    checkPermissions.mockResolvedValue({ location: 'granted', coarseLocation: 'granted' });

    const { result } = renderHook(() => useLocationPermission());

    await waitFor(() => expect(result.current.status).toBe('granted'));
  });

  it('reports denied (not blocked) on native the first time it is checked', async () => {
    isNativePlatform.mockReturnValue(true);
    checkPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });

    const { result } = renderHook(() => useLocationPermission());

    await waitFor(() => expect(result.current.status).toBe('denied'));
  });

  it('reports blocked on native once a previous request was already denied', async () => {
    localStorage.setItem('nearme.location.asked-before', 'true');
    isNativePlatform.mockReturnValue(true);
    checkPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });

    const { result } = renderHook(() => useLocationPermission());

    await waitFor(() => expect(result.current.status).toBe('blocked'));
  });

  it('treats a denied Permissions API result as blocked on web', async () => {
    isNativePlatform.mockReturnValue(false);
    checkPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });

    const { result } = renderHook(() => useLocationPermission());

    await waitFor(() => expect(result.current.status).toBe('blocked'));
  });

  it('falls back to prompt on web when the Permissions API is unavailable', async () => {
    isNativePlatform.mockReturnValue(false);
    checkPermissions.mockRejectedValue(new Error('unavailable'));

    const { result } = renderHook(() => useLocationPermission());

    await waitFor(() => expect(result.current.status).toBe('prompt'));
  });

  it('request() on web calls getCurrentPosition and resolves granted on success', async () => {
    isNativePlatform.mockReturnValue(false);
    checkPermissions.mockResolvedValue({ location: 'prompt', coarseLocation: 'prompt' });
    getCurrentPosition.mockResolvedValue({ coords: { latitude: 1, longitude: 2, accuracy: 5 }, timestamp: 0 });

    const { result } = renderHook(() => useLocationPermission());
    await waitFor(() => expect(result.current.status).toBe('prompt'));

    await act(async () => {
      await result.current.request();
    });

    expect(result.current.status).toBe('granted');
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it('openSettings calls NativeSettings.open on native', async () => {
    isNativePlatform.mockReturnValue(true);
    checkPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });

    const { result } = renderHook(() => useLocationPermission());
    await waitFor(() => expect(result.current.status).toBe('denied'));

    await act(async () => {
      await result.current.openSettings();
    });

    expect(openSettings).toHaveBeenCalledWith({ optionAndroid: 'application_details', optionIOS: 'app' });
  });

  it('refreshLocationPermissionStatus re-checks status and writes it to the shared store without a hook instance', async () => {
    isNativePlatform.mockReturnValue(false);
    checkPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });

    const next = await refreshLocationPermissionStatus();

    expect(next).toBe('blocked');
    expect(useLocationStore.getState().permissionStatus).toBe('blocked');
  });

  it('openSettings is a no-op on web', async () => {
    isNativePlatform.mockReturnValue(false);
    checkPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });

    const { result } = renderHook(() => useLocationPermission());
    await waitFor(() => expect(result.current.status).toBe('blocked'));

    await act(async () => {
      await result.current.openSettings();
    });

    expect(openSettings).not.toHaveBeenCalled();
  });

  it('re-probes on foreground (web visibilitychange) and picks up a grant made while backgrounded, even though status started out blocked', async () => {
    isNativePlatform.mockReturnValue(false);
    checkPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });

    const { result } = renderHook(() => useLocationPermission());
    await waitFor(() => expect(result.current.status).toBe('blocked'));

    // User left the app, granted location in the browser's site settings,
    // then returned — nothing in this hook has been asked to re-check yet.
    checkPermissions.mockResolvedValue({ location: 'granted', coarseLocation: 'granted' });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => expect(result.current.status).toBe('granted'));
  });

  it('does not re-probe when the web page becomes hidden', async () => {
    isNativePlatform.mockReturnValue(false);
    checkPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });

    renderHook(() => useLocationPermission());
    await waitFor(() => expect(checkPermissions).toHaveBeenCalledTimes(1));
    checkPermissions.mockClear();

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(checkPermissions).not.toHaveBeenCalled();
  });

  it('removes the visibilitychange listener on unmount (web)', async () => {
    isNativePlatform.mockReturnValue(false);
    checkPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useLocationPermission());
    await waitFor(() => expect(checkPermissions).toHaveBeenCalledTimes(1));
    const [, registeredListener] = addSpy.mock.calls.find(([type]) => type === 'visibilitychange')!;

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', registeredListener);
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('re-probes on foreground (native appStateChange) and picks up a grant made while backgrounded, even though status started out blocked', async () => {
    localStorage.setItem('nearme.location.asked-before', 'true');
    isNativePlatform.mockReturnValue(true);
    checkPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });
    const remove = vi.fn().mockResolvedValue(undefined);
    let appStateCallback: ((state: { isActive: boolean }) => void) | undefined;
    addListener.mockImplementation((event: string, callback: (state: { isActive: boolean }) => void) => {
      if (event === 'appStateChange') appStateCallback = callback;
      return Promise.resolve({ remove });
    });

    const { result } = renderHook(() => useLocationPermission());
    await waitFor(() => expect(result.current.status).toBe('blocked'));
    expect(appStateCallback).toBeDefined();

    checkPermissions.mockResolvedValue({ location: 'granted', coarseLocation: 'granted' });
    appStateCallback!({ isActive: true });

    await waitFor(() => expect(result.current.status).toBe('granted'));
  });

  it('does not re-probe when the native app goes to background', async () => {
    isNativePlatform.mockReturnValue(true);
    checkPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });
    const remove = vi.fn().mockResolvedValue(undefined);
    let appStateCallback: ((state: { isActive: boolean }) => void) | undefined;
    addListener.mockImplementation((event: string, callback: (state: { isActive: boolean }) => void) => {
      if (event === 'appStateChange') appStateCallback = callback;
      return Promise.resolve({ remove });
    });

    renderHook(() => useLocationPermission());
    await waitFor(() => expect(checkPermissions).toHaveBeenCalledTimes(1));
    checkPermissions.mockClear();

    appStateCallback!({ isActive: false });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(checkPermissions).not.toHaveBeenCalled();
  });

  it('removes the native appStateChange listener on unmount', async () => {
    isNativePlatform.mockReturnValue(true);
    checkPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });
    const remove = vi.fn().mockResolvedValue(undefined);
    addListener.mockResolvedValue({ remove });

    const { unmount } = renderHook(() => useLocationPermission());
    await waitFor(() => expect(checkPermissions).toHaveBeenCalledTimes(1));

    unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(remove).toHaveBeenCalled();
  });
});
