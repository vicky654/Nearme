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

import { useLocationPermission } from './useLocationPermission';
import { useLocationStore } from '../store/locationStore';

describe('useLocationPermission', () => {
  beforeEach(() => {
    localStorage.clear();
    useLocationStore.setState({ permissionStatus: 'unknown', gpsState: 'idle', lastKnownPosition: null, lastSentAt: null });
    checkPermissions.mockReset();
    requestPermissions.mockReset();
    getCurrentPosition.mockReset();
    openSettings.mockReset();
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
});
