# NearMe — Phase 1: Auth + Profile Foundation

Date: 2026-08-03
Status: Approved for planning

## Context

NearMe is a social discovery + chat platform (Discord/Omegle/Telegram/Bumble-Friends inspired) that will eventually include real-time chat, WebRTC voice calls, geolocation-based discovery, a friends system, notifications, and an admin panel. That full scope is too large for one design/plan/build cycle, so it's split into sequential phases:

1. **Foundation: Auth + Profile** ← this document
2. Friends System + Search + Discover/Nearby
3. Real-time Chat (Socket.io)
4. Voice Calls (WebRTC)
5. Notifications (formal system; earlier phases use minimal in-app stubs)
6. Admin Panel
7. Deployment & Hardening (Vercel/Render/Atlas, CI, production security pass)

Each phase gets its own spec → plan → implementation cycle, building on the previous phase's models and API conventions.

This document specs **Phase 1 only**: project scaffolding, JWT authentication (register/login/verify/reset/refresh/Google-ready), and user profile + settings, including the privacy toggles that don't depend on other users existing yet (block/report is deferred to Phase 2, which needs the friends/discovery graph to make sense).

## Repository & Tooling

- Location: `C:\Users\Vicky\projects\nearme`, single git repo (monorepo, no workspace tooling).
- Structure:
  ```
  nearme/
    client/   React 19 + Vite + TypeScript + Tailwind CSS + React Router
              + TanStack Query + Zustand + React Hook Form + Zod + Framer Motion
    server/   Node + Express + TypeScript + Mongoose + Socket.io (installed, unused until Phase 3)
    docs/superpowers/specs/   design docs
  ```
- No shared `packages/` workspace yet — client and server have separate `package.json`s. Add a `shared/` package later only if real duplication (e.g. shared Zod schemas) appears; not built preemptively.
- Package manager: npm.
- Testing: Vitest on both client (component tests) and server (unit + supertest integration tests).
- Local dev database: MongoDB via `docker-compose.yml` (a `mongo` service), so `npm run dev` works without a MongoDB Atlas account. `.env.example` documents swapping `MONGODB_URI` for an Atlas connection string for production.
- Linting: ESLint + Prettier. Strict TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`) on both sides — no `any`.

## Data Models (Phase 1)

### `User` (collection: `users`)

| Field | Type | Notes |
|---|---|---|
| `username` | string, unique, indexed | |
| `displayName` | string | |
| `email` | string, unique, indexed | |
| `passwordHash` | string, nullable | bcrypt, cost 12; null for Google-only accounts |
| `avatarUrl` | string | default placeholder image; real upload via Cloudinary is future work |
| `bio` | string, optional | sanitized against XSS |
| `gender` | enum, optional | |
| `age` | number, optional | |
| `country` | string, optional | |
| `city` | string, optional | |
| `interests` | string[] | |
| `languages` | string[] | |
| `lastSeenAt` | Date | |
| `createdAt` | Date | |
| `privacy` | object | `{ hideOnlineStatus, hideDistance, hideProfile, invisibleMode, privateAccount }`, all booleans, default `false` |
| `emailVerifiedAt` | Date, nullable | null until verified |
| `googleId` | string, optional | unset until Google login is activated |
| `role` | enum `'user' \| 'admin'` | added now so Phase 6 (Admin Panel) needs no migration |
| `status` | enum `'active' \| 'suspended' \| 'banned'` | added now for the same reason; Phase 6 acts on it, doesn't invent it |

### `UserSession` (collection: `usersessions`)

Refresh-token tracking for secure rotation/revocation.

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId | |
| `refreshTokenHash` | string | raw token is never stored |
| `userAgent` | string | |
| `ipAddress` | string | coarse, request-logging only — never used for geolocation |
| `createdAt` | Date | |
| `expiresAt` | Date | |
| `revokedAt` | Date, nullable | |

**Explicitly not built in Phase 1**: `UserLocations`, `AuditLogs`, `BlockedUsers`, `FriendRequests`, `Friends` collections. They belong to Phase 2 (discovery/friends) or Phase 6 (admin) and would sit empty and untested if scaffolded now.

## Auth Flow

- **Register** → creates user with `emailVerifiedAt: null`; sends a verification email (via Resend) containing a signed, expiring token link.
- **Verify Email** → endpoint validates the token and sets `emailVerifiedAt`. Unverified users can still log in but see a persistent "verify your email" banner — a soft gate, not a hard block, to avoid a support-ticket-generating dead end.
- **Login** → validates credentials, issues:
  - **Access token**: JWT, 15 min expiry, returned in the response body, held only in memory (Zustand store) on the client — never `localStorage`, to limit XSS blast radius.
  - **Refresh token**: 7 day expiry, set as an httpOnly + Secure + SameSite=Strict cookie; hashed and stored in `UserSessions`.
- **Auto Login** → on app load, the client silently calls `/auth/refresh` using the httpOnly cookie; a valid cookie yields a new access token with no user interaction.
- **Remember Me** → unchecked at login makes the refresh cookie session-only instead of persistent (7-day) — same mechanism, different cookie lifetime.
- **Logout** → revokes the specific `UserSession` (`revokedAt` set) and clears the cookie.
- **Forgot / Reset Password** → same signed-token-via-email pattern as verification; single-use, 30 min expiry.
- **Google Login** → `/auth/google` route and the client-side button are both built now. The server verifies Google ID tokens via `google-auth-library` only when a `GOOGLE_CLIENT_ID` env var is present; until then the button renders disabled with an explanatory tooltip rather than silently failing.
- Passwords hashed with bcrypt (cost factor 12). `login`, `register`, and `forgot-password` routes are rate-limited (`express-rate-limit`) to blunt credential stuffing.

## Profile, Settings & Frontend

**API** — all under `/api/v1/`:
- `auth/register`, `auth/login`, `auth/logout`, `auth/refresh`, `auth/verify-email`, `auth/forgot-password`, `auth/reset-password`, `auth/google`
- `users/me` (GET/PATCH own profile)
- `users/me/password` (PATCH)
- `users/me/settings` (GET/PATCH — theme, privacy toggles)

**Frontend pages**: Login, Register, Forgot Password, Reset Password, Verify Email (landing page for the emailed link), Profile (view/edit via React Hook Form + Zod), Settings (tabbed: Profile / Password / Privacy / Theme), and a minimal Dashboard shell (welcome card + "more coming soon" placeholder — the real widgets described in the original brief, such as friends online or suggested friends, depend on Phase 2/3 data and won't be faked with static mockups).

**Cross-cutting frontend concerns**:
- Axios instance with interceptors: auto-attach access token, auto-refresh-and-retry on 401.
- TanStack Query for server state; Zustand for auth/theme client state.
- Toast notifications on every mutation (success/error).
- Loading skeletons on Profile/Settings.
- One shared `ErrorBoundary` and one shared empty-state component pattern, reused in later phases.
- Theme (light/dark/system) via a `data-theme` attribute + Tailwind `dark:` variants; switches instantly, no reload.

**Security middleware**: Helmet; CORS locked to the client origin; Zod validation on every request body; sanitization against XSS on free-text fields (`bio`, `displayName`); centralized error handler that never leaks stack traces in production.

## Explicitly Out of Scope for Phase 1

- Friend requests/friends/block/report (Phase 2)
- Discovery, nearby users, geolocation storage (Phase 2)
- Global search (Phase 2, since it searches interests/country/city meaningfully once discovery exists)
- Chat, voice calls, notifications, admin panel (Phases 3–6)
- Deployment to Vercel/Render/Atlas (Phase 7) — Phase 1 targets local development only
- Cloudinary avatar upload (future; Phase 1 assigns a default placeholder avatar per user and does not expose any way to change it — no file upload, no arbitrary URL field. The `avatarUrl` column exists on the model so Phase-future Cloudinary work is a data migration, not a schema change.)
