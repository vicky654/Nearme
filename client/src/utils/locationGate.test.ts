import { describe, it, expect } from 'vitest';
import { haversineMeters, shouldSendLocationUpdate, MIN_DISTANCE_METERS, MIN_INTERVAL_MS } from './locationGate';

describe('haversineMeters', () => {
  it('returns 0 for the same point', () => {
    expect(haversineMeters({ lat: 37.7749, lng: -122.4194 }, { lat: 37.7749, lng: -122.4194 })).toBe(0);
  });

  it('returns roughly 111 meters for a 0.001 degree latitude step', () => {
    const distance = haversineMeters({ lat: 37.7749, lng: -122.4194 }, { lat: 37.7759, lng: -122.4194 });
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(120);
  });
});

describe('shouldSendLocationUpdate', () => {
  it('sends when there is no previous fix', () => {
    expect(shouldSendLocationUpdate(null, { lat: 1, lng: 1, at: 0 })).toBe(true);
  });

  it('skips when the new fix is close in both distance and time', () => {
    const lastSent = { lat: 37.7749, lng: -122.4194, at: 0 };
    const current = { lat: 37.7749, lng: -122.4194, at: 5_000 };
    expect(shouldSendLocationUpdate(lastSent, current)).toBe(false);
  });

  it(`sends when distance is at least ${MIN_DISTANCE_METERS}m even if time is short`, () => {
    const lastSent = { lat: 37.7749, lng: -122.4194, at: 0 };
    const current = { lat: 37.7759, lng: -122.4194, at: 1_000 };
    expect(shouldSendLocationUpdate(lastSent, current)).toBe(true);
  });

  it(`sends when time is at least ${MIN_INTERVAL_MS}ms even if distance is small`, () => {
    const lastSent = { lat: 37.7749, lng: -122.4194, at: 0 };
    const current = { lat: 37.7749, lng: -122.4194, at: MIN_INTERVAL_MS + 1_000 };
    expect(shouldSendLocationUpdate(lastSent, current)).toBe(true);
  });
});
