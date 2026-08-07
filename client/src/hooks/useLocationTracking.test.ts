import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

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

vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn() } }));

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
    watchPosition.mockReset().mockResolvedValue('watch-1');
    clearWatch.mockClear();
    updateLocationMock.mockReset().mockResolvedValue(undefined);
    useNetworkStatusMock.mockReturnValue(true);
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
});
