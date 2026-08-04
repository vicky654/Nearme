# NearMe

A social discovery and chat platform — Phase 1 (Auth + Profile Foundation) is implemented here. See `docs/superpowers/specs/2026-08-03-auth-profile-foundation-design.md` for the full design and the phase roadmap (Friends/Discovery, Chat, Voice Calls, Notifications, Admin Panel, and Deployment follow as separate phases).

## Prerequisites

- Node.js 22+ (required by `google-auth-library@11`)
- npm 10+
- Docker (for local MongoDB)

## First-time setup

1. Start local MongoDB:

   ```bash
   docker compose up -d
   ```

2. Set up the server:

   ```bash
   cd server
   npm install
   cp .env.example .env
   ```

   Edit `server/.env` and fill in:
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_PURPOSE_SECRET` — generate each with `openssl rand -hex 32`
   - `RESEND_API_KEY` — from your Resend account (required for register/forgot-password emails to actually send; the app still runs without it, but those emails will fail)
   - `GOOGLE_CLIENT_ID` — leave commented out unless you have a Google OAuth Client ID; Google login stays disabled (returns a clear 503) until this is set

3. Set up the client:

   ```bash
   cd client
   npm install
   cp .env.example .env
   ```

   `VITE_GOOGLE_CLIENT_ID` in `client/.env` similarly stays commented out until you have a Google OAuth Client ID — the Google button renders disabled with a tooltip until then.

## Running locally

In one terminal:

```bash
cd server
npm run dev
```

In another terminal:

```bash
cd client
npm run dev
```

The client runs at `http://localhost:5173`, the server API at `http://localhost:4000/api/v1`.

## Running tests

```bash
cd server && npm test
cd client && npm test
```

Server tests use an in-memory MongoDB (`mongodb-memory-server`) — no running database is required to run the test suite, only for `npm run dev`.

## Project structure

```
nearme/
  docker-compose.yml       Local MongoDB for development
  server/                  Express + TypeScript API
  client/                  React 19 + Vite + TypeScript app
  docs/superpowers/specs/  Design documents, one per phase
  docs/superpowers/plans/  Implementation plans, one per phase
```

## Roadmap

Phase 1 (this repo so far) covers authentication and user profile/settings. Later phases, each with their own spec and plan:

1. ~~Foundation: Auth + Profile~~ (this phase)
2. Friends System + Search + Discover/Nearby
3. Real-time Chat (Socket.io)
4. Voice Calls (WebRTC)
5. Notifications
6. Admin Panel
7. Deployment & Hardening (Vercel/Render/Atlas, CI)
