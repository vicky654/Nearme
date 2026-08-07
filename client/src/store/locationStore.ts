import { create } from 'zustand';

export type LocationPermissionStatus = 'unknown' | 'prompt' | 'granted' | 'denied' | 'blocked';
export type GpsState = 'idle' | 'searching' | 'active' | 'lost';

export interface KnownPosition {
  lat: number;
  lng: number;
  accuracy?: number;
}

interface LocationStoreState {
  permissionStatus: LocationPermissionStatus;
  gpsState: GpsState;
  lastKnownPosition: KnownPosition | null;
  lastSentAt: number | null;
  setPermissionStatus: (status: LocationPermissionStatus) => void;
  setGpsState: (state: GpsState) => void;
  setLastKnownPosition: (position: KnownPosition | null) => void;
  setLastSentAt: (at: number | null) => void;
}

export const useLocationStore = create<LocationStoreState>((set) => ({
  permissionStatus: 'unknown',
  gpsState: 'idle',
  lastKnownPosition: null,
  lastSentAt: null,
  setPermissionStatus: (status) => set({ permissionStatus: status }),
  setGpsState: (state) => set({ gpsState: state }),
  setLastKnownPosition: (position) => set({ lastKnownPosition: position }),
  setLastSentAt: (at) => set({ lastSentAt: at }),
}));
