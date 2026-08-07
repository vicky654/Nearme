# NearMe — Location Tracking + Permission UX

Date: 2026-08-07
Status: Approved for planning

## Context

A broad request came in for a "premium notification + location + admin live-tracking" system (FCM push hardening, smart chat notifications, location permission UX, continuous location tracking, an admin live map dashboard, and an expanded presence system). A codebase survey found this spans five largely independent subsystems, several of which are already substantially built:

- **Push notifications (native)**: already implemented — FCM v1 send pipeline (`server/src/services/pushService.ts`), Capacitor token registration/refresh, invalid-token pruning, deep-linking on tap, Android channel + APNs sound. Web Push does not exist.
- **Smart chat notification suppression**: already fully implemented, both server (`server/src/socket/index.ts`) and client (`client/src/pages/ChatPage.tsx`) — a push/notification is skipped and the message is marked `seen` immediately when the recipient has that conversation open.
- **Presence**: online/offline + `lastSeenAt` + typing/recording exist; away/in-call/device-telemetry states do not.
- **Admin dashboard**: basic stats/user-management/reports exist; no live map, no socket-driven live view, no map library installed at all.
- **Location**: a single manual "update my location" one-shot GPS read exists (`NearbyPage.tsx`'s "Center me" button → `PATCH /api/users/location`); no continuous tracking, no permission UX beyond the bare browser prompt, no Capacitor geolocation plugin installed, no offline caching.

Given the scope, the five subsystems are being designed and built one at a time rather than as one document. **This spec covers only the Location Tracking + Permission UX subsystem** — the first, because continuous location data is a prerequisite the future admin live-dashboard subsystem will consume. The remaining four (presence/device-telemetry expansion, admin live dashboard, chat notification polish, web push) are out of scope here and will each get their own spec.

## Goals

1. A premium, non-nagging permission experience on the Nearby page: explains why location is needed, shows current permission/GPS status, offers a one-tap grant, and offers a real path to re-enable when blocked.
2. Once granted, location updates continuously while the app is active (any screen), pausing when backgrounded/hidden and resuming automatically — battery-friendly, not a firehose.
3. Updates are network-efficient: only sent when the user has moved far enough or enough time has passed.
4. Resilient to being offline: the most recent unsent position is cached and flushed on reconnect.
5. Works consistently on Android, iOS (via Capacitor), and web.

## Non-Goals (explicitly deferred)

- **True background tracking** (location updates while the app is backgrounded/killed). The request's own wording — "while the app is active," "pause when inactive" — describes foreground tracking. True background tracking needs "Always Allow" OS permission, a native background-location plugin (often paid/licensed), materially worse battery life, and extra app-store justification. Not built here.
- **Location history/breadcrumbs.** Only the current position matters for Nearby discovery and the future admin dashboard ("where is this user right now," not "where have they been"). No location-history collection, no route trail.
- **Server-authoritative movement threshold.** The distance/time gate is enforced client-side (single source of truth, avoids duplicating the same constants server-side). The server gets a rate limiter as abuse protection, not a movement-aware accept/reject rule.
- **Admin dashboard UI.** This spec only makes location data (current position + freshness) available; consuming it in a live map is the next subsystem.

## Backend Changes

### `User` model (`server/src/models/User.ts`)

Add two fields alongside the existing `location: ILocation` (GeoJSON, already `2dsphere`-indexed):

| Field | Type | Notes |
|---|---|---|
| `locationUpdatedAt` | `Date`, optional | Set whenever `location` is written. Distinct from Mongoose's generic doc `updatedAt` because other fields (profile edits, etc.) also touch the document. |
| `locationAccuracy` | `number`, optional | Meters, as reported by the Geolocation API. Informational only (surfaced in the Nearby GPS-status UI); not used for any accept/reject logic. |

### `PATCH /api/users/location`

Currently (`userController.ts:111-126`) this route has no request-schema validation and no rate limiting — it does an inline `typeof` check and is wired directly in `userRoutes.ts:19` with no `validate()` middleware, unlike every sibling route.

Changes:
- Add `updateLocationSchema` to `server/src/validators/userValidators.ts`:
  - `latitude: number` (required, -90..90)
  - `longitude: number` (required, -180..180)
  - `accuracy: number` (optional, positive)
- Wire `validate(updateLocationSchema)` into the route, matching the existing pattern used by `/me`, `/me/password`, `/me/settings`.
- Controller now also sets `user.locationUpdatedAt = new Date()` and `user.locationAccuracy = accuracy` (when provided) alongside the existing `location` write.
- Response shape unchanged (`{ message, location }`); the two new fields are persisted but not required in the response contract, since nothing downstream needs them from this endpoint yet — the client already has its own send timestamp locally (see below).
- Add a dedicated rate limiter, matching `authRateLimiter`'s shape in `server/src/middleware/rateLimiters.ts` (e.g. `locationRateLimiter`, ~60 requests / 5 minutes), applied to this route only. This is a safety net against a buggy or malicious client, not the primary throttle — the primary throttle is client-side (below).

## Client Changes

### New dependencies

- `@capacitor/geolocation` — not currently installed. Provides `checkPermissions()` / `requestPermissions()` / `getCurrentPosition()` / `watchPosition()` with a single API that works on native (Android/iOS) *and* web (Capacitor's web implementation delegates to the browser Geolocation API), so one code path covers every platform.
- `capacitor-native-settings` — small community plugin for deep-linking to the app's OS settings screen. Capacitor core has no built-in "open settings" API, and this is only needed for the native "blocked" recovery path.

Both require `npm run native:sync` to reach the Android/iOS projects.

### Permission state machine — `useLocationPermission()` hook

States: `'unknown' | 'prompt' | 'granted' | 'denied' | 'blocked'`.

- **Native**: `Geolocation.checkPermissions()` / `requestPermissions()` give `granted`/`denied`/`prompt` directly. Neither Android nor iOS exposes a distinct "permanently blocked" flag, so it's inferred: track in `localStorage` whether we've asked before; if `requestPermissions()` resolves to `denied` on a *second* ask, treat the state as `blocked` (Android silently refuses to re-prompt after "don't ask again"; iOS never re-prompts after the first denial). First-ever denial stays `denied` (still offer "Allow Location," which re-triggers the OS prompt).
- **Web**: `navigator.permissions.query({ name: 'geolocation' })` where supported — its `denied` already means "the browser won't prompt again," so web collapses `denied`≡`blocked` (no separate state). Safari fallback (no Permissions API support): infer from `getCurrentPosition`'s `PERMISSION_DENIED` error code; without the Permissions API there's no way to distinguish "never asked" from "denied" ahead of the first attempt, so state stays `prompt` until that first attempt resolves.

### `LocationPermissionCard` (Nearby page only)

Shown in place of the nearby list/map whenever permission state isn't `granted`. Contents: icon + short explainer copy, a status pill (Allowed / Denied / Blocked), last-update relative time (blank if never), and one context-appropriate action:
- `prompt` / `denied` → "Allow Location" button → `requestPermissions()`.
- `blocked`, native → "Open Settings" button → `capacitor-native-settings`'s app-settings deep link.
- `blocked`, web → instructional text only ("click the lock icon in your address bar → Site settings → Location → Allow"), no button that pretends to open anything.

This is placement-scoped to Nearby (per the earlier decision) rather than an app-wide banner — it only appears where location actually matters, so there's no separate "reminder cadence" mechanic needed: the card is simply present until resolved, which satisfies "remind until granted" without any additional toasts/modals/interruptions on unrelated screens.

### Continuous tracking — `useLocationTracking()` hook

Mounted once at the app root in `client/src/components/layout/AppLayout.tsx`, alongside the existing `useNativeAppLifecycle(...)` call — a sibling hook rather than merged into it, since `useNativeAppLifecycle` early-returns on non-native platforms and this must run on web too.

- Starts `Geolocation.watchPosition(...)` only once permission state is `granted`.
- **Pause/resume**: native — `App.addListener('appStateChange', ...)` (the same API `useNativeAppLifecycle` already uses for its own purposes) to `clearWatch()` on background and restart on foreground. Web — `document.visibilitychange` (the same pattern already used in `ChatPage.tsx` for chat-room presence), pausing the watch on hidden and resuming on visible.
- **Send-gate** (pure, independently testable function): given `{ lastSent: { lat, lng, at } | null, current: { lat, lng, at } }`, returns whether to send. First fix after the watch starts always sends (no reference point yet). After that: send if haversine distance from `lastSent` ≥ **50m** OR time since `lastSent` ≥ **30s** (hardcoded constants — no admin/env config, per the earlier decision; easy to retune in one place later if needed). Fixes that don't clear the gate still update the local "last known position" for UI purposes, just skip the network call.
- **Offline handling**: if a send fails (network error, or `@capacitor/network` — already installed — reports offline), the single most-recent unsent point is cached to `localStorage` (not a queue — only the latest position matters, per the No-History non-goal). On `Network.addListener('networkStatusChange', ...)` reporting back online, or on the next successful watch callback, that cached point is flushed first, then normal gating resumes.

### `locationStore.ts` (new, zustand — matches existing store conventions)

Holds `{ permissionStatus, gpsState, lastKnownPosition, lastSentAt }` so the Nearby page (permission card + future GPS-status row) can read tracking state without prop-drilling from the app-root hook. `gpsState` is derived, not fetched: `'searching'` (watch active, no fix yet) → `'active'` (a fix within the last 2× the send interval) → `'lost'` (granted, watch running, but no fix for longer than that — e.g. indoors/GPS off).

### Nearby page additions

Below/within the existing hero section: permission-status pill, GPS-state pill, "Last updated Xs/m ago" (relative time from `locationStore.lastSentAt`). The existing one-shot "Center me" button and its `updateLocation` mutation (`NearbyPage.tsx:79-85`, `friendApi.ts:48-50`) are left as-is — continuous tracking runs independently in the background; "Center me" remains a manual, immediate refresh.

## Testing

**Backend** (vitest, TDD as usual):
- `updateLocationSchema` validation tests (rejects out-of-range lat/lng, accepts optional `accuracy`, rejects missing required fields).
- Controller test: `PATCH /users/location` persists `locationUpdatedAt` and `locationAccuracy`.
- Rate-limiter smoke test on the route (reuses the existing `authRateLimiter` test pattern if one exists, otherwise a minimal equivalent).

**Client** (vitest + testing-library + jsdom, already configured — existing `.test.tsx` files like `VerifyEmailBanner.test.tsx` establish the pattern):
- Send-gate function: pure unit tests (no mocking needed) — first-fix-always-sends, under-threshold-skips, over-distance-sends, over-time-sends.
- `useLocationPermission`: state-transition tests per platform branch, mocking `@capacitor/geolocation` and `navigator.permissions`.
- `LocationPermissionCard`: one render test per state (prompt/denied/blocked-native/blocked-web/granted-renders-nothing).
- Offline-cache: a unit test that a failed send followed by a `networkStatusChange` (or next successful fix) flushes the cached point before sending the new one.

## Spec Self-Review

- No placeholders/TBDs remain; all thresholds and dependency choices are concrete.
- Consistent with earlier decisions in this conversation: foreground-only tracking, hardcoded thresholds, Nearby-only card placement, instructional-text web-blocked fallback, app-wide (not page-scoped) tracking lifecycle.
- Scope is a single cohesive subsystem — no further decomposition needed for one implementation plan.
- Explicitly cross-references the four sibling subsystems deferred to their own specs, so this doc doesn't silently imply they're covered.
