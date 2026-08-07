import { describe, it, expect, beforeEach } from 'vitest';
import { useLocationStore } from './locationStore';

describe('locationStore', () => {
  beforeEach(() => {
    useLocationStore.setState({
      permissionStatus: 'unknown',
      gpsState: 'idle',
      lastKnownPosition: null,
      lastSentAt: null,
    });
  });

  it('defaults to unknown permission and idle GPS state', () => {
    const state = useLocationStore.getState();
    expect(state.permissionStatus).toBe('unknown');
    expect(state.gpsState).toBe('idle');
    expect(state.lastKnownPosition).toBeNull();
    expect(state.lastSentAt).toBeNull();
  });

  it('setPermissionStatus updates only permissionStatus', () => {
    useLocationStore.getState().setPermissionStatus('granted');
    expect(useLocationStore.getState().permissionStatus).toBe('granted');
    expect(useLocationStore.getState().gpsState).toBe('idle');
  });

  it('setGpsState updates only gpsState', () => {
    useLocationStore.getState().setGpsState('active');
    expect(useLocationStore.getState().gpsState).toBe('active');
    expect(useLocationStore.getState().permissionStatus).toBe('unknown');
  });

  it('setLastKnownPosition stores the given position', () => {
    useLocationStore.getState().setLastKnownPosition({ lat: 1, lng: 2, accuracy: 5 });
    expect(useLocationStore.getState().lastKnownPosition).toEqual({ lat: 1, lng: 2, accuracy: 5 });
  });

  it('setLastSentAt stores the given timestamp', () => {
    useLocationStore.getState().setLastSentAt(12345);
    expect(useLocationStore.getState().lastSentAt).toBe(12345);
  });
});
