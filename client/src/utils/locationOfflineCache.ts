const STORAGE_KEY = 'nearme.location.pending';

export interface PendingLocationFix {
  lat: number;
  lng: number;
  accuracy?: number;
  at: number;
}

export function cachePendingLocation(fix: PendingLocationFix): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fix));
}

export function readPendingLocation(): PendingLocationFix | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingLocationFix;
  } catch {
    return null;
  }
}

export function clearPendingLocation(): void {
  localStorage.removeItem(STORAGE_KEY);
}
