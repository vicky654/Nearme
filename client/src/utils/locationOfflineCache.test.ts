import { describe, it, expect, beforeEach } from 'vitest';
import { cachePendingLocation, readPendingLocation, clearPendingLocation } from './locationOfflineCache';

describe('locationOfflineCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is cached', () => {
    expect(readPendingLocation()).toBeNull();
  });

  it('returns the cached fix after caching it', () => {
    cachePendingLocation({ lat: 1.5, lng: 2.5, accuracy: 10, at: 12345 });
    expect(readPendingLocation()).toEqual({ lat: 1.5, lng: 2.5, accuracy: 10, at: 12345 });
  });

  it('returns null after clearing the cache', () => {
    cachePendingLocation({ lat: 1.5, lng: 2.5, at: 12345 });
    clearPendingLocation();
    expect(readPendingLocation()).toBeNull();
  });

  it('returns null instead of throwing when the stored value is corrupted', () => {
    localStorage.setItem('nearme.location.pending', 'not-json');
    expect(readPendingLocation()).toBeNull();
  });
});
