# Location Tracking + Permission UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add foreground-only continuous location tracking (Android/iOS via Capacitor, and Web) with a premium permission-request experience on the Nearby page, replacing today's single manual "update my location" GPS read.

**Architecture:** A backend validation/rate-limit pass on the existing `PATCH /api/users/location` endpoint plus two new persisted fields (`locationUpdatedAt`, `locationAccuracy`) on `User`. On the client, a permission state-machine hook (`useLocationPermission`) and a continuous-tracking hook (`useLocationTracking`, mounted once at the app root) sit on top of two pure, independently-tested modules — a movement send-gate and an offline-fix cache — and a small zustand store that both a new `LocationPermissionCard` component and the Nearby page read from.

**Tech Stack:** Express 5 + Mongoose 8 + Zod (backend validation), React 19 + Zustand 5 + `@capacitor/geolocation` (new dependency, works on native and web through one API) + `capacitor-native-settings` (new dependency, native-only "open settings" deep link) + Vitest/Testing Library (both sides, TDD throughout).

## Global Constraints

- Foreground-only tracking: the watch starts when permission is granted and the app is active, pauses when backgrounded/hidden, and never runs when the app is closed/backgrounded. No native background-location plugin, no "Always Allow" permission.
- Movement send-gate thresholds are hardcoded constants, not env/DB config: 50 meters OR 30 seconds since the last **sent** fix, whichever comes first. The very first fix after a watch starts always sends (no reference point yet).
- Offline caching holds only the single most recent unsent fix (no history/breadcrumbs, ever) and flushes it once the app is back online.
- Web's "blocked" recovery path is instructional text only — no button that pretends to open browser settings (there is no JS API for that). Native's "blocked" recovery path uses a real "Open Settings" deep link.
- The permission card/status UI lives only on the Nearby page — no app-wide banner, no separate reminder/toast cadence.
- Backend enforces movement thresholds nowhere; it only validates the payload shape/range and rate-limits the endpoint as abuse protection. The client is the single source of truth for when to send.
- Follow existing repo conventions throughout: Zod schemas in `userValidators.ts` wired through the existing `validate()` middleware, zustand stores shaped like `chatStore.ts`, hooks shaped like `useNativeAppLifecycle.ts`/`useNetworkStatus.ts`, tests in the existing Vitest + Supertest (server) / Vitest + Testing Library (client) styles.
- TDD: every task starts with a failing test, written before the implementation.

---

### Task 1: Add location metadata fields to the `User` model

**Files:**
- Modify: `server/src/models/User.ts`
- Test: `server/tests/unit/User.model.test.ts`

**Interfaces:**
- Produces: `IUser.locationUpdatedAt?: Date`, `IUser.locationAccuracy?: number` — consumed by Task 2's controller.

- [ ] **Step 1: Write the failing test**

Add to `server/tests/unit/User.model.test.ts`, inside the existing `describe('User model', ...)` block:

```ts
it('persists locationUpdatedAt and locationAccuracy when set', async () => {
  const user = await User.create({
    username: 'dave',
    displayName: 'Dave',
    email: 'dave@example.com',
    passwordHash: 'hashed',
    avatarUrl: 'https://example.com/default-avatar.png',
    locationUpdatedAt: new Date('2026-08-07T00:00:00.000Z'),
    locationAccuracy: 12.5,
  });

  expect(user.locationUpdatedAt).toEqual(new Date('2026-08-07T00:00:00.000Z'));
  expect(user.locationAccuracy).toBe(12.5);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/unit/User.model.test.ts`
Expected: FAIL — `expected undefined to equal 2026-08-07T00:00:00.000Z` (Mongoose silently drops fields that aren't declared on the schema).

- [ ] **Step 3: Write minimal implementation**

In `server/src/models/User.ts`, add to the `IUser` interface (right after `pushTokens: string[];`):

```ts
  pushTokens: string[];
  locationUpdatedAt?: Date;
  locationAccuracy?: number;
```

And add to the schema definition (right after the `pushTokens` field):

```ts
  pushTokens: { type: [String], default: [], select: false },
  locationUpdatedAt: { type: Date },
  locationAccuracy: { type: Number },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/unit/User.model.test.ts`
Expected: PASS (all tests in the file, including the pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add server/src/models/User.ts server/tests/unit/User.model.test.ts
git commit -m "feat: add locationUpdatedAt and locationAccuracy fields to User model"
```

---

### Task 2: Validate, rate-limit, and persist accuracy/timestamp on `PATCH /api/users/location`

**Files:**
- Modify: `server/src/validators/userValidators.ts`
- Modify: `server/src/middleware/rateLimiters.ts`
- Modify: `server/src/controllers/userController.ts:111-126`
- Modify: `server/src/routes/userRoutes.ts:19`
- Test: `server/tests/integration/nearby.test.ts`

**Interfaces:**
- Consumes: `IUser.locationUpdatedAt`, `IUser.locationAccuracy` (Task 1).
- Produces: `updateLocationSchema` (Zod) — not consumed elsewhere. Route behavior (400 on out-of-range lat/lng, persists `accuracy`/`locationUpdatedAt` when provided) is what Task 7's client hook relies on being correct.

- [ ] **Step 1: Write the failing tests**

Add to `server/tests/integration/nearby.test.ts`, right after the existing `it('updates user location', ...)` test:

```ts
  it('rejects an update with an out-of-range latitude', async () => {
    const res = await request(app)
      .patch('/api/v1/users/location')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ latitude: 200, longitude: -122.418 });

    expect(res.status).toBe(400);
  });

  it('persists accuracy and a fresh locationUpdatedAt timestamp when accuracy is provided', async () => {
    const res = await request(app)
      .patch('/api/v1/users/location')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ latitude: 37.775, longitude: -122.418, accuracy: 15 });

    expect(res.status).toBe(200);
    const updated = await User.findById(userA._id);
    expect(updated?.locationAccuracy).toBe(15);
    expect(updated?.locationUpdatedAt).toBeInstanceOf(Date);
    expect(Date.now() - (updated!.locationUpdatedAt as Date).getTime()).toBeLessThan(5_000);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run tests/integration/nearby.test.ts`
Expected: FAIL — the out-of-range test fails because the current handler has no range validation (returns 200, not 400); the accuracy test fails because `updated?.locationAccuracy` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

Add to `server/src/validators/userValidators.ts`:

```ts
export const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional(),
});
```

Add to `server/src/middleware/rateLimiters.ts`:

```ts
export const locationRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many location updates, please slow down.' },
});
```

Replace the `updateLocation` handler in `server/src/controllers/userController.ts:111-126` with:

```ts
export const updateLocation: RequestHandler = asyncHandler(async (req, res) => {
  const user = await requireUser(req.userId);
  const { latitude, longitude, accuracy } = req.body as { latitude: number; longitude: number; accuracy?: number };

  user.location = {
    type: 'Point',
    coordinates: [longitude, latitude],
  };
  user.locationUpdatedAt = new Date();
  if (accuracy !== undefined) user.locationAccuracy = accuracy;
  await user.save();

  res.status(200).json({ message: 'Location updated', location: user.location });
});
```

In `server/src/routes/userRoutes.ts`, update the imports and the route line. Change:

```ts
import { validate } from '../middleware/validate';
import { updateProfileSchema, changePasswordSchema, updateSettingsSchema } from '../validators/userValidators';
```

to:

```ts
import { validate } from '../middleware/validate';
import { locationRateLimiter } from '../middleware/rateLimiters';
import { updateProfileSchema, changePasswordSchema, updateSettingsSchema, updateLocationSchema } from '../validators/userValidators';
```

and change:

```ts
router.patch('/location', updateLocation);
```

to:

```ts
router.patch('/location', locationRateLimiter, validate(updateLocationSchema), updateLocation);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run tests/integration/nearby.test.ts`
Expected: PASS (all tests in the file, including the pre-existing "updates user location" test — it sends no `accuracy`, which stays optional).

Then run the full server suite to confirm nothing else broke: `cd server && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/validators/userValidators.ts server/src/middleware/rateLimiters.ts server/src/controllers/userController.ts server/src/routes/userRoutes.ts server/tests/integration/nearby.test.ts
git commit -m "feat: validate, rate-limit, and persist accuracy/timestamp on location updates"
```

---

### Task 3: Pure movement send-gate (`locationGate.ts`)

**Files:**
- Create: `client/src/utils/locationGate.ts`
- Test: `client/src/utils/locationGate.test.ts`

**Interfaces:**
- Produces: `LocationFix { lat: number; lng: number; at: number }`, `MIN_DISTANCE_METERS = 50`, `MIN_INTERVAL_MS = 30_000`, `haversineMeters(a: {lat,lng}, b: {lat,lng}): number`, `shouldSendLocationUpdate(lastSent: LocationFix | null, current: LocationFix): boolean` — consumed by Task 7's `useLocationTracking`.

- [ ] **Step 1: Write the failing tests**

Create `client/src/utils/locationGate.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/utils/locationGate.test.ts`
Expected: FAIL — `Cannot find module './locationGate'`.

- [ ] **Step 3: Write minimal implementation**

Create `client/src/utils/locationGate.ts`:

```ts
export interface LocationFix {
  lat: number;
  lng: number;
  at: number;
}

export const MIN_DISTANCE_METERS = 50;
export const MIN_INTERVAL_MS = 30_000;

const EARTH_RADIUS_METERS = 6_371_000;

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function shouldSendLocationUpdate(lastSent: LocationFix | null, current: LocationFix): boolean {
  if (!lastSent) return true;
  if (haversineMeters(lastSent, current) >= MIN_DISTANCE_METERS) return true;
  return current.at - lastSent.at >= MIN_INTERVAL_MS;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/utils/locationGate.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/locationGate.ts client/src/utils/locationGate.test.ts
git commit -m "feat: add pure movement send-gate for location tracking"
```

---

### Task 4: Offline fix cache (`locationOfflineCache.ts`)

**Files:**
- Create: `client/src/utils/locationOfflineCache.ts`
- Test: `client/src/utils/locationOfflineCache.test.ts`

**Interfaces:**
- Produces: `PendingLocationFix { lat: number; lng: number; accuracy?: number; at: number }`, `cachePendingLocation(fix): void`, `readPendingLocation(): PendingLocationFix | null`, `clearPendingLocation(): void` — consumed by Task 7's `useLocationTracking`.

- [ ] **Step 1: Write the failing tests**

Create `client/src/utils/locationOfflineCache.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/utils/locationOfflineCache.test.ts`
Expected: FAIL — `Cannot find module './locationOfflineCache'`.

- [ ] **Step 3: Write minimal implementation**

Create `client/src/utils/locationOfflineCache.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/utils/locationOfflineCache.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/locationOfflineCache.ts client/src/utils/locationOfflineCache.test.ts
git commit -m "feat: add offline cache for the most recent unsent location fix"
```

---

### Task 5: Location zustand store (`locationStore.ts`)

**Files:**
- Create: `client/src/store/locationStore.ts`
- Test: `client/src/store/locationStore.test.ts`

**Interfaces:**
- Produces: `LocationPermissionStatus = 'unknown' | 'prompt' | 'granted' | 'denied' | 'blocked'`, `GpsState = 'idle' | 'searching' | 'active' | 'lost'`, `KnownPosition { lat, lng, accuracy?: number }`, `useLocationStore` (zustand store) with state `{ permissionStatus, gpsState, lastKnownPosition, lastSentAt }` and setters `setPermissionStatus`, `setGpsState`, `setLastKnownPosition`, `setLastSentAt` — consumed by Tasks 6, 7, 8, 9.

- [ ] **Step 1: Write the failing tests**

Create `client/src/store/locationStore.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/store/locationStore.test.ts`
Expected: FAIL — `Cannot find module './locationStore'`.

- [ ] **Step 3: Write minimal implementation**

Create `client/src/store/locationStore.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/store/locationStore.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/store/locationStore.ts client/src/store/locationStore.test.ts
git commit -m "feat: add zustand store for location permission/GPS/tracking state"
```

---

### Task 6: Permission detection hook (`useLocationPermission.ts`)

**Files:**
- Modify: `client/package.json` (new dependencies)
- Modify: `client/android/app/src/main/AndroidManifest.xml`
- Modify: `client/ios/App/App/Info.plist`
- Create: `client/src/hooks/useLocationPermission.ts`
- Test: `client/src/hooks/useLocationPermission.test.ts`

**Interfaces:**
- Consumes: `useLocationStore` (Task 5).
- Produces: `useLocationPermission(): { status: LocationPermissionStatus; request(): Promise<LocationPermissionStatus>; openSettings(): Promise<void>; isNative: boolean }` — consumed by Task 8's `LocationPermissionCard` and read via the store by Task 7/9.

- [ ] **Step 1: Install the new native dependencies**

Run: `cd client && npm install @capacitor/geolocation@^8.2.1 capacitor-native-settings@^8.2.0`

- [ ] **Step 2: Declare native permission strings**

These are required by `@capacitor/geolocation` itself (documented in its README) — without them, permission requests fail on real devices/builds even though nothing in JS looks wrong. Note the iOS "Always" string below is required by the plugin's iOS dependency chain even though this feature only ever requests "when in use" access at runtime — it does not enable background tracking.

In `client/android/app/src/main/AndroidManifest.xml`, add before the closing `</manifest>` tag (right after the existing `INTERNET` permission):

```xml
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

In `client/ios/App/App/Info.plist`, add inside the top-level `<dict>` (right after the `CFBundleDisplayName` entry):

```xml
	<key>NSLocationWhenInUseUsageDescription</key>
	<string>NearMe uses your location to show you people nearby and how far away they are.</string>
	<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
	<string>NearMe uses your location to show you people nearby and how far away they are.</string>
```

- [ ] **Step 3: Write the failing tests**

Create `client/src/hooks/useLocationPermission.test.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd client && npx vitest run src/hooks/useLocationPermission.test.ts`
Expected: FAIL — `Cannot find module './useLocationPermission'`.

- [ ] **Step 5: Write minimal implementation**

Create `client/src/hooks/useLocationPermission.ts`:

```ts
import { useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';
import { useLocationStore, LocationPermissionStatus } from '../store/locationStore';

const ASKED_BEFORE_KEY = 'nearme.location.asked-before';

function hasAskedBefore(): boolean {
  return localStorage.getItem(ASKED_BEFORE_KEY) === 'true';
}

function markAskedBefore(): void {
  localStorage.setItem(ASKED_BEFORE_KEY, 'true');
}

function mapPermissionState(state: string): 'prompt' | 'granted' | 'denied' {
  if (state === 'granted') return 'granted';
  if (state === 'denied') return 'denied';
  return 'prompt';
}

async function checkStatus(): Promise<LocationPermissionStatus> {
  try {
    const result = await Geolocation.checkPermissions();
    const mapped = mapPermissionState(result.location);
    if (mapped !== 'denied') return mapped;
    // Native: a single denial is still recoverable via a fresh OS prompt; only
    // treat it as permanently blocked once we know we've already asked before.
    if (Capacitor.isNativePlatform()) return hasAskedBefore() ? 'blocked' : 'denied';
    // Web: the Permissions API's "denied" already means the browser won't
    // prompt again, so denied and blocked are the same state.
    return 'blocked';
  } catch {
    // Native throws when system location services are disabled; web throws
    // when the Permissions API itself isn't supported (e.g. Safari).
    return Capacitor.isNativePlatform() ? 'unknown' : 'prompt';
  }
}

async function requestStatus(): Promise<LocationPermissionStatus> {
  const askedBefore = hasAskedBefore();
  markAskedBefore();

  if (Capacitor.isNativePlatform()) {
    try {
      const result = await Geolocation.requestPermissions();
      const mapped = mapPermissionState(result.location);
      return mapped === 'denied' && askedBefore ? 'blocked' : mapped;
    } catch {
      return askedBefore ? 'blocked' : 'denied';
    }
  }

  // @capacitor/geolocation has no requestPermissions implementation on web —
  // the browser's own permission prompt appears as a side effect of the first
  // getCurrentPosition call.
  try {
    await Geolocation.getCurrentPosition();
    return 'granted';
  } catch {
    return 'blocked';
  }
}

export function useLocationPermission() {
  const status = useLocationStore((state) => state.permissionStatus);
  const setStatus = useLocationStore((state) => state.setPermissionStatus);

  useEffect(() => {
    void checkStatus().then(setStatus);
  }, [setStatus]);

  const request = useCallback(async () => {
    const next = await requestStatus();
    setStatus(next);
    return next;
  }, [setStatus]);

  const openSettings = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    await NativeSettings.open({ optionAndroid: AndroidSettings.ApplicationDetails, optionIOS: IOSSettings.App });
  }, []);

  return { status, request, openSettings, isNative: Capacitor.isNativePlatform() };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd client && npx vitest run src/hooks/useLocationPermission.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 7: Sync native projects**

Run: `cd client && npm run native:sync`
Expected: completes without error (this pulls the new plugin into the Android/iOS native projects; there is no automated test for native permission dialogs themselves — that can only be verified on-device).

- [ ] **Step 8: Commit**

```bash
git add client/package.json client/package-lock.json client/android/app/src/main/AndroidManifest.xml client/ios/App/App/Info.plist client/src/hooks/useLocationPermission.ts client/src/hooks/useLocationPermission.test.ts
git commit -m "feat: add cross-platform location permission state machine"
```

---

### Task 7: Continuous tracking hook (`useLocationTracking.ts`)

**Files:**
- Modify: `client/src/api/friendApi.ts:48-50`
- Modify: `client/src/components/layout/AppLayout.tsx`
- Create: `client/src/hooks/useLocationTracking.ts`
- Test: `client/src/hooks/useLocationTracking.test.ts`

**Interfaces:**
- Consumes: `shouldSendLocationUpdate`, `LocationFix` (Task 3); `cachePendingLocation`, `readPendingLocation`, `clearPendingLocation` (Task 4); `useLocationStore` (Task 5); `useNetworkStatus` (existing, `client/src/hooks/useNetworkStatus.ts`); `updateLocation` (extended below).
- Produces: `useLocationTracking(): void` — consumed by `AppLayout.tsx` (mounted once at the app root).

- [ ] **Step 1: Extend `updateLocation` to accept an optional accuracy**

In `client/src/api/friendApi.ts`, replace:

```ts
export async function updateLocation(latitude: number, longitude: number): Promise<void> {
  await apiClient.patch('/users/location', { latitude, longitude });
}
```

with:

```ts
export async function updateLocation(latitude: number, longitude: number, accuracy?: number): Promise<void> {
  await apiClient.patch('/users/location', { latitude, longitude, accuracy });
}
```

This is backward-compatible: `NearbyPage.tsx`'s existing two-argument call site is unaffected (`accuracy` is `undefined`, which `JSON.stringify` omits from the request body).

- [ ] **Step 2: Write the failing tests**

Create `client/src/hooks/useLocationTracking.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd client && npx vitest run src/hooks/useLocationTracking.test.ts`
Expected: FAIL — `Cannot find module './useLocationTracking'`.

- [ ] **Step 4: Write minimal implementation**

Create `client/src/hooks/useLocationTracking.ts`:

```ts
import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation, CallbackID } from '@capacitor/geolocation';
import { App as CapacitorApp } from '@capacitor/app';
import { useLocationStore } from '../store/locationStore';
import { useNetworkStatus } from './useNetworkStatus';
import { shouldSendLocationUpdate, LocationFix } from '../utils/locationGate';
import { cachePendingLocation, readPendingLocation, clearPendingLocation } from '../utils/locationOfflineCache';
import { updateLocation } from '../api/friendApi';

const WATCH_OPTIONS = { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10_000 };

export function useLocationTracking(): void {
  const status = useLocationStore((state) => state.permissionStatus);
  const setGpsState = useLocationStore((state) => state.setGpsState);
  const setLastKnownPosition = useLocationStore((state) => state.setLastKnownPosition);
  const setLastSentAt = useLocationStore((state) => state.setLastSentAt);
  const isOnline = useNetworkStatus();
  const lastSentRef = useRef<LocationFix | null>(null);
  const watchIdRef = useRef<CallbackID | null>(null);

  useEffect(() => {
    if (status !== 'granted') return;
    let disposed = false;

    async function sendFix(fix: LocationFix, accuracy?: number) {
      try {
        await updateLocation(fix.lat, fix.lng, accuracy);
        lastSentRef.current = fix;
        setLastSentAt(fix.at);
        clearPendingLocation();
      } catch {
        cachePendingLocation({ lat: fix.lat, lng: fix.lng, accuracy, at: fix.at });
      }
    }

    function handleFix(latitude: number, longitude: number, accuracy: number, timestamp: number) {
      if (disposed) return;
      setGpsState('active');
      setLastKnownPosition({ lat: latitude, lng: longitude, accuracy });
      const fix: LocationFix = { lat: latitude, lng: longitude, at: timestamp };
      if (shouldSendLocationUpdate(lastSentRef.current, fix)) void sendFix(fix, accuracy);
    }

    async function startWatch() {
      if (disposed) return;
      setGpsState('searching');
      const id = await Geolocation.watchPosition(WATCH_OPTIONS, (position, err) => {
        if (err || !position) return;
        handleFix(position.coords.latitude, position.coords.longitude, position.coords.accuracy, position.timestamp);
      });
      if (disposed) {
        void Geolocation.clearWatch({ id });
        return;
      }
      watchIdRef.current = id;
    }

    async function stopWatch() {
      if (watchIdRef.current) {
        const id = watchIdRef.current;
        watchIdRef.current = null;
        await Geolocation.clearWatch({ id });
      }
      setGpsState('idle');
    }

    void startWatch();

    function handleVisibility() {
      if (document.visibilityState === 'hidden') void stopWatch();
      else void startWatch();
    }

    let appStateListener: ReturnType<typeof CapacitorApp.addListener> | undefined;
    if (Capacitor.isNativePlatform()) {
      appStateListener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void startWatch();
        else void stopWatch();
      });
    } else {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      disposed = true;
      void stopWatch();
      if (appStateListener) void appStateListener.then((listener) => listener.remove());
      else document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [status, setGpsState, setLastKnownPosition, setLastSentAt]);

  useEffect(() => {
    if (!isOnline) return;
    const pending = readPendingLocation();
    if (!pending) return;
    void updateLocation(pending.lat, pending.lng, pending.accuracy)
      .then(() => {
        clearPendingLocation();
        lastSentRef.current = { lat: pending.lat, lng: pending.lng, at: pending.at };
        setLastSentAt(pending.at);
      })
      .catch(() => undefined);
  }, [isOnline, setLastSentAt]);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd client && npx vitest run src/hooks/useLocationTracking.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Mount the hook at the app root**

In `client/src/components/layout/AppLayout.tsx`, add the import next to the existing `useNativeAppLifecycle` import:

```tsx
import { useNativeAppLifecycle } from '../../hooks/useNativeAppLifecycle';
import { useLocationTracking } from '../../hooks/useLocationTracking';
```

and add the call right after the existing `useNativeAppLifecycle(drawerOpen, closeDrawer);` line:

```tsx
  useNativeAppLifecycle(drawerOpen, closeDrawer);
  useLocationTracking();
```

- [ ] **Step 7: Run the full client suite to confirm nothing else broke**

Run: `cd client && npx vitest run`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add client/src/api/friendApi.ts client/src/components/layout/AppLayout.tsx client/src/hooks/useLocationTracking.ts client/src/hooks/useLocationTracking.test.ts
git commit -m "feat: add continuous foreground location tracking with offline fallback"
```

---

### Task 8: `LocationPermissionCard` component

**Files:**
- Create: `client/src/components/nearby/LocationPermissionCard.tsx`
- Test: `client/src/components/nearby/LocationPermissionCard.test.tsx`

**Interfaces:**
- Consumes: `useLocationPermission` (Task 6), `useLocationStore` (Task 5).
- Produces: `LocationPermissionCard(): JSX.Element | null`, rendering `data-testid="location-permission-card"` whenever status isn't `'granted'` — consumed by Task 9's `NearbyPage`.

- [ ] **Step 1: Write the failing tests**

Create `client/src/components/nearby/LocationPermissionCard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocationPermissionCard } from './LocationPermissionCard';

const mockPermission = vi.fn();
vi.mock('../../hooks/useLocationPermission', () => ({
  useLocationPermission: () => mockPermission(),
}));

vi.mock('../../store/locationStore', () => ({
  useLocationStore: (selector: (state: { lastSentAt: number | null }) => unknown) => selector({ lastSentAt: null }),
}));

describe('LocationPermissionCard', () => {
  const request = vi.fn();
  const openSettings = vi.fn();

  beforeEach(() => {
    request.mockReset();
    openSettings.mockReset();
  });

  afterEach(cleanup);

  it('renders nothing once permission is granted', () => {
    mockPermission.mockReturnValue({ status: 'granted', request, openSettings, isNative: false });
    render(<LocationPermissionCard />);
    expect(screen.queryByTestId('location-permission-card')).not.toBeInTheDocument();
  });

  it('shows an Allow Location button when status is prompt', () => {
    mockPermission.mockReturnValue({ status: 'prompt', request, openSettings, isNative: false });
    render(<LocationPermissionCard />);
    expect(screen.getByTestId('location-permission-card')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Allow Location' })).toBeInTheDocument();
  });

  it('shows an Allow Location button when status is denied', () => {
    mockPermission.mockReturnValue({ status: 'denied', request, openSettings, isNative: false });
    render(<LocationPermissionCard />);
    expect(screen.getByRole('button', { name: 'Allow Location' })).toBeInTheDocument();
  });

  it('shows an Open Settings button when blocked on native', () => {
    mockPermission.mockReturnValue({ status: 'blocked', request, openSettings, isNative: true });
    render(<LocationPermissionCard />);
    expect(screen.getByRole('button', { name: 'Open Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Allow Location' })).not.toBeInTheDocument();
  });

  it('shows instructional text instead of a button when blocked on web', () => {
    mockPermission.mockReturnValue({ status: 'blocked', request, openSettings, isNative: false });
    render(<LocationPermissionCard />);
    expect(screen.getByText(/Site settings/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls request() when Allow Location is clicked', async () => {
    mockPermission.mockReturnValue({ status: 'prompt', request, openSettings, isNative: false });
    render(<LocationPermissionCard />);
    await userEvent.click(screen.getByRole('button', { name: 'Allow Location' }));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('calls openSettings() when Open Settings is clicked', async () => {
    mockPermission.mockReturnValue({ status: 'blocked', request, openSettings, isNative: true });
    render(<LocationPermissionCard />);
    await userEvent.click(screen.getByRole('button', { name: 'Open Settings' }));
    expect(openSettings).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/components/nearby/LocationPermissionCard.test.tsx`
Expected: FAIL — `Cannot find module './LocationPermissionCard'`.

- [ ] **Step 3: Write minimal implementation**

Create `client/src/components/nearby/LocationPermissionCard.tsx`:

```tsx
import { IonIcon } from '@ionic/react';
import { locationOutline, lockClosedOutline } from 'ionicons/icons';
import { motion } from 'framer-motion';
import { Button } from '../ui/Button';
import { useLocationPermission } from '../../hooks/useLocationPermission';
import { useLocationStore } from '../../store/locationStore';

const STATUS_LABEL = {
  unknown: 'Checking…',
  prompt: 'Not requested',
  granted: 'Allowed',
  denied: 'Denied',
  blocked: 'Blocked',
} as const;

export function LocationPermissionCard() {
  const { status, request, openSettings, isNative } = useLocationPermission();
  const lastSentAt = useLocationStore((state) => state.lastSentAt);

  if (status === 'granted') return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid="location-permission-card"
      className="app-card p-6 text-center"
    >
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10">
        <IonIcon icon={status === 'blocked' ? lockClosedOutline : locationOutline} className="text-2xl" />
      </span>
      <h2 className="mt-4 text-lg font-extrabold">See who's nearby</h2>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        NearMe uses your location to show people near you and how far away they are. We never share your exact location with other users.
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
        Status: {STATUS_LABEL[status]}
      </span>
      {lastSentAt && (
        <p className="mt-1 text-[11px] text-gray-400">Last updated {new Date(lastSentAt).toLocaleTimeString()}</p>
      )}
      <div className="mt-5">
        {status === 'blocked' && isNative && <Button onClick={() => void openSettings()}>Open Settings</Button>}
        {status === 'blocked' && !isNative && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Location is blocked in your browser. Click the lock icon in your address bar → Site settings → Location → Allow, then refresh this page.
          </p>
        )}
        {status !== 'blocked' && <Button onClick={() => void request()}>Allow Location</Button>}
      </div>
    </motion.section>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/components/nearby/LocationPermissionCard.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/nearby/LocationPermissionCard.tsx client/src/components/nearby/LocationPermissionCard.test.tsx
git commit -m "feat: add premium location permission card for the Nearby page"
```

---

### Task 9: Wire the permission card and GPS status into `NearbyPage`

**Files:**
- Modify: `client/src/pages/NearbyPage.tsx`
- Test: `client/src/pages/NearbyPage.test.tsx`

**Interfaces:**
- Consumes: `LocationPermissionCard` (Task 8), `useLocationPermission` (Task 6), `useLocationStore` (Task 5).

- [ ] **Step 1: Write the failing tests**

Create `client/src/pages/NearbyPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NearbyPage from './NearbyPage';
import { useLocationStore } from '../store/locationStore';

vi.mock('../api/friendApi', () => ({
  getNearbyUsers: vi.fn().mockResolvedValue({
    users: [],
    meta: { showingAllUsers: false, totalRegistered: 0, totalOnline: 0, radiusKm: 20 },
  }),
  updateLocation: vi.fn(),
  sendFriendRequest: vi.fn(),
  reportUser: vi.fn(),
}));
vi.mock('../api/chatApi', () => ({ createOrGetConversation: vi.fn() }));

const mockUseLocationPermission = vi.fn();
vi.mock('../hooks/useLocationPermission', () => ({
  useLocationPermission: () => mockUseLocationPermission(),
}));

function renderNearbyPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NearbyPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('NearbyPage location gating', () => {
  beforeEach(() => {
    useLocationStore.setState({ permissionStatus: 'unknown', gpsState: 'idle', lastKnownPosition: null, lastSentAt: null });
  });

  afterEach(cleanup);

  it('shows the location permission card instead of the map/results when permission is not granted', async () => {
    mockUseLocationPermission.mockReturnValue({ status: 'denied', request: vi.fn(), openSettings: vi.fn(), isNative: false });
    renderNearbyPage();

    await waitFor(() => expect(screen.getByTestId('location-permission-card')).toBeInTheDocument());
    expect(screen.queryByText('Center me')).not.toBeInTheDocument();
  });

  it('shows the map/results and hides the permission card once granted', async () => {
    mockUseLocationPermission.mockReturnValue({ status: 'granted', request: vi.fn(), openSettings: vi.fn(), isNative: false });
    renderNearbyPage();

    await waitFor(() => expect(screen.getByText('Center me')).toBeInTheDocument());
    expect(screen.queryByTestId('location-permission-card')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/pages/NearbyPage.test.tsx`
Expected: FAIL — both tests fail because `NearbyPage` always renders the map/results today regardless of location permission (`location-permission-card` never appears; "Center me" always appears).

- [ ] **Step 3: Write minimal implementation**

In `client/src/pages/NearbyPage.tsx`, add to the imports at the top:

```tsx
import { LocationPermissionCard } from '../components/nearby/LocationPermissionCard';
import { useLocationPermission } from '../hooks/useLocationPermission';
import { useLocationStore } from '../store/locationStore';
```

Inside the `NearbyPage` component, add right after the existing `const nearbyQuery = ...` line:

```tsx
  const { status: locationStatus } = useLocationPermission();
  const gpsState = useLocationStore((state) => state.gpsState);
  const lastSentAt = useLocationStore((state) => state.lastSentAt);
```

Replace the block that starts at `<DiscoveryMap` and ends at the `)}` closing the infinite-scroll `{users.length > 0 && (...)}` block — i.e. everything between the hero `motion.section` and the two `AnimatePresence` modals at the end of the returned JSX — with:

```tsx
      {locationStatus !== 'granted' ? (
        <LocationPermissionCard />
      ) : (
        <>
          {gpsState !== 'idle' && (
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
              <span className={`h-2 w-2 rounded-full ${gpsState === 'active' ? 'bg-emerald-400' : gpsState === 'searching' ? 'bg-amber-400' : 'bg-gray-300'}`} />
              {gpsState === 'active' ? 'GPS active' : gpsState === 'searching' ? 'Finding your location…' : 'GPS signal lost'}
              {lastSentAt && <span>· Updated {formatRelativeLocationTime(lastSentAt)}</span>}
            </div>
          )}
          <DiscoveryMap
            users={users}
            radius={radius}
            showingAllUsers={Boolean(meta?.showingAllUsers)}
            isLocating={locationMutation.isPending}
            onLocate={updateDeviceLocation}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="scrollbar-none flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
              <span className="shrink-0 text-xs font-bold uppercase tracking-[.12em] text-gray-400">Radius</span>
              {RADII.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRadius(value)}
                  className={`min-h-10 shrink-0 rounded-2xl px-4 text-xs font-bold transition ${
                    radius === value
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-500/25'
                      : 'border border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300'
                  }`}
                >
                  {value} km
                </button>
              ))}
              <button
                type="button"
                aria-pressed={onlineOnly}
                onClick={() => setOnlineOnly((value) => !value)}
                className={`min-h-10 shrink-0 rounded-2xl px-4 text-xs font-bold transition ${
                  onlineOnly
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'border border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:text-emerald-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300'
                }`}
              >
                Online now
              </button>
            </div>
            <div className="flex items-center gap-1 self-end rounded-2xl border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900 sm:self-auto">
              <button
                type="button"
                aria-label="Grid view"
                onClick={() => setView('grid')}
                className={`grid h-9 w-9 place-items-center rounded-xl transition ${view === 'grid' ? 'bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-100'}`}
              >
                <IonIcon icon={grid} />
              </button>
              <button
                type="button"
                aria-label="List view"
                onClick={() => setView('list')}
                className={`grid h-9 w-9 place-items-center rounded-xl transition ${view === 'list' ? 'bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-100'}`}
              >
                <IonIcon icon={list} />
              </button>
            </div>
          </div>

          {nearbyQuery.isPending && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((item) => <Skeleton key={item} className="h-72 rounded-[1.6rem]" />)}
            </div>
          )}
          {nearbyQuery.isError && (
            <EmptyState
              title="Couldn’t load nearby people"
              description="Check your connection and try discovery again."
              action={<Button onClick={() => nearbyQuery.refetch()}>Try again</Button>}
            />
          )}
          {!nearbyQuery.isPending && !nearbyQuery.isError && users.length === 0 && (
            <EmptyState
              title={onlineOnly ? 'No one is online right now' : 'No one here just yet'}
              description={onlineOnly ? 'Turn off Online now to browse every profile.' : 'Try a wider radius or refresh your location.'}
              action={<Button onClick={() => (onlineOnly ? setOnlineOnly(false) : setRadius(20))}>{onlineOnly ? 'Show everyone' : 'Search 20 km'}</Button>}
            />
          )}
          {users.length > 0 && (
            <>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">Community pulse</p>
                  <h2 className="mt-1 text-xl font-extrabold tracking-tight">{onlineOnly ? 'People online now' : 'Everyone near you'}</h2>
                </div>
                <span className="shrink-0 text-xs font-semibold text-gray-400">{users.length} shown</span>
              </div>
              <motion.div layout className={view === 'grid' ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-3'}>
                {visibleUsers.map((item, index) => (
                  <PersonCard
                    key={getUserId(item.user)}
                    item={item}
                    compact={view === 'list'}
                    index={index}
                    onConnect={() => connectMutation.mutate(getUserId(item.user))}
                    onChat={() => chatMutation.mutate(getUserId(item.user))}
                    onReport={() => setReportModalUser(item)}
                  />
                ))}
              </motion.div>
              <IonInfiniteScroll
                threshold="180px"
                disabled={!hasMore}
                onIonInfinite={(event) => {
                  setVisibleCount((count) => Math.min(count + 24, users.length));
                  event.target.complete();
                }}
              >
                <IonInfiniteScrollContent loadingSpinner="crescent" loadingText="Finding more people…" />
              </IonInfiniteScroll>
            </>
          )}
        </>
      )}
```

Add this helper function near the other free-standing helpers at the bottom of the file (next to `markerPosition`):

```tsx
function formatRelativeLocationTime(at: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/pages/NearbyPage.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full client suite to confirm nothing else broke**

Run: `cd client && npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/NearbyPage.tsx client/src/pages/NearbyPage.test.tsx
git commit -m "feat: gate Nearby page on location permission and show GPS status"
```

---

## Manual Verification (not covered by automated tests)

- On an actual Android/iOS device or emulator build (`npm run native:android` / `npm run native:ios`), confirm: the permission prompt appears once, a second denial flips the card to "Open Settings," and tapping it opens the app's OS settings screen.
- Confirm the watch visibly pauses (no new network calls) when the app is backgrounded, and resumes on foreground.
- Confirm a real 50m walk (or a mocked-location tool) produces a new `PATCH /users/location` call, and standing still for under 30s does not.
