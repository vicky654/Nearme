# NearMe — Phase 1: Auth + Profile Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the NearMe monorepo (client + server) with full JWT authentication (register, login, email verify, forgot/reset password, refresh, Google-ready-but-disabled) and a user profile + settings system, per `docs/superpowers/specs/2026-08-03-auth-profile-foundation-design.md`.

**Architecture:** Monorepo with independent `client/` (React 19 + Vite + TS) and `server/` (Express + TS + Mongoose) packages, no shared workspace tooling. Server exposes a versioned REST API under `/api/v1`. Access tokens are short-lived JWTs held in client memory (Zustand); refresh tokens are opaque, hashed-at-rest, httpOnly-cookie-delivered, and tracked per-session in MongoDB for revocation.

**Tech Stack:** React 19, Vite, TypeScript (strict), Tailwind CSS, React Router, TanStack Query, Zustand, React Hook Form, Zod, Framer Motion, Axios — Node.js, Express, TypeScript (strict), Mongoose, JWT (`jsonwebtoken`), bcrypt, Resend (email), Helmet, `express-rate-limit`, Docker (local MongoDB) — Vitest + Supertest + React Testing Library for tests.

## Global Constraints

- Strict TypeScript on both client and server: `strict: true`, `noUncheckedIndexedAccess: true`, no `any` anywhere.
- Package manager: npm (not yarn/pnpm).
- No workspace tooling (no pnpm workspaces, no turborepo) — `client/` and `server/` each have an independent `package.json`.
- All REST endpoints live under `/api/v1/`.
- Access tokens: JWT, 15 min TTL, never persisted to `localStorage` — held only in the Zustand auth store (memory).
- Refresh tokens: opaque random tokens (not JWT), delivered as httpOnly + Secure (prod) + SameSite=Strict cookies, stored hashed (SHA-256) in the `UserSession` collection, 7-day TTL (session-only cookie if "remember me" is unchecked).
- Passwords: bcrypt, cost factor 12.
- `register`, `login`, `forgot-password` routes are rate-limited via `express-rate-limit`.
- Every request body is validated with a Zod schema before reaching a controller.
- Local dev database is MongoDB via Docker Compose — no MongoDB Atlas account required for Phase 1.
- Email sending provider: Resend.
- Every task that adds behavior ships with tests (Vitest; Supertest for HTTP integration tests; React Testing Library for component tests). No task is "done" until its tests pass.

## File Structure

```
nearme/
  docker-compose.yml
  server/
    package.json
    tsconfig.json
    .env.example
    vitest.config.ts
    src/
      index.ts                      entrypoint: connect DB, start HTTP server
      app.ts                        Express app: middleware + route mounting
      config/
        env.ts                      Zod-validated environment config
        database.ts                 Mongoose connection helper
      types/
        express.d.ts                augments Express.Request with userId
      models/
        User.ts
        UserSession.ts
      services/
        passwordService.ts          bcrypt hash/compare
        tokenService.ts             access/refresh/purpose token sign+verify
        emailService.ts             Resend wrapper (verification + reset emails)
      utils/
        AppError.ts
        asyncHandler.ts
        toPublicUser.ts
      middleware/
        validate.ts                 Zod request-body validation middleware
        authenticate.ts             access-token auth guard
        rateLimiters.ts
        errorHandler.ts
      validators/
        authValidators.ts
        userValidators.ts
      controllers/
        authController.ts
        userController.ts
      routes/
        authRoutes.ts
        userRoutes.ts
        index.ts                    mounts everything under /api/v1
    tests/
      unit/
        passwordService.test.ts
        tokenService.test.ts
        emailService.test.ts
        User.model.test.ts
        UserSession.model.test.ts
      integration/
        health.test.ts
        auth.register.test.ts
        auth.login.test.ts
        auth.refresh-logout.test.ts
        auth.password-reset.test.ts
        auth.google.test.ts
        users.me.test.ts
      helpers/
        testDb.ts                   in-memory Mongo setup/teardown for tests
  client/
    package.json
    tsconfig.json
    vite.config.ts
    tailwind.config.ts
    vitest.config.ts
    index.html
    .env.example
    src/
      main.tsx
      App.tsx
      index.css
      routes/
        router.tsx
      types/
        user.ts
      api/
        axiosClient.ts
        authApi.ts
        userApi.ts
      store/
        authStore.ts
        themeStore.ts
      validators/
        authSchemas.ts
        userSchemas.ts
      components/
        ui/
          Button.tsx
          Input.tsx
          Skeleton.tsx
          Toaster.tsx
          ErrorBoundary.tsx
          EmptyState.tsx
        layout/
          AuthLayout.tsx
          AppLayout.tsx
        auth/
          GoogleButton.tsx
          ProtectedRoute.tsx
      pages/
        auth/
          LoginPage.tsx
          RegisterPage.tsx
          ForgotPasswordPage.tsx
          ResetPasswordPage.tsx
          VerifyEmailPage.tsx
        DashboardPage.tsx
        ProfilePage.tsx
        settings/
          SettingsPage.tsx
    src/test/
      setup.ts
      *.test.tsx  (colocated per component/page, see tasks)
  README.md
```

---

### Task 1: Server project scaffolding, env config, DB connection, health check

**Files:**
- Create: `docker-compose.yml`
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/.env.example`
- Create: `server/vitest.config.ts`
- Create: `server/src/config/env.ts`
- Create: `server/src/config/database.ts`
- Create: `server/src/app.ts`
- Create: `server/src/index.ts`
- Test: `server/tests/unit/env.test.ts`
- Test: `server/tests/integration/health.test.ts`
- Test: `server/tests/helpers/testDb.ts`

**Interfaces:**
- Produces: `env` object (default export from `config/env.ts`) with shape `{ NODE_ENV: 'development'|'test'|'production', PORT: number, MONGODB_URI: string, JWT_ACCESS_SECRET: string, JWT_REFRESH_SECRET: string, JWT_PURPOSE_SECRET: string, RESEND_API_KEY: string, EMAIL_FROM: string, CLIENT_URL: string, GOOGLE_CLIENT_ID: string | undefined }`
- Produces: `connectDB(uri: string): Promise<void>` and `disconnectDB(): Promise<void>` from `config/database.ts`
- Produces: `app` (Express application instance, default export) from `app.ts`, with `GET /api/v1/health` returning `{ status: 'ok' }`

- [ ] **Step 1: Create `docker-compose.yml` at the repo root**

```yaml
services:
  mongo:
    image: mongo:7
    restart: unless-stopped
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

volumes:
  mongo-data:
```

- [ ] **Step 2: Initialize `server/package.json`**

```bash
mkdir -p server/src server/tests/unit server/tests/integration server/tests/helpers
cd server
npm init -y
npm install express mongoose jsonwebtoken bcrypt resend helmet cors express-rate-limit zod dotenv cookie-parser
npm install -D typescript tsx @types/express @types/node @types/jsonwebtoken @types/bcrypt @types/cookie-parser @types/cors vitest supertest @types/supertest mongodb-memory-server eslint prettier
```

Edit the generated `server/package.json` scripts section to:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Create `server/.env.example`**

```
NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb://localhost:27017/nearme
JWT_ACCESS_SECRET=replace-with-a-long-random-string
JWT_REFRESH_SECRET=replace-with-a-different-long-random-string
JWT_PURPOSE_SECRET=replace-with-yet-another-long-random-string
RESEND_API_KEY=replace-with-your-resend-api-key
EMAIL_FROM="NearMe <no-reply@yourdomain.com>"
CLIENT_URL=http://localhost:5173
# GOOGLE_CLIENT_ID=set-this-to-enable-google-login
```

Copy it to a real `.env` for local dev: `cp server/.env.example server/.env` and fill in the JWT secrets (e.g. `openssl rand -hex 32`) and a real `RESEND_API_KEY` when you have one — email sending will fail gracefully in tests (Task 4 mocks it) but is required for manually testing register/forgot-password by hand.

- [ ] **Step 5: Write the failing test for env validation**

`server/tests/unit/env.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const REQUIRED_VARS = [
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_PURPOSE_SECRET',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'CLIENT_URL',
];

describe('env config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws when a required variable is missing', async () => {
    vi_resetModules();
    delete process.env.JWT_ACCESS_SECRET;
    await expect(import('../../src/config/env')).rejects.toBeDefined();
  });

  it('loads successfully when all required variables are present', async () => {
    vi_resetModules();
    process.env.NODE_ENV = 'test';
    process.env.PORT = '4000';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/nearme-test';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
    process.env.JWT_PURPOSE_SECRET = 'c'.repeat(32);
    process.env.RESEND_API_KEY = 'test-key';
    process.env.EMAIL_FROM = 'NearMe <no-reply@test.dev>';
    process.env.CLIENT_URL = 'http://localhost:5173';

    const { env } = await import('../../src/config/env');
    expect(env.PORT).toBe(4000);
    expect(env.MONGODB_URI).toBe('mongodb://localhost:27017/nearme-test');
  });
});

function vi_resetModules() {
  // vitest hoists vi.resetModules; imported lazily below to keep dynamic import fresh per test
}
```

Replace the `vi_resetModules` placeholder calls with real `vi.resetModules()` calls and add `import { vi } from 'vitest'` to the top import — the snippet above is written to make the intent explicit; the real file must call `vi.resetModules()` directly (see step 3's implementation note).

- [ ] **Step 6: Run test to verify it fails**

Run: `cd server && npx vitest run tests/unit/env.test.ts`
Expected: FAIL — `src/config/env.ts` does not exist yet.

- [ ] **Step 7: Implement `server/src/config/env.ts`**

```typescript
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_PURPOSE_SECRET: z.string().min(16, 'JWT_PURPOSE_SECRET must be at least 16 characters'),
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  EMAIL_FROM: z.string().min(1, 'EMAIL_FROM is required'),
  CLIENT_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().optional(),
});

export const env = envSchema.parse(process.env);
export type Env = typeof env;
```

Fix the test file's `vi_resetModules` calls to real `vi.resetModules()`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// ...replace every `vi_resetModules();` call with `vi.resetModules();`
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd server && npx vitest run tests/unit/env.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 9: Implement `server/src/config/database.ts`**

```typescript
import mongoose from 'mongoose';

export async function connectDB(uri: string): Promise<void> {
  await mongoose.connect(uri);
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
```

- [ ] **Step 10: Create the in-memory Mongo test helper**

`server/tests/helpers/testDb.ts`:

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer | undefined;

export async function startTestDb(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  await mongod?.stop();
}

export async function clearTestDb(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key]!.deleteMany({});
  }
}
```

- [ ] **Step 11: Write the failing health-check integration test**

`server/tests/integration/health.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startTestDb, stopTestDb } from '../helpers/testDb';
import app from '../../src/app';

describe('GET /api/v1/health', () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  it('returns status ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 12: Run test to verify it fails**

Run: `cd server && npx vitest run tests/integration/health.test.ts`
Expected: FAIL — `src/app.ts` does not exist yet.

- [ ] **Step 13: Implement `server/src/app.ts`**

```typescript
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import apiV1Router from './routes';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/v1', apiV1Router);

app.use(errorHandler);

export default app;
```

This references `./middleware/errorHandler` and `./routes` which don't exist yet — create minimal stand-ins now so `app.ts` compiles; Tasks 5–10 will flesh them out.

`server/src/utils/AppError.ts`:

```typescript
export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}
```

`server/src/middleware/errorHandler.ts`:

```typescript
import { ErrorRequestHandler } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof AppError ? err.message : 'Internal server error';

  res.status(statusCode).json({
    error: message,
    ...(env.NODE_ENV !== 'production' && !(err instanceof AppError) ? { stack: err.stack } : {}),
  });
};
```

`server/src/routes/index.ts` (minimal for now):

```typescript
import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default router;
```

- [ ] **Step 14: Run test to verify it passes**

Run: `cd server && npx vitest run tests/integration/health.test.ts`
Expected: PASS

- [ ] **Step 15: Implement `server/src/index.ts`**

```typescript
import { env } from './config/env';
import { connectDB } from './config/database';
import app from './app';

async function main(): Promise<void> {
  await connectDB(env.MONGODB_URI);
  app.listen(env.PORT, () => {
    console.log(`NearMe server listening on port ${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
```

- [ ] **Step 16: Create a global test env setup file and wire it into `server/vitest.config.ts`**

Every integration test imports `src/app.ts`, which imports `src/config/env.ts`, which validates `process.env` at module-load time. Without required variables already present before that import happens, every integration test would fail on a startup error rather than a real assertion. Set them once, globally, before any test file runs:

`server/tests/setup.ts`:

```typescript
process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.MONGODB_URI = 'mongodb://localhost:27017/nearme-test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-aaaaaaaaaaaaaaaa';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-bbbbbbbbbbbbbb';
process.env.JWT_PURPOSE_SECRET = 'test-purpose-secret-cccccccccccccc';
process.env.RESEND_API_KEY = 'test-resend-key';
process.env.EMAIL_FROM = 'NearMe <no-reply@test.dev>';
process.env.CLIENT_URL = 'http://localhost:5173';
delete process.env.GOOGLE_CLIENT_ID;
```

`server/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 20000,
    setupFiles: ['./tests/setup.ts'],
  },
});
```

Note: `tests/unit/env.test.ts` (Step 5 of this task) still works correctly alongside this global setup — it saves/restores `process.env` itself in its own `beforeEach`/`afterEach` and calls `vi.resetModules()` before each dynamic import, so it observes its own deliberately-mutated environment rather than the globally-seeded one.

- [ ] **Step 17: Run the full server test suite**

Run: `cd server && npm test`
Expected: PASS (all tests in `tests/unit/env.test.ts` and `tests/integration/health.test.ts`)

- [ ] **Step 18: Commit**

```bash
git add docker-compose.yml server/
git commit -m "feat(server): scaffold Express+TS server with env validation and health check"
```

---

### Task 2: `User` and `UserSession` Mongoose models

**Files:**
- Create: `server/src/models/User.ts`
- Create: `server/src/models/UserSession.ts`
- Test: `server/tests/unit/User.model.test.ts`
- Test: `server/tests/unit/UserSession.model.test.ts`

**Interfaces:**
- Consumes: `startTestDb`, `stopTestDb`, `clearTestDb` from `../helpers/testDb` (Task 1)
- Produces: `IUser` interface and `User` model (default export) from `models/User.ts`, fields: `username: string`, `displayName: string`, `email: string`, `passwordHash: string | null`, `avatarUrl: string`, `bio?: string`, `gender?: 'male'|'female'|'non-binary'|'prefer-not-to-say'`, `age?: number`, `country?: string`, `city?: string`, `interests: string[]`, `languages: string[]`, `lastSeenAt: Date`, `theme: 'light'|'dark'|'system'`, `privacy: { hideOnlineStatus: boolean; hideDistance: boolean; hideProfile: boolean; invisibleMode: boolean; privateAccount: boolean }`, `emailVerifiedAt: Date | null`, `googleId?: string`, `role: 'user'|'admin'`, `status: 'active'|'suspended'|'banned'`, `createdAt: Date`

Note: `theme` lives on the User document (not just client `localStorage`) so a signed-in user's theme choice is consistent across devices — the client also caches it locally for instant, network-independent switching (see Task 13).
- Produces: `IUserSession` interface and `UserSession` model (default export) from `models/UserSession.ts`, fields: `userId: Types.ObjectId`, `refreshTokenHash: string`, `userAgent: string`, `ipAddress: string`, `createdAt: Date`, `expiresAt: Date`, `revokedAt: Date | null`

- [ ] **Step 1: Write the failing test for `User` model**

`server/tests/unit/User.model.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';
import User from '../../src/models/User';

describe('User model', () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  it('creates a user with defaults applied', async () => {
    const user = await User.create({
      username: 'alice',
      displayName: 'Alice',
      email: 'alice@example.com',
      passwordHash: 'hashed',
      avatarUrl: 'https://example.com/default-avatar.png',
    });

    expect(user.interests).toEqual([]);
    expect(user.languages).toEqual([]);
    expect(user.privacy.hideOnlineStatus).toBe(false);
    expect(user.privacy.invisibleMode).toBe(false);
    expect(user.theme).toBe('system');
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.role).toBe('user');
    expect(user.status).toBe('active');
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('rejects a second user with a duplicate email', async () => {
    await User.create({
      username: 'bob',
      displayName: 'Bob',
      email: 'dup@example.com',
      passwordHash: 'hashed',
      avatarUrl: 'https://example.com/default-avatar.png',
    });

    await expect(
      User.create({
        username: 'bob2',
        displayName: 'Bob Two',
        email: 'dup@example.com',
        passwordHash: 'hashed',
        avatarUrl: 'https://example.com/default-avatar.png',
      })
    ).rejects.toThrow();
  });

  it('rejects a second user with a duplicate username', async () => {
    await User.create({
      username: 'carol',
      displayName: 'Carol',
      email: 'carol@example.com',
      passwordHash: 'hashed',
      avatarUrl: 'https://example.com/default-avatar.png',
    });

    await expect(
      User.create({
        username: 'carol',
        displayName: 'Carol Two',
        email: 'carol2@example.com',
        passwordHash: 'hashed',
        avatarUrl: 'https://example.com/default-avatar.png',
      })
    ).rejects.toThrow();
  });

  it('requires username, displayName, email, and avatarUrl', async () => {
    await expect(User.create({})).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/unit/User.model.test.ts`
Expected: FAIL — `src/models/User.ts` does not exist yet.

- [ ] **Step 3: Implement `server/src/models/User.ts`**

```typescript
import { Schema, model, Document } from 'mongoose';

export type Gender = 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'suspended' | 'banned';

export interface IPrivacySettings {
  hideOnlineStatus: boolean;
  hideDistance: boolean;
  hideProfile: boolean;
  invisibleMode: boolean;
  privateAccount: boolean;
}

export interface IUser extends Document {
  username: string;
  displayName: string;
  email: string;
  passwordHash: string | null;
  avatarUrl: string;
  bio?: string;
  gender?: Gender;
  age?: number;
  country?: string;
  city?: string;
  interests: string[];
  languages: string[];
  lastSeenAt: Date;
  theme: 'light' | 'dark' | 'system';
  privacy: IPrivacySettings;
  emailVerifiedAt: Date | null;
  googleId?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
}

const privacySchema = new Schema<IPrivacySettings>(
  {
    hideOnlineStatus: { type: Boolean, default: false },
    hideDistance: { type: Boolean, default: false },
    hideProfile: { type: Boolean, default: false },
    invisibleMode: { type: Boolean, default: false },
    privateAccount: { type: Boolean, default: false },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true, trim: true },
  displayName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, default: null },
  avatarUrl: { type: String, required: true },
  bio: { type: String },
  gender: { type: String, enum: ['male', 'female', 'non-binary', 'prefer-not-to-say'] },
  age: { type: Number },
  country: { type: String },
  city: { type: String },
  interests: { type: [String], default: [] },
  languages: { type: [String], default: [] },
  lastSeenAt: { type: Date, default: () => new Date() },
  theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
  privacy: { type: privacySchema, default: () => ({}) },
  emailVerifiedAt: { type: Date, default: null },
  googleId: { type: String },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  status: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active' },
  createdAt: { type: Date, default: () => new Date() },
});

export default model<IUser>('User', userSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/unit/User.model.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the failing test for `UserSession` model**

`server/tests/unit/UserSession.model.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';
import UserSession from '../../src/models/UserSession';

describe('UserSession model', () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  it('creates a session with revokedAt defaulting to null', async () => {
    const session = await UserSession.create({
      userId: new Types.ObjectId(),
      refreshTokenHash: 'hashed-token',
      userAgent: 'vitest',
      ipAddress: '127.0.0.1',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    });

    expect(session.revokedAt).toBeNull();
    expect(session.createdAt).toBeInstanceOf(Date);
  });

  it('requires userId, refreshTokenHash, and expiresAt', async () => {
    await expect(UserSession.create({})).rejects.toThrow();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd server && npx vitest run tests/unit/UserSession.model.test.ts`
Expected: FAIL — `src/models/UserSession.ts` does not exist yet.

- [ ] **Step 7: Implement `server/src/models/UserSession.ts`**

```typescript
import { Schema, model, Document, Types } from 'mongoose';

export interface IUserSession extends Document {
  userId: Types.ObjectId;
  refreshTokenHash: string;
  userAgent: string;
  ipAddress: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

const userSessionSchema = new Schema<IUserSession>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  refreshTokenHash: { type: String, required: true },
  userAgent: { type: String, default: '' },
  ipAddress: { type: String, default: '' },
  createdAt: { type: Date, default: () => new Date() },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
});

export default model<IUserSession>('UserSession', userSessionSchema);
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd server && npx vitest run tests/unit/UserSession.model.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 9: Run the full server test suite**

Run: `cd server && npm test`
Expected: PASS (all tests so far)

- [ ] **Step 10: Commit**

```bash
git add server/src/models server/tests/unit/User.model.test.ts server/tests/unit/UserSession.model.test.ts
git commit -m "feat(server): add User and UserSession Mongoose models"
```

---

### Task 3: Password and token services

**Files:**
- Create: `server/src/services/passwordService.ts`
- Create: `server/src/services/tokenService.ts`
- Test: `server/tests/unit/passwordService.test.ts`
- Test: `server/tests/unit/tokenService.test.ts`

**Interfaces:**
- Consumes: `env` from `../config/env` (Task 1)
- Produces from `passwordService.ts`: `hashPassword(plain: string): Promise<string>`, `comparePassword(plain: string, hash: string): Promise<boolean>`
- Produces from `tokenService.ts`:
  - `signAccessToken(userId: string): string`
  - `verifyAccessToken(token: string): { sub: string }` (throws `AppError(401, ...)` on invalid/expired)
  - `generateRefreshToken(): string` (opaque random token)
  - `hashRefreshToken(token: string): string` (SHA-256 hex digest)
  - `signPurposeToken(userId: string, purpose: 'email-verify' | 'password-reset'): string`
  - `verifyPurposeToken(token: string, purpose: 'email-verify' | 'password-reset'): { sub: string }` (throws `AppError(400, ...)` on invalid/expired/wrong-purpose)

- [ ] **Step 1: Write the failing test for `passwordService`**

`server/tests/unit/passwordService.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from '../../src/services/passwordService';

describe('passwordService', () => {
  it('hashes a password to something other than the plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toBe('correct horse battery staple');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('confirms a matching password against its hash', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(comparePassword('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects a non-matching password against a hash', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(comparePassword('wrong password', hash)).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/unit/passwordService.test.ts`
Expected: FAIL — `src/services/passwordService.ts` does not exist yet.

- [ ] **Step 3: Implement `server/src/services/passwordService.ts`**

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/unit/passwordService.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing test for `tokenService`**

`server/tests/unit/tokenService.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  signPurposeToken,
  verifyPurposeToken,
} from '../../src/services/tokenService';
import { AppError } from '../../src/utils/AppError';

describe('tokenService', () => {
  it('signs and verifies an access token round-trip', () => {
    const token = signAccessToken('user-123');
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('user-123');
  });

  it('throws AppError for a malformed access token', () => {
    expect(() => verifyAccessToken('not-a-real-token')).toThrow(AppError);
  });

  it('generates a refresh token that is a non-empty hex string', () => {
    const token = generateRefreshToken();
    expect(token).toMatch(/^[a-f0-9]+$/);
    expect(token.length).toBeGreaterThanOrEqual(40);
  });

  it('hashes a refresh token deterministically', () => {
    const token = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(hashRefreshToken(token)).not.toBe(token);
  });

  it('signs and verifies a purpose token round-trip for the correct purpose', () => {
    const token = signPurposeToken('user-123', 'email-verify');
    const payload = verifyPurposeToken(token, 'email-verify');
    expect(payload.sub).toBe('user-123');
  });

  it('rejects a purpose token verified against the wrong purpose', () => {
    const token = signPurposeToken('user-123', 'email-verify');
    expect(() => verifyPurposeToken(token, 'password-reset')).toThrow(AppError);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd server && npx vitest run tests/unit/tokenService.test.ts`
Expected: FAIL — `src/services/tokenService.ts` does not exist yet.

- [ ] **Step 7: Implement `server/src/services/tokenService.ts`**

```typescript
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

const ACCESS_TOKEN_TTL = '15m';
const PURPOSE_TOKEN_TTL = '30m';

export type PurposeTokenKind = 'email-verify' | 'password-reset';

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): { sub: string } {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string };
    return { sub: payload.sub };
  } catch {
    throw new AppError(401, 'Invalid or expired access token');
  }
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signPurposeToken(userId: string, purpose: PurposeTokenKind): string {
  return jwt.sign({ sub: userId, purpose }, env.JWT_PURPOSE_SECRET, {
    expiresIn: PURPOSE_TOKEN_TTL,
  });
}

export function verifyPurposeToken(token: string, purpose: PurposeTokenKind): { sub: string } {
  try {
    const payload = jwt.verify(token, env.JWT_PURPOSE_SECRET) as {
      sub: string;
      purpose: PurposeTokenKind;
    };
    if (payload.purpose !== purpose) {
      throw new Error('purpose mismatch');
    }
    return { sub: payload.sub };
  } catch {
    throw new AppError(400, 'Invalid or expired token');
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd server && npx vitest run tests/unit/tokenService.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 9: Run the full server test suite**

Run: `cd server && npm test`
Expected: PASS (all tests so far)

- [ ] **Step 10: Commit**

```bash
git add server/src/services server/tests/unit/passwordService.test.ts server/tests/unit/tokenService.test.ts
git commit -m "feat(server): add password and token services"
```

---

### Task 4: Email service (Resend wrapper)

**Files:**
- Create: `server/src/services/emailService.ts`
- Test: `server/tests/unit/emailService.test.ts`

**Interfaces:**
- Consumes: `env` from `../config/env` (Task 1)
- Produces: `sendVerificationEmail(to: string, token: string): Promise<void>`, `sendPasswordResetEmail(to: string, token: string): Promise<void>` — both build a link as `` `${env.CLIENT_URL}/verify-email?token=${token}` `` / `` `${env.CLIENT_URL}/reset-password?token=${token}` ``

- [ ] **Step 1: Write the failing test, mocking the Resend SDK**

`server/tests/unit/emailService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMock = vi.fn().mockResolvedValue({ data: { id: 'email-id' }, error: null });

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

describe('emailService', () => {
  beforeEach(() => {
    sendMock.mockClear();
  });

  it('sends a verification email with a link containing the token', async () => {
    const { sendVerificationEmail } = await import('../../src/services/emailService');
    await sendVerificationEmail('alice@example.com', 'tok123');

    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0]![0];
    expect(call.to).toBe('alice@example.com');
    expect(call.html).toContain('tok123');
    expect(call.html).toContain('verify-email');
  });

  it('sends a password reset email with a link containing the token', async () => {
    const { sendPasswordResetEmail } = await import('../../src/services/emailService');
    await sendPasswordResetEmail('bob@example.com', 'tok456');

    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0]![0];
    expect(call.to).toBe('bob@example.com');
    expect(call.html).toContain('tok456');
    expect(call.html).toContain('reset-password');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/unit/emailService.test.ts`
Expected: FAIL — `src/services/emailService.ts` does not exist yet.

- [ ] **Step 3: Implement `server/src/services/emailService.ts`**

```typescript
import { Resend } from 'resend';
import { env } from '../config/env';

const resend = new Resend(env.RESEND_API_KEY);

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const link = `${env.CLIENT_URL}/verify-email?token=${token}`;
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'Verify your NearMe email',
    html: `<p>Welcome to NearMe! Confirm your email address:</p><p><a href="${link}">${link}</a></p>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${env.CLIENT_URL}/reset-password?token=${token}`;
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'Reset your NearMe password',
    html: `<p>Reset your password using this link (expires in 30 minutes):</p><p><a href="${link}">${link}</a></p>`,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/unit/emailService.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/services/emailService.ts server/tests/unit/emailService.test.ts
git commit -m "feat(server): add Resend email service for verification and reset emails"
```

---

### Task 5: Shared middleware, validators, and utils (validate, authenticate, rate limiters, toPublicUser)

**Files:**
- Create: `server/src/utils/asyncHandler.ts`
- Create: `server/src/utils/toPublicUser.ts`
- Create: `server/src/utils/sanitize.ts`
- Create: `server/src/middleware/validate.ts`
- Create: `server/src/middleware/authenticate.ts`
- Create: `server/src/middleware/rateLimiters.ts`
- Create: `server/src/types/express.d.ts`
- Create: `server/src/validators/authValidators.ts`
- Create: `server/src/validators/userValidators.ts`
- Test: `server/tests/unit/validate.test.ts`
- Test: `server/tests/unit/authenticate.test.ts`
- Test: `server/tests/unit/toPublicUser.test.ts`
- Test: `server/tests/unit/sanitize.test.ts`

**Interfaces:**
- Consumes: `verifyAccessToken` from `../services/tokenService` (Task 3), `AppError` from `../utils/AppError` (Task 1), `IUser` from `../models/User` (Task 2)
- Produces: `sanitizeText(input: string): string` from `utils/sanitize.ts` — strips all HTML tags/attributes and trims whitespace; applied to every free-text field a user can set (`displayName`, `bio`) via a Zod `.transform()` in `registerSchema` and `updateProfileSchema` below, so stored values can never contain markup
- Produces: `asyncHandler(fn: (req, res, next) => Promise<unknown>): RequestHandler` from `utils/asyncHandler.ts`
- Produces: `toPublicUser(user: IUser): PublicUser` from `utils/toPublicUser.ts`, where `PublicUser` is `{ id: string; username: string; displayName: string; email: string; avatarUrl: string; bio?: string; gender?: string; age?: number; country?: string; city?: string; interests: string[]; languages: string[]; role: string; status: string; theme: string; emailVerifiedAt: string | null; createdAt: string; privacy: IPrivacySettings }` (excludes `passwordHash` and `googleId`)
- Produces: `validate(schema: ZodSchema): RequestHandler` from `middleware/validate.ts` — parses `req.body`, replaces it with the parsed value, calls `next(new AppError(400, message))` on failure
- Produces: `authenticate: RequestHandler` from `middleware/authenticate.ts` — reads `Authorization: Bearer <token>`, on success sets `req.userId = payload.sub` and calls `next()`, on failure calls `next(new AppError(401, ...))`
- Produces: `authRateLimiter: RequestHandler` (express-rate-limit instance) from `middleware/rateLimiters.ts`
- Produces (types): `server/src/types/express.d.ts` augments `Express.Request` with `userId?: string`
- Produces: `registerSchema`, `loginSchema`, `forgotPasswordSchema`, `resetPasswordSchema` (Zod schemas) from `validators/authValidators.ts`
- Produces: `updateProfileSchema`, `changePasswordSchema`, `updateSettingsSchema` (Zod schemas) from `validators/userValidators.ts`

- [ ] **Step 1: Create `server/src/types/express.d.ts` (no test — type-only augmentation, verified by later tasks compiling)**

```typescript
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {};
```

- [ ] **Step 2: Implement `server/src/utils/asyncHandler.ts` (no test — trivial wrapper, exercised by every integration test in later tasks)**

```typescript
import { Request, Response, NextFunction, RequestHandler } from 'express';

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
```

- [ ] **Step 3: Write the failing test for `toPublicUser`**

`server/tests/unit/toPublicUser.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';
import User from '../../src/models/User';
import { toPublicUser } from '../../src/utils/toPublicUser';

describe('toPublicUser', () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  it('excludes passwordHash and googleId', async () => {
    const user = await User.create({
      username: 'dave',
      displayName: 'Dave',
      email: 'dave@example.com',
      passwordHash: 'super-secret-hash',
      avatarUrl: 'https://example.com/default-avatar.png',
      googleId: 'google-123',
    });

    const publicUser = toPublicUser(user);

    expect(publicUser).not.toHaveProperty('passwordHash');
    expect(publicUser).not.toHaveProperty('googleId');
    expect(publicUser.id).toBe(user.id);
    expect(publicUser.username).toBe('dave');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd server && npx vitest run tests/unit/toPublicUser.test.ts`
Expected: FAIL — `src/utils/toPublicUser.ts` does not exist yet.

- [ ] **Step 5: Implement `server/src/utils/toPublicUser.ts`**

```typescript
import { IUser, IPrivacySettings } from '../models/User';

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  bio?: string;
  gender?: string;
  age?: number;
  country?: string;
  city?: string;
  interests: string[];
  languages: string[];
  role: string;
  status: string;
  theme: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  privacy: IPrivacySettings;
}

export function toPublicUser(user: IUser): PublicUser {
  return {
    id: user.id as string,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    gender: user.gender,
    age: user.age,
    country: user.country,
    city: user.city,
    interests: user.interests,
    languages: user.languages,
    role: user.role,
    status: user.status,
    theme: user.theme,
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    privacy: user.privacy,
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd server && npx vitest run tests/unit/toPublicUser.test.ts`
Expected: PASS

- [ ] **Step 7: Install `sanitize-html` and write the failing test for `sanitizeText`**

```bash
cd server && npm install sanitize-html && npm install -D @types/sanitize-html
```

`server/tests/unit/sanitize.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { sanitizeText } from '../../src/utils/sanitize';

describe('sanitizeText', () => {
  it('strips HTML tags from the input', () => {
    expect(sanitizeText('<script>alert(1)</script>Hello')).toBe('Hello');
  });

  it('strips tags but keeps their inner text', () => {
    expect(sanitizeText('<b>Bold</b> and <i>italic</i>')).toBe('Bold and italic');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeText('  plain text  ')).toBe('plain text');
  });

  it('leaves plain text without markup unchanged', () => {
    expect(sanitizeText('Just a normal bio')).toBe('Just a normal bio');
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `cd server && npx vitest run tests/unit/sanitize.test.ts`
Expected: FAIL — `src/utils/sanitize.ts` does not exist yet.

- [ ] **Step 9: Implement `server/src/utils/sanitize.ts`**

```typescript
import sanitizeHtml from 'sanitize-html';

export function sanitizeText(input: string): string {
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `cd server && npx vitest run tests/unit/sanitize.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 11: Write the failing test for `validate` middleware**

`server/tests/unit/validate.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { validate } from '../../src/middleware/validate';
import { AppError } from '../../src/utils/AppError';

function mockReqResNext(body: unknown) {
  const req = { body } as any;
  const res = {} as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('validate middleware', () => {
  const schema = z.object({ email: z.string().email() });

  it('calls next() with no error and replaces req.body with the parsed value on success', () => {
    const { req, res, next } = mockReqResNext({ email: 'a@b.com', extra: 'ignored' });
    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ email: 'a@b.com' });
  });

  it('calls next() with an AppError(400) on validation failure', () => {
    const { req, res, next } = mockReqResNext({ email: 'not-an-email' });
    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]![0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
  });
});
```

- [ ] **Step 12: Run test to verify it fails**

Run: `cd server && npx vitest run tests/unit/validate.test.ts`
Expected: FAIL — `src/middleware/validate.ts` does not exist yet.

- [ ] **Step 13: Implement `server/src/middleware/validate.ts`**

```typescript
import { RequestHandler } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/AppError';

export function validate(schema: ZodSchema): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new AppError(400, result.error.issues.map((i) => i.message).join(', ')));
      return;
    }
    req.body = result.data;
    next();
  };
}
```

- [ ] **Step 14: Run test to verify it passes**

Run: `cd server && npx vitest run tests/unit/validate.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 15: Write the failing test for `authenticate` middleware**

`server/tests/unit/authenticate.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { authenticate } from '../../src/middleware/authenticate';
import { signAccessToken } from '../../src/services/tokenService';
import { AppError } from '../../src/utils/AppError';

function mockReqResNext(authHeader: string | undefined) {
  const req = { headers: { authorization: authHeader } } as any;
  const res = {} as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('authenticate middleware', () => {
  it('sets req.userId and calls next() with a valid bearer token', () => {
    const token = signAccessToken('user-abc');
    const { req, res, next } = mockReqResNext(`Bearer ${token}`);

    authenticate(req, res, next);

    expect(req.userId).toBe('user-abc');
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next() with AppError(401) when the header is missing', () => {
    const { req, res, next } = mockReqResNext(undefined);

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]![0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
  });

  it('calls next() with AppError(401) for an invalid token', () => {
    const { req, res, next } = mockReqResNext('Bearer garbage');

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]![0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
  });
});
```

- [ ] **Step 16: Run test to verify it fails**

Run: `cd server && npx vitest run tests/unit/authenticate.test.ts`
Expected: FAIL — `src/middleware/authenticate.ts` does not exist yet.

- [ ] **Step 17: Implement `server/src/middleware/authenticate.ts`**

```typescript
import { RequestHandler } from 'express';
import { verifyAccessToken } from '../services/tokenService';
import { AppError } from '../utils/AppError';

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new AppError(401, 'Missing or malformed Authorization header'));
    return;
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    next();
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 18: Run test to verify it passes**

Run: `cd server && npx vitest run tests/unit/authenticate.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 19: Implement `server/src/middleware/rateLimiters.ts` (no isolated test — exercised via integration tests in Task 6/7/8)**

```typescript
import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
```

- [ ] **Step 20: Implement `server/src/validators/authValidators.ts` (no isolated test — exercised via integration tests in Task 6/7/8)**

```typescript
import { z } from 'zod';
import { sanitizeText } from '../utils/sanitize';

export const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores allowed'),
  displayName: z.string().min(1).max(50).transform(sanitizeText),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const googleLoginSchema = z.object({
  idToken: z.string().min(1),
});
```

- [ ] **Step 21: Implement `server/src/validators/userValidators.ts` (no isolated test — exercised via integration tests in Task 10)**

```typescript
import { z } from 'zod';
import { sanitizeText } from '../utils/sanitize';

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).transform(sanitizeText).optional(),
  bio: z.string().max(300).transform(sanitizeText).optional(),
  gender: z.enum(['male', 'female', 'non-binary', 'prefer-not-to-say']).optional(),
  age: z.number().int().min(13).max(120).optional(),
  country: z.string().max(60).optional(),
  city: z.string().max(60).optional(),
  interests: z.array(z.string().max(30)).max(20).optional(),
  languages: z.array(z.string().max(30)).max(10).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const updateSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  privacy: z
    .object({
      hideOnlineStatus: z.boolean().optional(),
      hideDistance: z.boolean().optional(),
      hideProfile: z.boolean().optional(),
      invisibleMode: z.boolean().optional(),
      privateAccount: z.boolean().optional(),
    })
    .partial()
    .optional(),
});
```

- [ ] **Step 22: Run the full server test suite**

Run: `cd server && npm test`
Expected: PASS (all tests so far)

- [ ] **Step 23: Commit**

```bash
git add server/src/utils server/src/middleware server/src/validators server/src/types server/tests/unit/validate.test.ts server/tests/unit/authenticate.test.ts server/tests/unit/toPublicUser.test.ts server/tests/unit/sanitize.test.ts server/package.json server/package-lock.json
git commit -m "feat(server): add shared middleware, validators, sanitization, and DTO mapping"
```

---

### Task 6: Register + Verify Email endpoints

**Files:**
- Create: `server/src/controllers/authController.ts` (register + verifyEmail handlers only — Tasks 7–9 add more to this file)
- Create: `server/src/routes/authRoutes.ts` (register + verify-email routes only — Tasks 7–9 add more)
- Modify: `server/src/routes/index.ts` (mount `authRoutes` under `/auth`)
- Test: `server/tests/integration/auth.register.test.ts`

**Interfaces:**
- Consumes: `hashPassword` (Task 3), `signPurposeToken`, `verifyPurposeToken` (Task 3), `sendVerificationEmail` (Task 4), `User` model (Task 2), `toPublicUser` (Task 5), `validate`, `asyncHandler`, `AppError`, `authRateLimiter`, `registerSchema`, `verifyEmailSchema` (Tasks 1/5)
- Produces: `register: RequestHandler`, `verifyEmail: RequestHandler` (exported from `authController.ts`; this file grows in Tasks 7–9, so these are named exports, not a default export)
- Produces: default-exported `Router` from `authRoutes.ts` with `POST /register` and `POST /verify-email` (Tasks 7–9 add more routes to the same router)

- [ ] **Step 1: Write the failing integration test for register + verify-email**

`server/tests/integration/auth.register.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';

vi.mock('../../src/services/emailService', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('POST /api/v1/auth/register + /api/v1/auth/verify-email', () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  it('registers a new user and does not return a passwordHash', async () => {
    const app = (await import('../../src/app')).default;

    const res = await request(app).post('/api/v1/auth/register').send({
      username: 'erin',
      displayName: 'Erin',
      email: 'erin@example.com',
      password: 'supersecret123',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe('erin');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.user.emailVerifiedAt).toBeNull();
  });

  it('rejects registration with a duplicate email with 409', async () => {
    const app = (await import('../../src/app')).default;

    await request(app).post('/api/v1/auth/register').send({
      username: 'frank',
      displayName: 'Frank',
      email: 'dup@example.com',
      password: 'supersecret123',
    });

    const res = await request(app).post('/api/v1/auth/register').send({
      username: 'frank2',
      displayName: 'Frank Two',
      email: 'dup@example.com',
      password: 'supersecret123',
    });

    expect(res.status).toBe(409);
  });

  it('rejects registration with an invalid body with 400', async () => {
    const app = (await import('../../src/app')).default;

    const res = await request(app).post('/api/v1/auth/register').send({
      username: 'a',
      email: 'not-an-email',
      password: '123',
    });

    expect(res.status).toBe(400);
  });

  it('verifies an email with a valid token and sets emailVerifiedAt', async () => {
    const app = (await import('../../src/app')).default;
    const { signPurposeToken } = await import('../../src/services/tokenService');
    const User = (await import('../../src/models/User')).default;

    const user = await User.create({
      username: 'grace',
      displayName: 'Grace',
      email: 'grace@example.com',
      passwordHash: 'irrelevant-for-this-test',
      avatarUrl: 'https://example.com/default-avatar.png',
    });

    const token = signPurposeToken(user.id, 'email-verify');
    const res = await request(app).post('/api/v1/auth/verify-email').send({ token });

    expect(res.status).toBe(200);
    expect(res.body.user.emailVerifiedAt).not.toBeNull();
  });

  it('rejects verify-email with an invalid token with 400', async () => {
    const app = (await import('../../src/app')).default;

    const res = await request(app).post('/api/v1/auth/verify-email').send({ token: 'garbage' });

    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/integration/auth.register.test.ts`
Expected: FAIL — `src/controllers/authController.ts` and `src/routes/authRoutes.ts` do not exist yet, and `/auth` is not mounted.

- [ ] **Step 3: Implement `server/src/controllers/authController.ts`**

```typescript
import { RequestHandler } from 'express';
import User from '../models/User';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { toPublicUser } from '../utils/toPublicUser';
import { hashPassword } from '../services/passwordService';
import { signPurposeToken, verifyPurposeToken } from '../services/tokenService';
import { sendVerificationEmail } from '../services/emailService';

const DEFAULT_AVATAR_URL = 'https://api.dicebear.com/9.x/initials/svg';

export const register: RequestHandler = asyncHandler(async (req, res) => {
  const { username, displayName, email, password } = req.body as {
    username: string;
    displayName: string;
    email: string;
    password: string;
  };

  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) {
    throw new AppError(409, 'A user with that email or username already exists');
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({
    username,
    displayName,
    email,
    passwordHash,
    avatarUrl: `${DEFAULT_AVATAR_URL}?seed=${encodeURIComponent(username)}`,
  });

  const verifyToken = signPurposeToken(user.id, 'email-verify');
  await sendVerificationEmail(user.email, verifyToken);

  res.status(201).json({ user: toPublicUser(user) });
});

export const verifyEmail: RequestHandler = asyncHandler(async (req, res) => {
  const { token } = req.body as { token: string };

  const { sub } = verifyPurposeToken(token, 'email-verify');
  const user = await User.findById(sub);
  if (!user) {
    throw new AppError(404, 'User not found');
  }

  user.emailVerifiedAt = new Date();
  await user.save();

  res.status(200).json({ user: toPublicUser(user) });
});
```

- [ ] **Step 4: Implement `server/src/routes/authRoutes.ts`**

```typescript
import { Router } from 'express';
import { validate } from '../middleware/validate';
import { authRateLimiter } from '../middleware/rateLimiters';
import { registerSchema, verifyEmailSchema } from '../validators/authValidators';
import { register, verifyEmail } from '../controllers/authController';

const router = Router();

router.post('/register', authRateLimiter, validate(registerSchema), register);
router.post('/verify-email', validate(verifyEmailSchema), verifyEmail);

export default router;
```

- [ ] **Step 5: Update `server/src/routes/index.ts` to mount `authRoutes`**

```typescript
import { Router } from 'express';
import authRoutes from './authRoutes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.use('/auth', authRoutes);

export default router;
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd server && npx vitest run tests/integration/auth.register.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 7: Run the full server test suite**

Run: `cd server && npm test`
Expected: PASS (all tests so far)

- [ ] **Step 8: Commit**

```bash
git add server/src/controllers/authController.ts server/src/routes/authRoutes.ts server/src/routes/index.ts server/tests/integration/auth.register.test.ts
git commit -m "feat(server): add register and verify-email endpoints"
```

---

### Task 7: Login + Refresh + Logout endpoints

**Files:**
- Modify: `server/src/controllers/authController.ts` (add `login`, `refresh`, `logout`)
- Modify: `server/src/routes/authRoutes.ts` (add `POST /login`, `POST /refresh`, `POST /logout`)
- Create: `server/src/utils/cookies.ts`
- Test: `server/tests/integration/auth.login.test.ts`
- Test: `server/tests/integration/auth.refresh-logout.test.ts`

**Interfaces:**
- Consumes: `comparePassword` (Task 3), `generateRefreshToken`, `hashRefreshToken`, `signAccessToken` (Task 3), `UserSession` model (Task 2), `loginSchema` (Task 5)
- Produces: `login: RequestHandler`, `refresh: RequestHandler`, `logout: RequestHandler` added to `authController.ts`
- Produces: `REFRESH_COOKIE_NAME = 'refreshToken'`, `setRefreshCookie(res, token, rememberMe): void`, `clearRefreshCookie(res): void` from `utils/cookies.ts`

- [ ] **Step 1: Implement `server/src/utils/cookies.ts` (no isolated test — exercised via login/refresh/logout integration tests)**

```typescript
import { Response } from 'express';
import { env } from '../config/env';

export const REFRESH_COOKIE_NAME = 'refreshToken';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function setRefreshCookie(res: Response, token: string, rememberMe: boolean): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    ...(rememberMe ? { maxAge: SEVEN_DAYS_MS } : {}),
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
}
```

- [ ] **Step 2: Write the failing integration test for login**

`server/tests/integration/auth.login.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';

vi.mock('../../src/services/emailService', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('POST /api/v1/auth/login', () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  async function registerUser(app: import('express').Express) {
    await request(app).post('/api/v1/auth/register').send({
      username: 'henry',
      displayName: 'Henry',
      email: 'henry@example.com',
      password: 'supersecret123',
    });
  }

  it('logs in with correct credentials and sets a refresh cookie', async () => {
    const app = (await import('../../src/app')).default;
    await registerUser(app);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'henry@example.com', password: 'supersecret123', rememberMe: true });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('henry@example.com');
    const setCookie = res.headers['set-cookie'];
    expect(setCookie.some((c: string) => c.startsWith('refreshToken='))).toBe(true);
  });

  it('rejects an incorrect password with 401', async () => {
    const app = (await import('../../src/app')).default;
    await registerUser(app);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'henry@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('rejects a non-existent email with 401', async () => {
    const app = (await import('../../src/app')).default;

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever123' });

    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && npx vitest run tests/integration/auth.login.test.ts`
Expected: FAIL — `login` route does not exist yet.

- [ ] **Step 4: Add `login` to `server/src/controllers/authController.ts`**

```typescript
import UserSession from '../models/UserSession';
import { comparePassword } from '../services/passwordService';
import { generateRefreshToken, hashRefreshToken, signAccessToken } from '../services/tokenService';
import { setRefreshCookie, clearRefreshCookie } from '../utils/cookies';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const login: RequestHandler = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body as {
    email: string;
    password: string;
    rememberMe: boolean;
  };

  const user = await User.findOne({ email });
  if (!user || !user.passwordHash) {
    throw new AppError(401, 'Invalid email or password');
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError(401, 'Invalid email or password');
  }

  if (user.status !== 'active') {
    throw new AppError(403, 'This account is not active');
  }

  const accessToken = signAccessToken(user.id);
  const rawRefreshToken = generateRefreshToken();

  await UserSession.create({
    userId: user._id,
    refreshTokenHash: hashRefreshToken(rawRefreshToken),
    userAgent: req.headers['user-agent'] ?? '',
    ipAddress: req.ip ?? '',
    expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
  });

  setRefreshCookie(res, rawRefreshToken, rememberMe);
  user.lastSeenAt = new Date();
  await user.save();

  res.status(200).json({ user: toPublicUser(user), accessToken });
});
```

Add these new imports (`UserSession`, `comparePassword`, `generateRefreshToken`, `hashRefreshToken`, `signAccessToken`, `setRefreshCookie`, `clearRefreshCookie`) to the top of `authController.ts` alongside the existing imports from Task 6 — do not duplicate the `RequestHandler`, `User`, `AppError`, `asyncHandler`, `toPublicUser` imports already there.

- [ ] **Step 5: Add the `login` route to `server/src/routes/authRoutes.ts`**

```typescript
import { loginSchema } from '../validators/authValidators'; // add to existing import line
import { login } from '../controllers/authController'; // add to existing import line

router.post('/login', authRateLimiter, validate(loginSchema), login);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd server && npx vitest run tests/integration/auth.login.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Write the failing integration test for refresh + logout**

`server/tests/integration/auth.refresh-logout.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';

vi.mock('../../src/services/emailService', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('POST /api/v1/auth/refresh and /api/v1/auth/logout', () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  async function loginAndGetCookie(app: import('express').Express) {
    await request(app).post('/api/v1/auth/register').send({
      username: 'iris',
      displayName: 'Iris',
      email: 'iris@example.com',
      password: 'supersecret123',
    });
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'iris@example.com', password: 'supersecret123', rememberMe: true });
    const cookie = loginRes.headers['set-cookie'].find((c: string) => c.startsWith('refreshToken='));
    return cookie as string;
  }

  it('issues a new access token given a valid refresh cookie', async () => {
    const app = (await import('../../src/app')).default;
    const cookie = await loginAndGetCookie(app);

    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('rejects refresh with no cookie with 401', async () => {
    const app = (await import('../../src/app')).default;

    const res = await request(app).post('/api/v1/auth/refresh');

    expect(res.status).toBe(401);
  });

  it('revokes the session on logout so it can no longer be refreshed', async () => {
    const app = (await import('../../src/app')).default;
    const cookie = await loginAndGetCookie(app);

    const logoutRes = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(logoutRes.status).toBe(204);

    const refreshRes = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refreshRes.status).toBe(401);
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `cd server && npx vitest run tests/integration/auth.refresh-logout.test.ts`
Expected: FAIL — `refresh`/`logout` routes do not exist yet.

- [ ] **Step 9: Add `refresh` and `logout` to `server/src/controllers/authController.ts`**

```typescript
import { REFRESH_COOKIE_NAME } from '../utils/cookies';

export const refresh: RequestHandler = asyncHandler(async (req, res) => {
  const rawToken = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE_NAME];
  if (!rawToken) {
    throw new AppError(401, 'No refresh token provided');
  }

  const tokenHash = hashRefreshToken(rawToken);
  const session = await UserSession.findOne({
    refreshTokenHash: tokenHash,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!session) {
    throw new AppError(401, 'Invalid or expired session');
  }

  session.revokedAt = new Date();
  await session.save();

  const newRawToken = generateRefreshToken();
  await UserSession.create({
    userId: session.userId,
    refreshTokenHash: hashRefreshToken(newRawToken),
    userAgent: req.headers['user-agent'] ?? '',
    ipAddress: req.ip ?? '',
    expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
  });

  setRefreshCookie(res, newRawToken, true);
  const accessToken = signAccessToken(session.userId.toString());

  res.status(200).json({ accessToken });
});

export const logout: RequestHandler = asyncHandler(async (req, res) => {
  const rawToken = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE_NAME];
  if (rawToken) {
    const tokenHash = hashRefreshToken(rawToken);
    await UserSession.updateOne(
      { refreshTokenHash: tokenHash, revokedAt: null },
      { revokedAt: new Date() }
    );
  }

  clearRefreshCookie(res);
  res.status(204).send();
});
```

- [ ] **Step 10: Add the `refresh` and `logout` routes to `server/src/routes/authRoutes.ts`**

```typescript
import { refresh, logout } from '../controllers/authController'; // add to existing import line

router.post('/refresh', refresh);
router.post('/logout', logout);
```

- [ ] **Step 11: Run test to verify it passes**

Run: `cd server && npx vitest run tests/integration/auth.refresh-logout.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 12: Run the full server test suite**

Run: `cd server && npm test`
Expected: PASS (all tests so far)

- [ ] **Step 13: Commit**

```bash
git add server/src/controllers/authController.ts server/src/routes/authRoutes.ts server/src/utils/cookies.ts server/tests/integration/auth.login.test.ts server/tests/integration/auth.refresh-logout.test.ts
git commit -m "feat(server): add login, refresh, and logout endpoints with session tracking"
```

---

### Task 8: Forgot Password + Reset Password endpoints

**Files:**
- Modify: `server/src/controllers/authController.ts` (add `forgotPassword`, `resetPassword`)
- Modify: `server/src/routes/authRoutes.ts` (add `POST /forgot-password`, `POST /reset-password`)
- Test: `server/tests/integration/auth.password-reset.test.ts`

**Interfaces:**
- Consumes: `sendPasswordResetEmail` (Task 4), `hashPassword` (Task 3), `forgotPasswordSchema`, `resetPasswordSchema` (Task 5)
- Produces: `forgotPassword: RequestHandler`, `resetPassword: RequestHandler` added to `authController.ts`

- [ ] **Step 1: Write the failing integration test**

`server/tests/integration/auth.password-reset.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';

vi.mock('../../src/services/emailService', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('POST /api/v1/auth/forgot-password and /api/v1/auth/reset-password', () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  it('returns 200 for forgot-password regardless of whether the email exists', async () => {
    const app = (await import('../../src/app')).default;

    const known = await request(app).post('/api/v1/auth/forgot-password').send({
      email: 'nobody@example.com',
    });
    expect(known.status).toBe(200);
  });

  it('resets the password with a valid token and allows login with the new password', async () => {
    const app = (await import('../../src/app')).default;
    const { signPurposeToken } = await import('../../src/services/tokenService');
    const User = (await import('../../src/models/User')).default;
    const { hashPassword } = await import('../../src/services/passwordService');

    const user = await User.create({
      username: 'jack',
      displayName: 'Jack',
      email: 'jack@example.com',
      passwordHash: await hashPassword('old-password-123'),
      avatarUrl: 'https://example.com/default-avatar.png',
    });

    const token = signPurposeToken(user.id, 'password-reset');
    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'brand-new-password-456' });
    expect(resetRes.status).toBe(200);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'jack@example.com', password: 'brand-new-password-456' });
    expect(loginRes.status).toBe(200);

    const oldPasswordLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'jack@example.com', password: 'old-password-123' });
    expect(oldPasswordLoginRes.status).toBe(401);
  });

  it('rejects reset-password with an invalid token with 400', async () => {
    const app = (await import('../../src/app')).default;

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'garbage', password: 'whatever-new-123' });

    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/integration/auth.password-reset.test.ts`
Expected: FAIL — `forgot-password`/`reset-password` routes do not exist yet.

- [ ] **Step 3: Add `forgotPassword` and `resetPassword` to `server/src/controllers/authController.ts`**

```typescript
import { sendPasswordResetEmail } from '../services/emailService'; // add to existing emailService import line

export const forgotPassword: RequestHandler = asyncHandler(async (req, res) => {
  const { email } = req.body as { email: string };

  const user = await User.findOne({ email });
  if (user) {
    const token = signPurposeToken(user.id, 'password-reset');
    await sendPasswordResetEmail(user.email, token);
  }

  res.status(200).json({
    message: 'If an account exists for that email, a reset link has been sent.',
  });
});

export const resetPassword: RequestHandler = asyncHandler(async (req, res) => {
  const { token, password } = req.body as { token: string; password: string };

  const { sub } = verifyPurposeToken(token, 'password-reset');
  const user = await User.findById(sub);
  if (!user) {
    throw new AppError(400, 'Invalid or expired token');
  }

  user.passwordHash = await hashPassword(password);
  await user.save();

  await UserSession.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });

  res.status(200).json({ message: 'Password reset successfully' });
});
```

- [ ] **Step 4: Add the routes to `server/src/routes/authRoutes.ts`**

```typescript
import { forgotPasswordSchema, resetPasswordSchema } from '../validators/authValidators'; // add to existing import line
import { forgotPassword, resetPassword } from '../controllers/authController'; // add to existing import line

router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run tests/integration/auth.password-reset.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Run the full server test suite**

Run: `cd server && npm test`
Expected: PASS (all tests so far)

- [ ] **Step 7: Commit**

```bash
git add server/src/controllers/authController.ts server/src/routes/authRoutes.ts server/tests/integration/auth.password-reset.test.ts
git commit -m "feat(server): add forgot-password and reset-password endpoints"
```

---

### Task 9: Google login scaffold (enabled only when `GOOGLE_CLIENT_ID` is set)

**Files:**
- Create: `server/src/services/googleAuthService.ts`
- Modify: `server/src/controllers/authController.ts` (add `googleLogin`)
- Modify: `server/src/routes/authRoutes.ts` (add `POST /google`)
- Test: `server/tests/unit/googleAuthService.test.ts`
- Test: `server/tests/integration/auth.google.test.ts`

**Interfaces:**
- Consumes: `validate` middleware (Task 5)
- Produces: `isGoogleLoginEnabled(): boolean` and `verifyGoogleIdToken(idToken: string): Promise<{ googleId: string; email: string; name: string; picture?: string }>` from `googleAuthService.ts` (throws `AppError(401, ...)` on an invalid/unverifiable token)
- Produces: `googleLoginSchema` (Zod schema, `{ idToken: string }`) added to `validators/authValidators.ts`
- Produces: `googleLogin: RequestHandler` added to `authController.ts` — responds with the same shape as `login`: `{ user: PublicUser, accessToken: string }`, and sets the refresh cookie the same way

- [ ] **Step 1: Install `google-auth-library`**

```bash
cd server && npm install google-auth-library
```

- [ ] **Step 2: Write the failing unit test for `googleAuthService`**

`server/tests/unit/googleAuthService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const verifyIdTokenMock = vi.fn();

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    verifyIdToken: verifyIdTokenMock,
  })),
}));

describe('googleAuthService', () => {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;

  beforeEach(() => {
    verifyIdTokenMock.mockReset();
  });

  afterEach(() => {
    if (originalClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = originalClientId;
    }
  });

  it('reports disabled when GOOGLE_CLIENT_ID is not set', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    vi.resetModules();
    const { isGoogleLoginEnabled } = await import('../../src/services/googleAuthService');
    expect(isGoogleLoginEnabled()).toBe(false);
  });

  it('reports enabled when GOOGLE_CLIENT_ID is set', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    vi.resetModules();
    const { isGoogleLoginEnabled } = await import('../../src/services/googleAuthService');
    expect(isGoogleLoginEnabled()).toBe(true);
  });

  it('extracts profile fields from a verified token payload', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    vi.resetModules();
    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-123',
        email: 'kate@example.com',
        name: 'Kate',
        picture: 'https://example.com/pic.png',
      }),
    });

    const { verifyGoogleIdToken } = await import('../../src/services/googleAuthService');
    const profile = await verifyGoogleIdToken('fake-id-token');

    expect(profile).toEqual({
      googleId: 'google-sub-123',
      email: 'kate@example.com',
      name: 'Kate',
      picture: 'https://example.com/pic.png',
    });
  });

  it('throws AppError(401) when the token payload is empty', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    vi.resetModules();
    verifyIdTokenMock.mockResolvedValue({ getPayload: () => undefined });

    const { verifyGoogleIdToken } = await import('../../src/services/googleAuthService');
    const { AppError } = await import('../../src/utils/AppError');

    await expect(verifyGoogleIdToken('fake-id-token')).rejects.toBeInstanceOf(AppError);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && npx vitest run tests/unit/googleAuthService.test.ts`
Expected: FAIL — `src/services/googleAuthService.ts` does not exist yet.

- [ ] **Step 4: Implement `server/src/services/googleAuthService.ts`**

```typescript
import { OAuth2Client } from 'google-auth-library';
import { AppError } from '../utils/AppError';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
}

export function isGoogleLoginEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID);
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new AppError(503, 'Google login is not configured');
  }

  const client = new OAuth2Client(clientId);

  let ticket;
  try {
    ticket = await client.verifyIdToken({ idToken, audience: clientId });
  } catch {
    throw new AppError(401, 'Invalid Google token');
  }

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new AppError(401, 'Invalid Google token payload');
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email,
    picture: payload.picture,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run tests/unit/googleAuthService.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Write the failing integration test for the `/auth/google` route**

`server/tests/integration/auth.google.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';

vi.mock('../../src/services/emailService', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('POST /api/v1/auth/google', () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
    vi.doUnmock('../../src/services/googleAuthService');
    vi.resetModules();
  });

  it('returns 503 when Google login is not configured', async () => {
    const app = (await import('../../src/app')).default;

    const res = await request(app).post('/api/v1/auth/google').send({ idToken: 'whatever' });

    expect(res.status).toBe(503);
  });

  it('creates a new user on first Google login', async () => {
    vi.doMock('../../src/services/googleAuthService', () => ({
      isGoogleLoginEnabled: () => true,
      verifyGoogleIdToken: vi.fn().mockResolvedValue({
        googleId: 'google-sub-999',
        email: 'liam@example.com',
        name: 'Liam',
        picture: 'https://example.com/liam.png',
      }),
    }));
    vi.resetModules();

    const app = (await import('../../src/app')).default;
    const res = await request(app).post('/api/v1/auth/google').send({ idToken: 'fake' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('liam@example.com');
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('logs in the existing user on a repeat Google login', async () => {
    vi.doMock('../../src/services/googleAuthService', () => ({
      isGoogleLoginEnabled: () => true,
      verifyGoogleIdToken: vi.fn().mockResolvedValue({
        googleId: 'google-sub-888',
        email: 'mia@example.com',
        name: 'Mia',
        picture: undefined,
      }),
    }));
    vi.resetModules();

    const app = (await import('../../src/app')).default;
    const firstRes = await request(app).post('/api/v1/auth/google').send({ idToken: 'fake' });
    const secondRes = await request(app).post('/api/v1/auth/google').send({ idToken: 'fake' });

    expect(firstRes.status).toBe(200);
    expect(secondRes.status).toBe(200);
    expect(firstRes.body.user.id).toBe(secondRes.body.user.id);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd server && npx vitest run tests/integration/auth.google.test.ts`
Expected: FAIL — `/auth/google` route does not exist yet.

- [ ] **Step 8: Add `googleLogin` to `server/src/controllers/authController.ts`**

```typescript
import { isGoogleLoginEnabled, verifyGoogleIdToken } from '../services/googleAuthService';

export const googleLogin: RequestHandler = asyncHandler(async (req, res) => {
  if (!isGoogleLoginEnabled()) {
    throw new AppError(503, 'Google login is not configured');
  }

  const { idToken } = req.body as { idToken: string };
  const profile = await verifyGoogleIdToken(idToken);

  let user = await User.findOne({ googleId: profile.googleId });
  if (!user) {
    user = await User.findOne({ email: profile.email });
    if (user) {
      user.googleId = profile.googleId;
    } else {
      const usernameBase = profile.email.split('@')[0]!.replace(/[^a-zA-Z0-9_]/g, '');
      let username = usernameBase;
      while (await User.findOne({ username })) {
        username = `${usernameBase}${Math.floor(1000 + Math.random() * 9000)}`;
      }
      user = new User({
        username,
        displayName: profile.name,
        email: profile.email,
        passwordHash: null,
        avatarUrl: profile.picture ?? `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(username)}`,
        googleId: profile.googleId,
        emailVerifiedAt: new Date(),
      });
    }
    await user.save();
  }

  const accessToken = signAccessToken(user.id);
  const rawRefreshToken = generateRefreshToken();
  await UserSession.create({
    userId: user._id,
    refreshTokenHash: hashRefreshToken(rawRefreshToken),
    userAgent: req.headers['user-agent'] ?? '',
    ipAddress: req.ip ?? '',
    expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
  });
  setRefreshCookie(res, rawRefreshToken, true);

  res.status(200).json({ user: toPublicUser(user), accessToken });
});
```

- [ ] **Step 9: Add the `/google` route to `server/src/routes/authRoutes.ts`**

```typescript
import { googleLogin } from '../controllers/authController'; // add to existing import line
import { googleLoginSchema } from '../validators/authValidators'; // add to existing import line

router.post('/google', validate(googleLoginSchema), googleLogin);
```

- [ ] **Step 10: Run test to verify it passes**

Run: `cd server && npx vitest run tests/integration/auth.google.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 11: Run the full server test suite**

Run: `cd server && npm test`
Expected: PASS (all tests so far)

- [ ] **Step 12: Commit**

```bash
git add server/src/services/googleAuthService.ts server/src/controllers/authController.ts server/src/routes/authRoutes.ts server/tests/unit/googleAuthService.test.ts server/tests/integration/auth.google.test.ts server/package.json server/package-lock.json
git commit -m "feat(server): add Google login scaffold, disabled until GOOGLE_CLIENT_ID is set"
```

---

### Task 10: User profile and settings endpoints

**Files:**
- Create: `server/src/controllers/userController.ts`
- Create: `server/src/routes/userRoutes.ts`
- Modify: `server/src/routes/index.ts` (mount `userRoutes` under `/users`)
- Test: `server/tests/integration/users.me.test.ts`

**Interfaces:**
- Consumes: `authenticate` (Task 5), `updateProfileSchema`, `changePasswordSchema`, `updateSettingsSchema` (Task 5), `comparePassword`, `hashPassword` (Task 3), `toPublicUser` (Task 5)
- Produces: `getMe`, `updateMe`, `changePassword`, `getSettings`, `updateSettings` (all `RequestHandler`) from `userController.ts`
- Produces: default-exported `Router` from `userRoutes.ts`, every route behind `authenticate`: `GET /me`, `PATCH /me`, `PATCH /me/password`, `GET /me/settings`, `PATCH /me/settings`

- [ ] **Step 1: Write the failing integration test**

`server/tests/integration/users.me.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';

vi.mock('../../src/services/emailService', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('/api/v1/users/me', () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  async function registerAndLogin(app: import('express').Express) {
    await request(app).post('/api/v1/auth/register').send({
      username: 'nina',
      displayName: 'Nina',
      email: 'nina@example.com',
      password: 'supersecret123',
    });
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nina@example.com', password: 'supersecret123' });
    return loginRes.body.accessToken as string;
  }

  it('rejects unauthenticated requests with 401', async () => {
    const app = (await import('../../src/app')).default;
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user profile when authenticated', async () => {
    const app = (await import('../../src/app')).default;
    const accessToken = await registerAndLogin(app);

    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('nina');
  });

  it('updates allowed profile fields', async () => {
    const app = (await import('../../src/app')).default;
    const accessToken = await registerAndLogin(app);

    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ bio: 'Hello world', interests: ['hiking', 'chess'] });

    expect(res.status).toBe(200);
    expect(res.body.user.bio).toBe('Hello world');
    expect(res.body.user.interests).toEqual(['hiking', 'chess']);
  });

  it('changes the password given the correct current password', async () => {
    const app = (await import('../../src/app')).default;
    const accessToken = await registerAndLogin(app);

    const res = await request(app)
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'supersecret123', newPassword: 'new-password-789' });

    expect(res.status).toBe(200);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nina@example.com', password: 'new-password-789' });
    expect(loginRes.status).toBe(200);
  });

  it('rejects password change with an incorrect current password', async () => {
    const app = (await import('../../src/app')).default;
    const accessToken = await registerAndLogin(app);

    const res = await request(app)
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'totally-wrong', newPassword: 'new-password-789' });

    expect(res.status).toBe(401);
  });

  it('gets and updates settings (theme + privacy)', async () => {
    const app = (await import('../../src/app')).default;
    const accessToken = await registerAndLogin(app);

    const getRes = await request(app)
      .get('/api/v1/users/me/settings')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.theme).toBe('system');
    expect(getRes.body.privacy.invisibleMode).toBe(false);

    const patchRes = await request(app)
      .patch('/api/v1/users/me/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ theme: 'dark', privacy: { invisibleMode: true } });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.theme).toBe('dark');
    expect(patchRes.body.privacy.invisibleMode).toBe(true);
    expect(patchRes.body.privacy.hideDistance).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/integration/users.me.test.ts`
Expected: FAIL — `/users/*` routes do not exist yet.

- [ ] **Step 3: Implement `server/src/controllers/userController.ts`**

```typescript
import { RequestHandler } from 'express';
import User from '../models/User';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { toPublicUser } from '../utils/toPublicUser';
import { comparePassword, hashPassword } from '../services/passwordService';

async function requireUser(userId: string | undefined) {
  if (!userId) {
    throw new AppError(401, 'Not authenticated');
  }
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(404, 'User not found');
  }
  return user;
}

export const getMe: RequestHandler = asyncHandler(async (req, res) => {
  const user = await requireUser(req.userId);
  res.status(200).json({ user: toPublicUser(user) });
});

export const updateMe: RequestHandler = asyncHandler(async (req, res) => {
  const user = await requireUser(req.userId);
  const updates = req.body as Partial<{
    displayName: string;
    bio: string;
    gender: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
    age: number;
    country: string;
    city: string;
    interests: string[];
    languages: string[];
  }>;

  Object.assign(user, updates);
  await user.save();

  res.status(200).json({ user: toPublicUser(user) });
});

export const changePassword: RequestHandler = asyncHandler(async (req, res) => {
  const user = await requireUser(req.userId);
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };

  if (!user.passwordHash || !(await comparePassword(currentPassword, user.passwordHash))) {
    throw new AppError(401, 'Current password is incorrect');
  }

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  res.status(200).json({ message: 'Password updated successfully' });
});

export const getSettings: RequestHandler = asyncHandler(async (req, res) => {
  const user = await requireUser(req.userId);
  res.status(200).json({ theme: user.theme, privacy: user.privacy });
});

export const updateSettings: RequestHandler = asyncHandler(async (req, res) => {
  const user = await requireUser(req.userId);
  const { theme, privacy } = req.body as {
    theme?: 'light' | 'dark' | 'system';
    privacy?: Partial<typeof user.privacy>;
  };

  if (theme) {
    user.theme = theme;
  }
  if (privacy) {
    Object.assign(user.privacy, privacy);
  }
  await user.save();

  res.status(200).json({ theme: user.theme, privacy: user.privacy });
});
```

- [ ] **Step 4: Implement `server/src/routes/userRoutes.ts`**

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { updateProfileSchema, changePasswordSchema, updateSettingsSchema } from '../validators/userValidators';
import { getMe, updateMe, changePassword, getSettings, updateSettings } from '../controllers/userController';

const router = Router();

router.use(authenticate);

router.get('/me', getMe);
router.patch('/me', validate(updateProfileSchema), updateMe);
router.patch('/me/password', validate(changePasswordSchema), changePassword);
router.get('/me/settings', getSettings);
router.patch('/me/settings', validate(updateSettingsSchema), updateSettings);

export default router;
```

- [ ] **Step 5: Update `server/src/routes/index.ts` to mount `userRoutes`**

```typescript
import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);

export default router;
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd server && npx vitest run tests/integration/users.me.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 7: Run the full server test suite**

Run: `cd server && npm test`
Expected: PASS (all server tests — this completes the server side of Phase 1)

- [ ] **Step 8: Commit**

```bash
git add server/src/controllers/userController.ts server/src/routes/userRoutes.ts server/src/routes/index.ts server/tests/integration/users.me.test.ts
git commit -m "feat(server): add user profile and settings endpoints"
```

---

### Task 11: Client project scaffolding (Vite + React 19 + TS + Tailwind + Router shell)

**Files:**
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/tsconfig.node.json`
- Create: `client/vite.config.ts`
- Create: `client/vitest.config.ts`
- Create: `client/tailwind.config.ts`
- Create: `client/postcss.config.js`
- Create: `client/index.html`
- Create: `client/.env.example`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `client/src/index.css`
- Create: `client/src/routes/router.tsx`
- Create: `client/src/test/setup.ts`
- Test: `client/src/App.test.tsx`

**Interfaces:**
- Produces: default-exported `router` (a `createBrowserRouter` instance) from `routes/router.tsx`, with a single placeholder route at `/` — later tasks (15, 16, 18, 19, 20, 21) each add more routes to this same file
- Produces: default-exported `App` component from `App.tsx` that renders `<RouterProvider router={router} />`

- [ ] **Step 1: Initialize `client/package.json` and install dependencies**

```bash
mkdir -p client/src/routes client/src/test
cd client
npm init -y
npm install react react-dom react-router-dom @tanstack/react-query zustand react-hook-form zod @hookform/resolvers framer-motion axios
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom tailwindcss postcss autoprefixer vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event eslint prettier
```

Edit the generated `client/package.json` scripts section to:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Create `client/tsconfig.json` and `client/tsconfig.node.json`**

`client/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`client/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts", "vitest.config.ts", "tailwind.config.ts"]
}
```

- [ ] **Step 3: Create `client/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
```

- [ ] **Step 4: Create `client/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
  },
});
```

- [ ] **Step 5: Create `client/src/test/setup.ts`**

```typescript
import '@testing-library/jest-dom/vitest';

// jsdom does not implement matchMedia; the theme store (Task 13) needs it to
// resolve the "system" preference, so every test run gets a working stub.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}
```

- [ ] **Step 6: Create `client/tailwind.config.ts` and `client/postcss.config.js`**

`client/tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss';

export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
```

`client/postcss.config.js`:

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 7: Create `client/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NearMe</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Create `client/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
}

[data-theme='dark'] {
  color-scheme: dark;
}

body {
  @apply bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100;
}
```

- [ ] **Step 9: Create `client/.env.example`**

```
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

- [ ] **Step 10: Write the failing smoke test for `App`**

`client/src/App.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the NearMe placeholder home route', () => {
    render(<App />);
    expect(screen.getByText(/nearme/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 11: Run test to verify it fails**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: FAIL — `src/App.tsx` and `src/routes/router.tsx` do not exist yet.

- [ ] **Step 12: Implement `client/src/routes/router.tsx`**

```typescript
import { createBrowserRouter } from 'react-router-dom';

const router = createBrowserRouter([
  {
    path: '/',
    element: <div className="p-8 text-2xl font-semibold">NearMe — more coming soon</div>,
  },
]);

export default router;
```

- [ ] **Step 13: Implement `client/src/App.tsx`**

```typescript
import { RouterProvider } from 'react-router-dom';
import router from './routes/router';

export default function App() {
  return <RouterProvider router={router} />;
}
```

- [ ] **Step 14: Create `client/src/main.tsx`**

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 15: Run test to verify it passes**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: PASS

- [ ] **Step 16: Verify the production build succeeds**

Run: `cd client && npm run build`
Expected: build completes with no TypeScript errors

- [ ] **Step 17: Commit**

```bash
git add client/
git commit -m "feat(client): scaffold Vite+React19+TS+Tailwind app with router shell"
```

---

### Task 12: Auth store, Axios client with refresh interceptor, and auth API

**Files:**
- Create: `client/src/types/user.ts`
- Create: `client/src/store/authStore.ts`
- Create: `client/src/api/axiosClient.ts`
- Create: `client/src/api/authApi.ts`
- Test: `client/src/store/authStore.test.ts`
- Test: `client/src/api/axiosClient.test.ts`
- Test: `client/src/api/authApi.test.ts`

**Interfaces:**
- Produces: `User`, `PrivacySettings` types from `types/user.ts` (mirrors server `PublicUser`)
- Produces: `useAuthStore` (Zustand hook) from `store/authStore.ts` with state `{ user: User | null; accessToken: string | null }` and actions `setAuth(user: User, accessToken: string): void`, `clearAuth(): void`
- Produces: `apiClient` (Axios instance, named export) from `api/axiosClient.ts` — `baseURL` from `VITE_API_BASE_URL`, `withCredentials: true`, request interceptor attaching `Authorization: Bearer <accessToken>` from `useAuthStore`, response interceptor that on a `401` (excluding the `/auth/refresh` call itself, and only once per request) calls `POST /auth/refresh`, updates the store, and retries the original request
- Produces from `api/authApi.ts`: `registerUser(input: {username, displayName, email, password}): Promise<{user: User}>`, `loginUser(input: {email, password, rememberMe?}): Promise<{user: User, accessToken: string}>`, `logoutUser(): Promise<void>`, `verifyEmail(token: string): Promise<{user: User}>`, `forgotPassword(email: string): Promise<{message: string}>`, `resetPassword(input: {token: string, password: string}): Promise<{message: string}>`, `googleLogin(idToken: string): Promise<{user: User, accessToken: string}>`

- [ ] **Step 1: Install `axios-mock-adapter` for interceptor testing**

```bash
cd client && npm install -D axios-mock-adapter
```

- [ ] **Step 2: Create `client/src/types/user.ts` (no isolated test — a pure type file, exercised by every task from here on)**

```typescript
export interface PrivacySettings {
  hideOnlineStatus: boolean;
  hideDistance: boolean;
  hideProfile: boolean;
  invisibleMode: boolean;
  privateAccount: boolean;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  bio?: string;
  gender?: string;
  age?: number;
  country?: string;
  city?: string;
  interests: string[];
  languages: string[];
  role: string;
  status: string;
  theme: 'light' | 'dark' | 'system';
  emailVerifiedAt: string | null;
  createdAt: string;
  privacy: PrivacySettings;
}
```

- [ ] **Step 3: Write the failing test for `authStore`**

`client/src/store/authStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';
import type { User } from '../types/user';

const fakeUser: User = {
  id: '1',
  username: 'test',
  displayName: 'Test',
  email: 'test@example.com',
  avatarUrl: '',
  interests: [],
  languages: [],
  role: 'user',
  status: 'active',
  theme: 'system',
  emailVerifiedAt: null,
  createdAt: new Date().toISOString(),
  privacy: {
    hideOnlineStatus: false,
    hideDistance: false,
    hideProfile: false,
    invisibleMode: false,
    privateAccount: false,
  },
};

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('starts with no user and no access token', () => {
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('sets the user and access token via setAuth', () => {
    useAuthStore.getState().setAuth(fakeUser, 'token-123');
    expect(useAuthStore.getState().user).toEqual(fakeUser);
    expect(useAuthStore.getState().accessToken).toBe('token-123');
  });

  it('clears the user and access token via clearAuth', () => {
    useAuthStore.getState().setAuth(fakeUser, 'token-123');
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd client && npx vitest run src/store/authStore.test.ts`
Expected: FAIL — `src/store/authStore.ts` does not exist yet.

- [ ] **Step 5: Implement `client/src/store/authStore.ts`**

```typescript
import { create } from 'zustand';
import type { User } from '../types/user';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, accessToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setAuth: (user, accessToken) => set({ user, accessToken }),
  clearAuth: () => set({ user: null, accessToken: null }),
}));
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd client && npx vitest run src/store/authStore.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Write the failing test for `apiClient`'s interceptors**

`client/src/api/axiosClient.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from './axiosClient';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types/user';

const fakeUser = { id: '1', username: 'test' } as User;

describe('apiClient', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    useAuthStore.getState().clearAuth();
  });

  afterEach(() => {
    mock.restore();
  });

  it('attaches the access token as a Bearer header when present', async () => {
    useAuthStore.getState().setAuth(fakeUser, 'test-token');
    mock.onGet('/whoami').reply((config) => {
      expect(config.headers?.Authorization).toBe('Bearer test-token');
      return [200, {}];
    });

    await apiClient.get('/whoami');
  });

  it('does not attach an Authorization header when there is no token', async () => {
    mock.onGet('/whoami').reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined();
      return [200, {}];
    });

    await apiClient.get('/whoami');
  });

  it('refreshes the access token and retries once on a 401', async () => {
    useAuthStore.getState().setAuth(fakeUser, 'expired-token');

    let attempt = 0;
    mock.onGet('/protected').reply(() => {
      attempt += 1;
      return attempt === 1 ? [401, {}] : [200, { ok: true }];
    });
    mock.onPost('/auth/refresh').reply(200, { accessToken: 'new-token' });

    const res = await apiClient.get('/protected');

    expect(res.data).toEqual({ ok: true });
    expect(useAuthStore.getState().accessToken).toBe('new-token');
  });

  it('clears auth and rejects when the refresh call itself fails', async () => {
    useAuthStore.getState().setAuth(fakeUser, 'expired-token');

    mock.onGet('/protected').reply(401);
    mock.onPost('/auth/refresh').reply(401);

    await expect(apiClient.get('/protected')).rejects.toBeDefined();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `cd client && npx vitest run src/api/axiosClient.test.ts`
Expected: FAIL — `src/api/axiosClient.ts` does not exist yet.

- [ ] **Step 9: Implement `client/src/api/axiosClient.ts`**

```typescript
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const baseURL = import.meta.env.VITE_API_BASE_URL as string;

export const apiClient = axios.create({ baseURL, withCredentials: true });

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalConfig = error.config as RetryableConfig | undefined;
    const isRefreshCall = originalConfig?.url?.includes('/auth/refresh') ?? false;

    if (error.response?.status === 401 && originalConfig && !originalConfig._retry && !isRefreshCall) {
      originalConfig._retry = true;
      try {
        const refreshRes = await apiClient.post<{ accessToken: string }>('/auth/refresh');
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          useAuthStore.getState().setAuth(currentUser, refreshRes.data.accessToken);
        }
        originalConfig.headers.Authorization = `Bearer ${refreshRes.data.accessToken}`;
        return apiClient(originalConfig);
      } catch (refreshError) {
        useAuthStore.getState().clearAuth();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
```

- [ ] **Step 10: Run test to verify it passes**

Run: `cd client && npx vitest run src/api/axiosClient.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 11: Implement `client/src/api/authApi.ts`**

```typescript
import { apiClient } from './axiosClient';
import type { User } from '../types/user';

export interface RegisterInput {
  username: string;
  displayName: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export async function registerUser(input: RegisterInput): Promise<{ user: User }> {
  const res = await apiClient.post<{ user: User }>('/auth/register', input);
  return res.data;
}

export async function loginUser(input: LoginInput): Promise<{ user: User; accessToken: string }> {
  const res = await apiClient.post<{ user: User; accessToken: string }>('/auth/login', input);
  return res.data;
}

export async function logoutUser(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function verifyEmail(token: string): Promise<{ user: User }> {
  const res = await apiClient.post<{ user: User }>('/auth/verify-email', { token });
  return res.data;
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const res = await apiClient.post<{ message: string }>('/auth/forgot-password', { email });
  return res.data;
}

export async function resetPassword(input: {
  token: string;
  password: string;
}): Promise<{ message: string }> {
  const res = await apiClient.post<{ message: string }>('/auth/reset-password', input);
  return res.data;
}

export async function googleLogin(idToken: string): Promise<{ user: User; accessToken: string }> {
  const res = await apiClient.post<{ user: User; accessToken: string }>('/auth/google', { idToken });
  return res.data;
}
```

- [ ] **Step 12: Write the failing test for `authApi`**

Every page test from Task 15 onward mocks `../api/authApi` entirely with `vi.mock`, which means the real implementation — whether each function hits the right HTTP method, the right URL, and returns the right shape — is never actually exercised anywhere else. This test is the only place that runs the real functions against a mocked HTTP layer.

`client/src/api/authApi.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from './axiosClient';
import {
  registerUser,
  loginUser,
  logoutUser,
  verifyEmail,
  forgotPassword,
  resetPassword,
  googleLogin,
} from './authApi';

describe('authApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });

  afterEach(() => {
    mock.restore();
  });

  it('registerUser posts to /auth/register with the given payload', async () => {
    const input = { username: 'a', displayName: 'A', email: 'a@b.com', password: 'password123' };
    mock.onPost('/auth/register', input).reply(201, { user: { id: '1' } });

    const result = await registerUser(input);
    expect(result.user).toEqual({ id: '1' });
  });

  it('loginUser posts to /auth/login and returns the user and access token', async () => {
    const input = { email: 'a@b.com', password: 'password123' };
    mock.onPost('/auth/login', input).reply(200, { user: { id: '1' }, accessToken: 'tok' });

    const result = await loginUser(input);
    expect(result).toEqual({ user: { id: '1' }, accessToken: 'tok' });
  });

  it('logoutUser posts to /auth/logout', async () => {
    mock.onPost('/auth/logout').reply(204);
    await expect(logoutUser()).resolves.toBeUndefined();
  });

  it('verifyEmail posts the token to /auth/verify-email', async () => {
    mock.onPost('/auth/verify-email', { token: 'tok123' }).reply(200, { user: { id: '1' } });
    const result = await verifyEmail('tok123');
    expect(result.user).toEqual({ id: '1' });
  });

  it('forgotPassword posts the email to /auth/forgot-password', async () => {
    mock.onPost('/auth/forgot-password', { email: 'a@b.com' }).reply(200, { message: 'sent' });
    const result = await forgotPassword('a@b.com');
    expect(result.message).toBe('sent');
  });

  it('resetPassword posts the token and password to /auth/reset-password', async () => {
    mock
      .onPost('/auth/reset-password', { token: 'tok', password: 'newpass123' })
      .reply(200, { message: 'ok' });
    const result = await resetPassword({ token: 'tok', password: 'newpass123' });
    expect(result.message).toBe('ok');
  });

  it('googleLogin posts the idToken to /auth/google', async () => {
    mock
      .onPost('/auth/google', { idToken: 'id-token' })
      .reply(200, { user: { id: '1' }, accessToken: 'tok' });
    const result = await googleLogin('id-token');
    expect(result.accessToken).toBe('tok');
  });
});
```

- [ ] **Step 13: Run test to verify it fails, then passes**

Run: `cd client && npx vitest run src/api/authApi.test.ts`
Expected: since Step 11 already implemented `authApi.ts` before this test was written, it should PASS immediately (7 tests) — if any test fails, it indicates a mismatch between the implementation and one of these endpoint contracts; fix the implementation, not the test, since these payload shapes are what Task 6/7/8/9 on the server actually expect.

- [ ] **Step 14: Run the full client test suite**

Run: `cd client && npm test`
Expected: PASS (all tests so far)

- [ ] **Step 15: Commit**

```bash
git add client/src/types client/src/store/authStore.ts client/src/store/authStore.test.ts client/src/api client/package.json client/package-lock.json
git commit -m "feat(client): add auth store, Axios client with refresh interceptor, and auth API"
```

---

### Task 13: Theme store (instant light/dark/system switching)

**Files:**
- Create: `client/src/store/themeStore.ts`
- Modify: `client/src/App.tsx` (apply the theme store's effect on mount)
- Test: `client/src/store/themeStore.test.ts`

**Interfaces:**
- Produces: `useThemeStore` (Zustand hook) from `store/themeStore.ts` with state `{ theme: 'light' | 'dark' | 'system' }` and action `setTheme(theme: 'light' | 'dark' | 'system'): void` — on every call, persists the choice to `localStorage` under the key `nearme-theme` and sets `document.documentElement.dataset.theme` to the resolved effective theme (`system` resolves via `window.matchMedia('(prefers-color-scheme: dark)')`)

- [ ] **Step 1: Write the failing test for `themeStore`**

`client/src/store/themeStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from './themeStore';

describe('themeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to system theme when nothing is stored', () => {
    expect(useThemeStore.getState().theme).toBe('system');
  });

  it('applies data-theme="dark" immediately when set to dark', () => {
    useThemeStore.getState().setTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('applies data-theme="light" immediately when set to light', () => {
    useThemeStore.getState().setTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('persists the choice to localStorage', () => {
    useThemeStore.getState().setTheme('dark');
    expect(localStorage.getItem('nearme-theme')).toBe('dark');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/store/themeStore.test.ts`
Expected: FAIL — `src/store/themeStore.ts` does not exist yet.

- [ ] **Step 3: Implement `client/src/store/themeStore.ts`**

```typescript
import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

const STORAGE_KEY = 'nearme-theme';

function resolveEffectiveTheme(theme: ThemePreference): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

function applyTheme(theme: ThemePreference): void {
  document.documentElement.setAttribute('data-theme', resolveEffectiveTheme(theme));
}

function getInitialTheme(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => {
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
    set({ theme });
  },
}));

applyTheme(useThemeStore.getState().theme);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/store/themeStore.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Wire the theme store into `client/src/App.tsx`**

```typescript
import { RouterProvider } from 'react-router-dom';
import router from './routes/router';
import './store/themeStore'; // module import applies the persisted theme before first paint

export default function App() {
  return <RouterProvider router={router} />;
}
```

- [ ] **Step 6: Run the full client test suite**

Run: `cd client && npm test`
Expected: PASS (all tests so far)

- [ ] **Step 7: Commit**

```bash
git add client/src/store/themeStore.ts client/src/store/themeStore.test.ts client/src/App.tsx
git commit -m "feat(client): add theme store with instant light/dark/system switching"
```

---

### Task 14: Shared UI kit (Button, Input, Skeleton, Toaster, ErrorBoundary, EmptyState)

**Files:**
- Create: `client/src/components/ui/Button.tsx`
- Create: `client/src/components/ui/Input.tsx`
- Create: `client/src/components/ui/Skeleton.tsx`
- Create: `client/src/store/toastStore.ts`
- Create: `client/src/components/ui/Toaster.tsx`
- Create: `client/src/components/ui/ErrorBoundary.tsx`
- Create: `client/src/components/ui/EmptyState.tsx`
- Test: `client/src/components/ui/Button.test.tsx`
- Test: `client/src/components/ui/Input.test.tsx`
- Test: `client/src/components/ui/Toaster.test.tsx`
- Test: `client/src/components/ui/ErrorBoundary.test.tsx`
- Test: `client/src/components/ui/EmptyState.test.tsx`

**Interfaces:**
- Produces: `Button` — props `{ variant?: 'primary'|'secondary'|'ghost'|'danger'; size?: 'sm'|'md'|'lg'; isLoading?: boolean } & ComponentPropsWithoutRef<'button'>`
- Produces: `Input` — props `{ label: string; error?: string } & ComponentPropsWithoutRef<'input'>`, forwards `ref`
- Produces: `Skeleton` — props `{ className?: string }`, renders a pulsing placeholder block
- Produces: `useToastStore` (Zustand) with state `{ toasts: {id: string; message: string; type: 'success'|'error'}[] }` and a module-level `toast` helper object `{ success(message: string): void; error(message: string): void }` that pushes a toast and auto-removes it after 4s
- Produces: `Toaster` — renders all active toasts, no props (reads `useToastStore`)
- Produces: `ErrorBoundary` — class component, props `{ children: ReactNode; fallback?: ReactNode }`, catches render errors in `children` and shows `fallback` (or a default "Something went wrong" panel with a Reload button) instead of crashing the tree
- Produces: `EmptyState` — props `{ title: string; description?: string; action?: ReactNode }`

- [ ] **Step 1: Write the failing test for `Button`**

`client/src/components/ui/Button.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders its children and responds to clicks', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disables the button and shows a busy state while isLoading', () => {
    render(<Button isLoading>Save</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/ui/Button.test.tsx`
Expected: FAIL — `Button.tsx` does not exist yet.

- [ ] **Step 3: Implement `client/src/components/ui/Button.tsx`**

```typescript
import { ComponentPropsWithoutRef, forwardRef } from 'react';
import { motion } from 'framer-motion';

export interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-indigo-400',
  secondary:
    'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700',
  ghost: 'bg-transparent text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800',
  danger: 'bg-red-600 text-white hover:bg-red-500 disabled:bg-red-400',
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading = false, disabled, className = '', children, ...props }, ref) => (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {isLoading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </motion.button>
  )
);
Button.displayName = 'Button';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/ui/Button.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing test for `Input`**

`client/src/components/ui/Input.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  it('associates the label with the input via htmlFor/id', () => {
    render(<Input label="Email" id="email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toBeInTheDocument();
  });

  it('shows an error message when error is provided', () => {
    render(<Input label="Email" id="email" error="Email is required" />);
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/ui/Input.test.tsx`
Expected: FAIL — `Input.tsx` does not exist yet.

- [ ] **Step 7: Implement `client/src/components/ui/Input.tsx`**

```typescript
import { ComponentPropsWithoutRef, forwardRef, useId } from 'react';

export interface InputProps extends ComponentPropsWithoutRef<'input'> {
  label: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = '', ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          className={`rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:text-gray-100 ${
            error ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
          } ${className}`}
          {...props}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/ui/Input.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 9: Implement `client/src/components/ui/Skeleton.tsx` (no isolated test — trivial presentational div, exercised visually in Tasks 19/20)**

```typescript
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-200 dark:bg-gray-800 ${className}`} />;
}
```

- [ ] **Step 10: Write the failing test for the toast store + `Toaster`**

`client/src/components/ui/Toaster.test.tsx`:

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Toaster } from './Toaster';
import { useToastStore, toast } from '../../store/toastStore';

describe('Toaster', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a success toast and auto-dismisses it', async () => {
    render(<Toaster />);
    toast.success('Saved!');

    expect(await screen.findByText('Saved!')).toBeInTheDocument();

    vi.advanceTimersByTime(4100);
    await waitFor(() => expect(screen.queryByText('Saved!')).not.toBeInTheDocument());
  });

  it('shows an error toast', async () => {
    render(<Toaster />);
    toast.error('Something failed');

    expect(await screen.findByText('Something failed')).toBeInTheDocument();
  });
});
```

- [ ] **Step 11: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/ui/Toaster.test.tsx`
Expected: FAIL — `store/toastStore.ts` and `components/ui/Toaster.tsx` do not exist yet.

- [ ] **Step 12: Implement `client/src/store/toastStore.ts`**

```typescript
import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Toast) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (t) => set((state) => ({ toasts: [...state.toasts, t] })),
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

function push(message: string, type: Toast['type']): void {
  const id = `${type}-${message}-${Math.random().toString(36).slice(2)}`;
  useToastStore.getState().addToast({ id, message, type });
  setTimeout(() => useToastStore.getState().removeToast(id), 4000);
}

export const toast = {
  success: (message: string) => push(message, 'success'),
  error: (message: string) => push(message, 'error'),
};
```

- [ ] **Step 13: Implement `client/src/components/ui/Toaster.tsx`**

```typescript
import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore } from '../../store/toastStore';

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            role="status"
            className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
              t.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 14: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/ui/Toaster.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 15: Write the failing test for `ErrorBoundary`**

`client/src/components/ui/ErrorBoundary.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('renders the default fallback when a child throws', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    consoleErrorSpy.mockRestore();
  });
});
```

- [ ] **Step 16: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/ui/ErrorBoundary.test.tsx`
Expected: FAIL — `ErrorBoundary.tsx` does not exist yet.

- [ ] **Step 17: Implement `client/src/components/ui/ErrorBoundary.tsx`**

```typescript
import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught an error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-lg font-semibold">Something went wrong</p>
            <p className="text-sm text-gray-500">Please try reloading the page.</p>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
```

- [ ] **Step 18: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/ui/ErrorBoundary.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 19: Write the failing test for `EmptyState`**

`client/src/components/ui/EmptyState.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';
import { Button } from './Button';

describe('EmptyState', () => {
  it('renders the title, optional description, and optional action', () => {
    render(
      <EmptyState
        title="No chats yet"
        description="Start a conversation from Discover"
        action={<Button>Discover people</Button>}
      />
    );

    expect(screen.getByText('No chats yet')).toBeInTheDocument();
    expect(screen.getByText('Start a conversation from Discover')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discover people' })).toBeInTheDocument();
  });

  it('renders without description or action', () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
```

- [ ] **Step 20: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/ui/EmptyState.test.tsx`
Expected: FAIL — `EmptyState.tsx` does not exist yet.

- [ ] **Step 21: Implement `client/src/components/ui/EmptyState.tsx`**

```typescript
import { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</p>
      {description && <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 22: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/ui/EmptyState.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 23: Run the full client test suite**

Run: `cd client && npm test`
Expected: PASS (all tests so far)

- [ ] **Step 24: Commit**

```bash
git add client/src/components/ui client/src/store/toastStore.ts
git commit -m "feat(client): add shared UI kit (Button, Input, Skeleton, Toaster, ErrorBoundary, EmptyState)"
```

---

### Task 15: Login + Register pages (with TanStack Query wired into the app)

**Files:**
- Create: `client/src/validators/authSchemas.ts`
- Create: `client/src/components/layout/AuthLayout.tsx`
- Create: `client/src/pages/auth/LoginPage.tsx`
- Create: `client/src/pages/auth/RegisterPage.tsx`
- Modify: `client/src/App.tsx` (wrap the app in `QueryClientProvider`, render `<Toaster />` alongside the router)
- Modify: `client/src/routes/router.tsx` (add `/login` and `/register` under an `AuthLayout` layout route)
- Test: `client/src/pages/auth/LoginPage.test.tsx`
- Test: `client/src/pages/auth/RegisterPage.test.tsx`

**Interfaces:**
- Consumes: `Input`, `Button` (Task 14), `toast` (Task 14), `useAuthStore` (Task 12), `loginUser`, `registerUser` (Task 12)
- Produces: `loginSchema`, `LoginFormValues`, `registerSchema`, `RegisterFormValues` from `validators/authSchemas.ts`
- Produces: `AuthLayout` — a layout route component rendering `<Outlet />` inside a centered card
- Produces: `LoginPage`, `RegisterPage` — default exports

- [ ] **Step 1: Implement `client/src/validators/authSchemas.ts` (no isolated test — exercised through the page tests below)**

```typescript
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'At least 3 characters')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
  displayName: z.string().min(1, 'Display name is required').max(50),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});
export type RegisterFormValues = z.infer<typeof registerSchema>;
```

- [ ] **Step 2: Implement `client/src/components/layout/AuthLayout.tsx` (no isolated test — the page tests below render `LoginPage`/`RegisterPage` directly, bypassing this wrapper; it is a single-purpose `<Outlet />` passthrough with no logic of its own, so the risk of skipping a dedicated test is low, verified visually when running the dev server)**

```typescript
import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white/80 p-8 shadow-xl backdrop-blur dark:border-gray-800 dark:bg-gray-900/80">
        <Outlet />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write the failing test for `LoginPage`**

`client/src/pages/auth/LoginPage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from './LoginPage';
import { useAuthStore } from '../../store/authStore';

vi.mock('../../api/authApi', () => ({
  loginUser: vi.fn(),
}));

import { loginUser } from '../../api/authApi';

function renderLoginPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearAuth();
  });

  it('shows a validation error when submitting an empty form', async () => {
    renderLoginPage();
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
  });

  it('logs in and stores the user and access token on success', async () => {
    const fakeUser = { id: '1', username: 'alice', displayName: 'Alice' } as any;
    vi.mocked(loginUser).mockResolvedValue({ user: fakeUser, accessToken: 'token-abc' });

    renderLoginPage();
    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'supersecret123');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(useAuthStore.getState().accessToken).toBe('token-abc'));
    expect(useAuthStore.getState().user).toEqual(fakeUser);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/auth/LoginPage.test.tsx`
Expected: FAIL — `LoginPage.tsx` does not exist yet.

- [ ] **Step 5: Implement `client/src/pages/auth/LoginPage.tsx`**

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { loginUser } from '../../api/authApi';
import { loginSchema, LoginFormValues } from '../../validators/authSchemas';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const mutation = useMutation({
    mutationFn: loginUser,
    onSuccess: ({ user, accessToken }) => {
      setAuth(user, accessToken);
      toast.success(`Welcome back, ${user.displayName}!`);
      navigate('/dashboard');
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { error?: string } | undefined)?.error
        : undefined;
      toast.error(message ?? 'Unable to log in. Please try again.');
    },
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <h1 className="text-xl font-semibold">Log in to NearMe</h1>
      <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
      <Input label="Password" type="password" error={errors.password?.message} {...register('password')} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('rememberMe')} />
        Remember me
      </label>
      <Button type="submit" isLoading={mutation.isPending}>
        Log in
      </Button>
      <div className="flex justify-between text-sm">
        <Link to="/forgot-password" className="text-indigo-600 hover:underline">
          Forgot password?
        </Link>
        <Link to="/register" className="text-indigo-600 hover:underline">
          Create an account
        </Link>
      </div>
    </form>
  );
}
```

- [ ] **Step 6: Wire `QueryClientProvider` and `Toaster` into `client/src/App.tsx`**

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import router from './routes/router';
import { Toaster } from './components/ui/Toaster';
import './store/themeStore';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 7: Add the `/login` route to `client/src/routes/router.tsx`**

```typescript
import { createBrowserRouter } from 'react-router-dom';
import AuthLayout from '../components/layout/AuthLayout';
import LoginPage from '../pages/auth/LoginPage';

const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    path: '/',
    element: <div className="p-8 text-2xl font-semibold">NearMe — more coming soon</div>,
  },
]);

export default router;
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/auth/LoginPage.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 9: Write the failing test for `RegisterPage`**

`client/src/pages/auth/RegisterPage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RegisterPage from './RegisterPage';

vi.mock('../../api/authApi', () => ({
  registerUser: vi.fn(),
}));

import { registerUser } from '../../api/authApi';

function renderRegisterPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a validation error for a too-short password', async () => {
    renderRegisterPage();
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('At least 8 characters')).toBeInTheDocument();
  });

  it('submits registration with the entered values', async () => {
    const fakeUser = { id: '1', username: 'bob', displayName: 'Bob' } as any;
    vi.mocked(registerUser).mockResolvedValue({ user: fakeUser });

    renderRegisterPage();
    await userEvent.type(screen.getByLabelText('Username'), 'bob');
    await userEvent.type(screen.getByLabelText('Display name'), 'Bob');
    await userEvent.type(screen.getByLabelText('Email'), 'bob@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'supersecret123');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(registerUser).toHaveBeenCalledWith({
        username: 'bob',
        displayName: 'Bob',
        email: 'bob@example.com',
        password: 'supersecret123',
      })
    );
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/auth/RegisterPage.test.tsx`
Expected: FAIL — `RegisterPage.tsx` does not exist yet.

- [ ] **Step 11: Implement `client/src/pages/auth/RegisterPage.tsx`**

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { toast } from '../../store/toastStore';
import { registerUser } from '../../api/authApi';
import { registerSchema, RegisterFormValues } from '../../validators/authSchemas';

export default function RegisterPage() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const mutation = useMutation({
    mutationFn: registerUser,
    onSuccess: () => {
      toast.success('Check your email to verify your account.');
      navigate('/login');
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { error?: string } | undefined)?.error
        : undefined;
      toast.error(message ?? 'Unable to register. Please try again.');
    },
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <h1 className="text-xl font-semibold">Create your NearMe account</h1>
      <Input label="Username" error={errors.username?.message} {...register('username')} />
      <Input label="Display name" error={errors.displayName?.message} {...register('displayName')} />
      <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
      <Input label="Password" type="password" error={errors.password?.message} {...register('password')} />
      <Button type="submit" isLoading={mutation.isPending}>
        Create account
      </Button>
      <p className="text-sm">
        Already have an account?{' '}
        <Link to="/login" className="text-indigo-600 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 12: Add the `/register` route to `client/src/routes/router.tsx`**

```typescript
import RegisterPage from '../pages/auth/RegisterPage'; // add to existing import line

// add '/register' alongside '/login' in the AuthLayout route's children:
children: [
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
],
```

- [ ] **Step 13: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/auth/RegisterPage.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 14: Run the full client test suite**

Run: `cd client && npm test`
Expected: PASS (all tests so far)

- [ ] **Step 15: Commit**

```bash
git add client/src/validators client/src/components/layout/AuthLayout.tsx client/src/pages/auth/LoginPage.tsx client/src/pages/auth/RegisterPage.tsx client/src/pages/auth/LoginPage.test.tsx client/src/pages/auth/RegisterPage.test.tsx client/src/App.tsx client/src/routes/router.tsx
git commit -m "feat(client): add Login and Register pages with TanStack Query wired in"
```

---

### Task 16: Forgot Password, Reset Password, and Verify Email pages

**Files:**
- Modify: `client/src/validators/authSchemas.ts` (add `forgotPasswordSchema`, `resetPasswordSchema`)
- Create: `client/src/pages/auth/ForgotPasswordPage.tsx`
- Create: `client/src/pages/auth/ResetPasswordPage.tsx`
- Create: `client/src/pages/auth/VerifyEmailPage.tsx`
- Modify: `client/src/routes/router.tsx` (add the three routes under `AuthLayout`)
- Test: `client/src/pages/auth/ForgotPasswordPage.test.tsx`
- Test: `client/src/pages/auth/ResetPasswordPage.test.tsx`
- Test: `client/src/pages/auth/VerifyEmailPage.test.tsx`

**Interfaces:**
- Consumes: `forgotPassword`, `resetPassword`, `verifyEmail` (Task 12)
- Produces: `forgotPasswordSchema`, `resetPasswordSchema` (with a `confirmPassword` refinement) added to `authSchemas.ts`
- Produces: `ForgotPasswordPage`, `ResetPasswordPage`, `VerifyEmailPage` — default exports

- [ ] **Step 1: Add schemas to `client/src/validators/authSchemas.ts`**

```typescript
export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email'),
});
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
```

- [ ] **Step 2: Write the failing test for `ForgotPasswordPage`**

`client/src/pages/auth/ForgotPasswordPage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ForgotPasswordPage from './ForgotPasswordPage';

vi.mock('../../api/authApi', () => ({
  forgotPassword: vi.fn(),
}));

import { forgotPassword } from '../../api/authApi';

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a generic confirmation message after submitting, regardless of whether the account exists', async () => {
    vi.mocked(forgotPassword).mockResolvedValue({
      message: 'If an account exists for that email, a reset link has been sent.',
    });

    renderPage();
    await userEvent.type(screen.getByLabelText('Email'), 'someone@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(
      await screen.findByText(/if an account exists for that email/i)
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/auth/ForgotPasswordPage.test.tsx`
Expected: FAIL — `ForgotPasswordPage.tsx` does not exist yet.

- [ ] **Step 4: Implement `client/src/pages/auth/ForgotPasswordPage.tsx`**

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { forgotPassword } from '../../api/authApi';
import { forgotPasswordSchema, ForgotPasswordFormValues } from '../../validators/authSchemas';

export default function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  const mutation = useMutation({
    mutationFn: (values: ForgotPasswordFormValues) => forgotPassword(values.email),
  });

  if (mutation.isSuccess) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">{mutation.data.message}</p>
        <Link to="/login" className="text-indigo-600 hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <h1 className="text-xl font-semibold">Reset your password</h1>
      <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
      <Button type="submit" isLoading={mutation.isPending}>
        Send reset link
      </Button>
      <Link to="/login" className="text-sm text-indigo-600 hover:underline">
        Back to login
      </Link>
    </form>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/auth/ForgotPasswordPage.test.tsx`
Expected: PASS

- [ ] **Step 6: Write the failing test for `ResetPasswordPage`**

`client/src/pages/auth/ResetPasswordPage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ResetPasswordPage from './ResetPasswordPage';

vi.mock('../../api/authApi', () => ({
  resetPassword: vi.fn(),
}));

import { resetPassword } from '../../api/authApi';

function renderPage(initialEntry: string) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <ResetPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ResetPasswordPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a mismatch error when passwords do not match', async () => {
    renderPage('/reset-password?token=abc123');
    await userEvent.type(screen.getByLabelText('New password'), 'password-one');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'password-two');
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
  });

  it('submits the token from the URL with the new password', async () => {
    vi.mocked(resetPassword).mockResolvedValue({ message: 'Password reset successfully' });

    renderPage('/reset-password?token=abc123');
    await userEvent.type(screen.getByLabelText('New password'), 'brand-new-pass');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'brand-new-pass');
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(resetPassword).toHaveBeenCalledWith({ token: 'abc123', password: 'brand-new-pass' });
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/auth/ResetPasswordPage.test.tsx`
Expected: FAIL — `ResetPasswordPage.tsx` does not exist yet.

- [ ] **Step 8: Implement `client/src/pages/auth/ResetPasswordPage.tsx`**

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { toast } from '../../store/toastStore';
import { resetPassword } from '../../api/authApi';
import { resetPasswordSchema, ResetPasswordFormValues } from '../../validators/authSchemas';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) });

  const mutation = useMutation({
    mutationFn: (values: ResetPasswordFormValues) => resetPassword({ token, password: values.password }),
    onSuccess: () => {
      toast.success('Password reset. Please log in.');
      navigate('/login');
    },
    onError: () => {
      toast.error('That reset link is invalid or has expired.');
    },
  });

  if (!token) {
    return <p className="text-sm text-red-600">This reset link is missing a token.</p>;
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <Input
        label="New password"
        type="password"
        error={errors.password?.message}
        {...register('password')}
      />
      <Input
        label="Confirm password"
        type="password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
      <Button type="submit" isLoading={mutation.isPending}>
        Reset password
      </Button>
      <Link to="/login" className="text-sm text-indigo-600 hover:underline">
        Back to login
      </Link>
    </form>
  );
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/auth/ResetPasswordPage.test.tsx`
Expected: PASS

- [ ] **Step 10: Write the failing test for `VerifyEmailPage`**

`client/src/pages/auth/VerifyEmailPage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import VerifyEmailPage from './VerifyEmailPage';

vi.mock('../../api/authApi', () => ({
  verifyEmail: vi.fn(),
}));

import { verifyEmail } from '../../api/authApi';

function renderPage(initialEntry: string) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <VerifyEmailPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('VerifyEmailPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a success message once verification completes', async () => {
    vi.mocked(verifyEmail).mockResolvedValue({ user: { displayName: 'Alice' } as any });
    renderPage('/verify-email?token=abc123');
    expect(await screen.findByText(/email verified/i)).toBeInTheDocument();
    expect(verifyEmail).toHaveBeenCalledWith('abc123');
  });

  it('shows an error message when verification fails', async () => {
    vi.mocked(verifyEmail).mockRejectedValue(new Error('invalid token'));
    renderPage('/verify-email?token=bad-token');
    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 11: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/auth/VerifyEmailPage.test.tsx`
Expected: FAIL — `VerifyEmailPage.tsx` does not exist yet.

- [ ] **Step 12: Implement `client/src/pages/auth/VerifyEmailPage.tsx`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Skeleton } from '../../components/ui/Skeleton';
import { verifyEmail } from '../../api/authApi';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const query = useQuery({
    queryKey: ['verify-email', token],
    queryFn: () => verifyEmail(token),
    enabled: Boolean(token),
    retry: false,
  });

  if (!token) {
    return <p className="text-sm text-red-600">This verification link is missing a token.</p>;
  }

  if (query.isPending) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (query.isError) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Verification failed</h1>
        <p className="text-sm text-red-600">This link is invalid or has expired.</p>
        <Link to="/login" className="text-indigo-600 hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Email verified</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Your email address has been confirmed. You can now log in.
      </p>
      <Link to="/login" className="text-indigo-600 hover:underline">
        Go to login
      </Link>
    </div>
  );
}
```

- [ ] **Step 13: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/auth/VerifyEmailPage.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 14: Add the three routes to `client/src/routes/router.tsx`**

```typescript
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage'; // add to imports
import ResetPasswordPage from '../pages/auth/ResetPasswordPage'; // add to imports
import VerifyEmailPage from '../pages/auth/VerifyEmailPage'; // add to imports

// extend the AuthLayout route's children:
children: [
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/verify-email', element: <VerifyEmailPage /> },
],
```

- [ ] **Step 15: Run the full client test suite**

Run: `cd client && npm test`
Expected: PASS (all tests so far)

- [ ] **Step 16: Commit**

```bash
git add client/src/validators/authSchemas.ts client/src/pages/auth client/src/routes/router.tsx
git commit -m "feat(client): add Forgot Password, Reset Password, and Verify Email pages"
```

---

### Task 17: Google login button (disabled until a client-side Client ID is configured)

**Files:**
- Create: `client/src/components/auth/GoogleButton.tsx`
- Modify: `client/index.html` (add the Google Identity Services script tag)
- Modify: `client/.env.example` (document `VITE_GOOGLE_CLIENT_ID`)
- Modify: `client/src/pages/auth/LoginPage.tsx` (render `<GoogleButton />` below the form)
- Modify: `client/src/pages/auth/RegisterPage.tsx` (render `<GoogleButton />` below the form)
- Test: `client/src/components/auth/GoogleButton.test.tsx`

**Interfaces:**
- Consumes: `googleLogin` (Task 12), `useAuthStore` (Task 12), `toast` (Task 14)
- Produces: `GoogleButton` (named export) — reads `import.meta.env.VITE_GOOGLE_CLIENT_ID` at module load; renders a disabled button with a tooltip when unset, or initializes Google's real button when set

- [ ] **Step 1: Add the Google Identity Services script to `client/index.html`**

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

Add this line inside `<head>`, alongside the existing `<meta>` tags. It only defines `window.google` — it does nothing unless a page actually calls `window.google.accounts.id.initialize(...)`.

- [ ] **Step 2: Document the new env var in `client/.env.example`**

```
VITE_API_BASE_URL=http://localhost:4000/api/v1
# VITE_GOOGLE_CLIENT_ID=set-this-to-enable-the-real-Google-button
```

- [ ] **Step 3: Write the failing test for `GoogleButton`**

`client/src/components/auth/GoogleButton.test.tsx`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentType } from 'react';

function renderWithProviders(Component: ComponentType) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('GoogleButton', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete (window as unknown as { google?: unknown }).google;
  });

  it('renders a disabled button with an explanatory tooltip when no client ID is configured', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    vi.resetModules();
    const { GoogleButton } = await import('./GoogleButton');

    renderWithProviders(GoogleButton);

    const button = screen.getByRole('button', { name: 'Continue with Google' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Google login is not configured yet');
  });

  it('initializes and renders the real Google button when a client ID is configured', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');
    const initialize = vi.fn();
    const renderButton = vi.fn();
    (window as unknown as { google: unknown }).google = { accounts: { id: { initialize, renderButton } } };
    vi.resetModules();
    const { GoogleButton } = await import('./GoogleButton');

    renderWithProviders(GoogleButton);

    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'test-client-id.apps.googleusercontent.com' })
    );
    expect(renderButton).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/auth/GoogleButton.test.tsx`
Expected: FAIL — `GoogleButton.tsx` does not exist yet.

- [ ] **Step 5: Implement `client/src/components/auth/GoogleButton.tsx`**

```typescript
import { useEffect, useId, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { googleLogin } from '../../api/authApi';
import { toast } from '../../store/toastStore';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: { theme: string; size: string }) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export function GoogleButton() {
  const containerId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const mutation = useMutation({
    mutationFn: googleLogin,
    onSuccess: ({ user, accessToken }) => {
      setAuth(user, accessToken);
      toast.success(`Welcome, ${user.displayName}!`);
      navigate('/dashboard');
    },
    onError: () => toast.error('Google sign-in failed. Please try again.'),
  });

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !window.google || !containerRef.current) {
      return;
    }
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => mutation.mutate(response.credential),
    });
    window.google.accounts.id.renderButton(containerRef.current, { theme: 'outline', size: 'large' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <button
        type="button"
        disabled
        title="Google login is not configured yet"
        className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-400 dark:border-gray-700"
      >
        Continue with Google
      </button>
    );
  }

  return <div ref={containerRef} id={containerId} />;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/auth/GoogleButton.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 7: Add `<GoogleButton />` below the form in `LoginPage` and `RegisterPage`**

In `client/src/pages/auth/LoginPage.tsx`, import and render it just before the closing `</form>`:

```typescript
import { GoogleButton } from '../../components/auth/GoogleButton'; // add to imports

// inside the JSX, immediately before the closing </form>:
<div className="my-2 text-center text-xs uppercase text-gray-400">or</div>
<GoogleButton />
```

Apply the identical change to `client/src/pages/auth/RegisterPage.tsx`.

- [ ] **Step 8: Run the full client test suite**

Run: `cd client && npm test`
Expected: PASS (all tests so far — the existing `LoginPage.test.tsx`/`RegisterPage.test.tsx` still pass since `GoogleButton` renders its disabled state by default with no `VITE_GOOGLE_CLIENT_ID` set in the test environment)

- [ ] **Step 9: Commit**

```bash
git add client/index.html client/.env.example client/src/components/auth/GoogleButton.tsx client/src/components/auth/GoogleButton.test.tsx client/src/pages/auth/LoginPage.tsx client/src/pages/auth/RegisterPage.tsx
git commit -m "feat(client): add Google login button, disabled until VITE_GOOGLE_CLIENT_ID is set"
```

---

### Task 18: Auto-login on app load + ProtectedRoute

**Files:**
- Create: `client/src/hooks/useAuthBootstrap.ts`
- Create: `client/src/components/auth/ProtectedRoute.tsx`
- Modify: `client/src/App.tsx` (gate rendering on bootstrap completing; wrap the routed tree in the `ErrorBoundary` from Task 14, which existed but was never mounted anywhere until now)
- Modify: `client/src/App.test.tsx` (mock the refresh call the bootstrap now performs)
- Test: `client/src/hooks/useAuthBootstrap.test.ts`
- Test: `client/src/components/auth/ProtectedRoute.test.tsx`

**Interfaces:**
- Consumes: `apiClient` (Task 12), `useAuthStore` (Task 12), `ErrorBoundary` (Task 14)
- Produces: `useAuthBootstrap(): boolean` — on mount, silently calls `POST /auth/refresh` then `GET /users/me`; populates `useAuthStore` on success; returns `true` while in flight and `false` once settled (success or failure)
- Produces: `ProtectedRoute` (default export) — a layout route component that renders `<Outlet />` when `useAuthStore().user` is set, or redirects to `/login` otherwise

- [ ] **Step 1: Write the failing test for `useAuthBootstrap`**

`client/src/hooks/useAuthBootstrap.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../api/axiosClient';
import { useAuthStore } from '../store/authStore';
import { useAuthBootstrap } from './useAuthBootstrap';

describe('useAuthBootstrap', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    useAuthStore.getState().clearAuth();
  });

  afterEach(() => {
    mock.restore();
  });

  it('logs the user in silently when a valid refresh cookie exists', async () => {
    mock.onPost('/auth/refresh').reply(200, { accessToken: 'fresh-token' });
    mock.onGet('/users/me').reply(200, { user: { id: '1', username: 'alice' } });

    const { result } = renderHook(() => useAuthBootstrap());
    expect(result.current).toBe(true);

    await waitFor(() => expect(result.current).toBe(false));
    expect(useAuthStore.getState().accessToken).toBe('fresh-token');
    expect(useAuthStore.getState().user?.username).toBe('alice');
  });

  it('leaves the user logged out when there is no valid session', async () => {
    mock.onPost('/auth/refresh').reply(401);

    const { result } = renderHook(() => useAuthBootstrap());
    await waitFor(() => expect(result.current).toBe(false));

    expect(useAuthStore.getState().user).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/hooks/useAuthBootstrap.test.ts`
Expected: FAIL — `useAuthBootstrap.ts` does not exist yet.

- [ ] **Step 3: Implement `client/src/hooks/useAuthBootstrap.ts`**

```typescript
import { useEffect, useState } from 'react';
import { apiClient } from '../api/axiosClient';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types/user';

export function useAuthBootstrap(): boolean {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const refreshRes = await apiClient.post<{ accessToken: string }>('/auth/refresh');
        const accessToken = refreshRes.data.accessToken;
        const meRes = await apiClient.get<{ user: User }>('/users/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!cancelled) {
          setAuth(meRes.data.user, accessToken);
        }
      } catch {
        // No valid session — the user remains logged out; this is expected on a first visit.
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [setAuth]);

  return isBootstrapping;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/hooks/useAuthBootstrap.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing test for `ProtectedRoute`**

`client/src/components/auth/ProtectedRoute.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { useAuthStore } from '../../store/authStore';

function renderWithRoute(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        element: <ProtectedRoute />,
        children: [{ path: '/dashboard', element: <div>Dashboard content</div> }],
      },
      { path: '/login', element: <div>Login page</div> },
    ],
    { initialEntries: [initialPath] }
  );
  return render(<RouterProvider router={router} />);
}

describe('ProtectedRoute', () => {
  it('redirects to /login when there is no authenticated user', () => {
    useAuthStore.getState().clearAuth();
    renderWithRoute('/dashboard');
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('renders the protected content when a user is authenticated', () => {
    useAuthStore.getState().setAuth({ id: '1', username: 'test' } as any, 'token');
    renderWithRoute('/dashboard');
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/auth/ProtectedRoute.test.tsx`
Expected: FAIL — `ProtectedRoute.tsx` does not exist yet.

- [ ] **Step 7: Implement `client/src/components/auth/ProtectedRoute.tsx`**

```typescript
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function ProtectedRoute() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/auth/ProtectedRoute.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 9: Gate `client/src/App.tsx` on the bootstrap check**

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import router from './routes/router';
import { Toaster } from './components/ui/Toaster';
import { Skeleton } from './components/ui/Skeleton';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { useAuthBootstrap } from './hooks/useAuthBootstrap';
import './store/themeStore';

const queryClient = new QueryClient();

function AppContent() {
  const isBootstrapping = useAuthBootstrap();

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
```

This makes `ErrorBoundary` (built and unit-tested in Task 14, but not wired into the app until now) the outermost catch-all for render errors anywhere in the routed page tree.

- [ ] **Step 10: Update `client/src/App.test.tsx` to account for the async bootstrap check**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from './api/axiosClient';
import App from './App';

describe('App', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onPost('/auth/refresh').reply(401);
  });

  afterEach(() => {
    mock.restore();
  });

  it('renders the NearMe placeholder home route once the session check completes', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText(/nearme/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 11: Run the full client test suite**

Run: `cd client && npm test`
Expected: PASS (all tests so far)

- [ ] **Step 12: Commit**

```bash
git add client/src/hooks client/src/components/auth/ProtectedRoute.tsx client/src/components/auth/ProtectedRoute.test.tsx client/src/App.tsx client/src/App.test.tsx
git commit -m "feat(client): add silent auto-login on app load and a ProtectedRoute guard"
```

---

### Task 19: Profile page

**Files:**
- Create: `client/src/api/userApi.ts`
- Create: `client/src/validators/userSchemas.ts`
- Create: `client/src/pages/ProfilePage.tsx`
- Modify: `client/src/routes/router.tsx` (add a `ProtectedRoute` layout route with `/profile` as its first child)
- Test: `client/src/api/userApi.test.ts`
- Test: `client/src/pages/ProfilePage.test.tsx`

**Interfaces:**
- Produces from `userApi.ts`: `getMe(): Promise<{user: User}>`, `UpdateProfileInput` type, `updateMe(input: UpdateProfileInput): Promise<{user: User}>`
- Produces: `profileFormSchema`, `ProfileFormValues` from `validators/userSchemas.ts`
- Produces: `ProfilePage` — default export

- [ ] **Step 1: Implement `client/src/api/userApi.ts`**

```typescript
import { apiClient } from './axiosClient';
import type { User } from '../types/user';

export async function getMe(): Promise<{ user: User }> {
  const res = await apiClient.get<{ user: User }>('/users/me');
  return res.data;
}

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  gender?: string;
  age?: number;
  country?: string;
  city?: string;
  interests?: string[];
  languages?: string[];
}

export async function updateMe(input: UpdateProfileInput): Promise<{ user: User }> {
  const res = await apiClient.patch<{ user: User }>('/users/me', input);
  return res.data;
}
```

- [ ] **Step 2: Write and run the test for `userApi`**

`ProfilePage.test.tsx` (below) mocks `../api/userApi` entirely, so — same reasoning as `authApi` in Task 12 — the real implementation needs its own direct test against a mocked HTTP layer. This file grows again in Task 20 when `changePassword`, `getSettings`, and `updateSettings` are added.

`client/src/api/userApi.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from './axiosClient';
import { getMe, updateMe } from './userApi';

describe('userApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });

  afterEach(() => {
    mock.restore();
  });

  it('getMe fetches /users/me', async () => {
    mock.onGet('/users/me').reply(200, { user: { id: '1', username: 'alice' } });
    const result = await getMe();
    expect(result.user).toEqual({ id: '1', username: 'alice' });
  });

  it('updateMe patches /users/me with the given fields', async () => {
    const input = { displayName: 'New Name', interests: ['chess'] };
    mock.onPatch('/users/me', input).reply(200, { user: { id: '1', displayName: 'New Name' } });
    const result = await updateMe(input);
    expect(result.user.displayName).toBe('New Name');
  });
});
```

Run: `cd client && npx vitest run src/api/userApi.test.ts`
Expected: PASS (2 tests) — the implementation from Step 1 already satisfies this contract.

- [ ] **Step 3: Implement `client/src/validators/userSchemas.ts` (no isolated test — exercised through the page test below, since `ProfilePage` uses this schema directly rather than through a mocked module)**

```typescript
import { z } from 'zod';

export const profileFormSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(50),
  bio: z.string().max(300).optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'non-binary', 'prefer-not-to-say']).optional().or(z.literal('')),
  age: z
    .string()
    .optional()
    .refine((val) => !val || (Number(val) >= 13 && Number(val) <= 120), 'Age must be between 13 and 120'),
  country: z.string().max(60).optional().or(z.literal('')),
  city: z.string().max(60).optional().or(z.literal('')),
  interests: z.string().optional(),
  languages: z.string().optional(),
});
export type ProfileFormValues = z.infer<typeof profileFormSchema>;
```

- [ ] **Step 4: Write the failing test for `ProfilePage`**

`client/src/pages/ProfilePage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProfilePage from './ProfilePage';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types/user';

vi.mock('../api/userApi', () => ({
  getMe: vi.fn(),
  updateMe: vi.fn(),
}));

import { getMe, updateMe } from '../api/userApi';

const fakeUser: User = {
  id: '1',
  username: 'alice',
  displayName: 'Alice',
  email: 'alice@example.com',
  avatarUrl: '',
  bio: '',
  interests: ['chess'],
  languages: ['en'],
  role: 'user',
  status: 'active',
  theme: 'system',
  emailVerifiedAt: null,
  createdAt: new Date().toISOString(),
  privacy: {
    hideOnlineStatus: false,
    hideDistance: false,
    hideProfile: false,
    invisibleMode: false,
    privateAccount: false,
  },
};

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfilePage />
    </QueryClientProvider>
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().setAuth(fakeUser, 'token-abc');
  });

  it('loads and displays the current profile', async () => {
    vi.mocked(getMe).mockResolvedValue({ user: fakeUser });
    renderPage();
    expect(await screen.findByDisplayValue('Alice')).toBeInTheDocument();
  });

  it('submits updated fields', async () => {
    vi.mocked(getMe).mockResolvedValue({ user: fakeUser });
    vi.mocked(updateMe).mockResolvedValue({ user: { ...fakeUser, displayName: 'Alice Updated' } });

    renderPage();
    const displayNameInput = await screen.findByDisplayValue('Alice');
    await userEvent.clear(displayNameInput);
    await userEvent.type(displayNameInput, 'Alice Updated');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateMe).toHaveBeenCalled());
  });

  it('shows an empty state when the profile fails to load', async () => {
    vi.mocked(getMe).mockRejectedValue(new Error('network error'));
    renderPage();
    expect(await screen.findByText(/couldn't load your profile/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/ProfilePage.test.tsx`
Expected: FAIL — `ProfilePage.tsx` does not exist yet.

- [ ] **Step 6: Implement `client/src/pages/ProfilePage.tsx`**

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { toast } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';
import { getMe, updateMe } from '../api/userApi';
import { profileFormSchema, ProfileFormValues } from '../validators/userSchemas';
import type { User } from '../types/user';

function toFormValues(user: User): ProfileFormValues {
  return {
    displayName: user.displayName,
    bio: user.bio ?? '',
    gender: (user.gender as ProfileFormValues['gender']) ?? '',
    age: user.age ? String(user.age) : '',
    country: user.country ?? '',
    city: user.city ?? '',
    interests: user.interests.join(', '),
    languages: user.languages.join(', '),
  };
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((state) => state.setAuth);
  const accessToken = useAuthStore((state) => state.accessToken);

  const query = useQuery({ queryKey: ['me'], queryFn: getMe });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    values: query.data ? toFormValues(query.data.user) : undefined,
  });

  const mutation = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      updateMe({
        displayName: values.displayName,
        bio: values.bio || undefined,
        gender: values.gender || undefined,
        age: values.age ? Number(values.age) : undefined,
        country: values.country || undefined,
        city: values.city || undefined,
        interests: values.interests
          ? values.interests.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        languages: values.languages
          ? values.languages.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
      }),
    onSuccess: ({ user }) => {
      if (accessToken) {
        setAuth(user, accessToken);
      }
      queryClient.setQueryData(['me'], { user });
      reset(toFormValues(user));
      toast.success('Profile updated');
    },
    onError: () => toast.error('Unable to update profile. Please try again.'),
  });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <EmptyState
        title="Couldn't load your profile"
        description="Something went wrong fetching your profile. Please try refreshing the page."
      />
    );
  }

  return (
    <form
      className="flex max-w-lg flex-col gap-4 p-6"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      <h1 className="text-xl font-semibold">Your profile</h1>
      <Input label="Display name" error={errors.displayName?.message} {...register('displayName')} />
      <Input label="Bio" error={errors.bio?.message} {...register('bio')} />
      <div className="flex flex-col gap-1">
        <label htmlFor="gender" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Gender
        </label>
        <select
          id="gender"
          {...register('gender')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="">Prefer not to say</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="non-binary">Non-binary</option>
          <option value="prefer-not-to-say">Prefer not to say</option>
        </select>
      </div>
      <Input label="Age" type="number" error={errors.age?.message} {...register('age')} />
      <Input label="Country" error={errors.country?.message} {...register('country')} />
      <Input label="City" error={errors.city?.message} {...register('city')} />
      <Input label="Interests (comma-separated)" error={errors.interests?.message} {...register('interests')} />
      <Input label="Languages (comma-separated)" error={errors.languages?.message} {...register('languages')} />
      <Button type="submit" isLoading={mutation.isPending} disabled={!isDirty}>
        Save changes
      </Button>
    </form>
  );
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/ProfilePage.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 8: Add the `ProtectedRoute` layout route with `/profile` to `client/src/routes/router.tsx`**

```typescript
import ProtectedRoute from '../components/auth/ProtectedRoute'; // add to imports
import ProfilePage from '../pages/ProfilePage'; // add to imports

// add as a new top-level route entry, alongside the AuthLayout route and the '/' placeholder:
{
  element: <ProtectedRoute />,
  children: [{ path: '/profile', element: <ProfilePage /> }],
},
```

- [ ] **Step 9: Run the full client test suite**

Run: `cd client && npm test`
Expected: PASS (all tests so far)

- [ ] **Step 10: Commit**

```bash
git add client/src/api/userApi.ts client/src/api/userApi.test.ts client/src/validators/userSchemas.ts client/src/pages/ProfilePage.tsx client/src/pages/ProfilePage.test.tsx client/src/routes/router.tsx
git commit -m "feat(client): add Profile page with editable fields"
```

---

### Task 20: Settings page (tabs: Profile / Password / Privacy / Theme)

**Files:**
- Modify: `client/src/api/userApi.ts` (add `changePassword`, `getSettings`, `updateSettings`)
- Modify: `client/src/api/userApi.test.ts` (add coverage for the three new functions)
- Modify: `client/src/validators/userSchemas.ts` (add `changePasswordFormSchema`)
- Create: `client/src/pages/settings/SettingsPage.tsx`
- Modify: `client/src/routes/router.tsx` (add `/settings` to the `ProtectedRoute` layout route's children)
- Test: `client/src/pages/settings/SettingsPage.test.tsx`

**Interfaces:**
- Consumes: `useThemeStore` (Task 13), `PrivacySettings` (Task 12)
- Produces from `userApi.ts`: `ChangePasswordInput`, `changePassword(input): Promise<{message: string}>`; `SettingsPayload = {theme, privacy}`, `getSettings(): Promise<SettingsPayload>`; `UpdateSettingsInput = {theme?, privacy?: Partial<PrivacySettings>}`, `updateSettings(input): Promise<SettingsPayload>`
- Produces: `changePasswordFormSchema`, `ChangePasswordFormValues` from `userSchemas.ts`
- Produces: `SettingsPage` — default export, with tab-switching state entirely local (no routing per tab)

- [ ] **Step 1: Add functions to `client/src/api/userApi.ts`**

```typescript
import type { PrivacySettings } from '../types/user'; // add to existing import line

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export async function changePassword(input: ChangePasswordInput): Promise<{ message: string }> {
  const res = await apiClient.patch<{ message: string }>('/users/me/password', input);
  return res.data;
}

export interface SettingsPayload {
  theme: 'light' | 'dark' | 'system';
  privacy: PrivacySettings;
}

export async function getSettings(): Promise<SettingsPayload> {
  const res = await apiClient.get<SettingsPayload>('/users/me/settings');
  return res.data;
}

export interface UpdateSettingsInput {
  theme?: 'light' | 'dark' | 'system';
  privacy?: Partial<PrivacySettings>;
}

export async function updateSettings(input: UpdateSettingsInput): Promise<SettingsPayload> {
  const res = await apiClient.patch<SettingsPayload>('/users/me/settings', input);
  return res.data;
}
```

- [ ] **Step 2: Extend `client/src/api/userApi.test.ts` (created in Task 19) with the three new functions**

`SettingsPage.test.tsx` (below) mocks `../../api/userApi` entirely, same as `ProfilePage.test.tsx` did in Task 19 — so these three new functions need the same direct-against-mocked-HTTP coverage `getMe`/`updateMe` already have. Add to the existing `describe('userApi', ...)` block in `client/src/api/userApi.test.ts`:

```typescript
import { changePassword, getSettings, updateSettings } from './userApi'; // add to the existing import line

// add inside the existing describe('userApi', ...) block:
it('changePassword patches /users/me/password', async () => {
  const input = { currentPassword: 'old-pass', newPassword: 'new-pass' };
  mock.onPatch('/users/me/password', input).reply(200, { message: 'updated' });
  const result = await changePassword(input);
  expect(result.message).toBe('updated');
});

it('getSettings fetches /users/me/settings', async () => {
  const payload = {
    theme: 'dark',
    privacy: {
      hideOnlineStatus: false,
      hideDistance: false,
      hideProfile: false,
      invisibleMode: false,
      privateAccount: false,
    },
  };
  mock.onGet('/users/me/settings').reply(200, payload);
  const result = await getSettings();
  expect(result).toEqual(payload);
});

it('updateSettings patches /users/me/settings with the given fields', async () => {
  mock
    .onPatch('/users/me/settings', { privacy: { invisibleMode: true } })
    .reply(200, { theme: 'system', privacy: { invisibleMode: true } });
  const result = await updateSettings({ privacy: { invisibleMode: true } });
  expect(result.privacy.invisibleMode).toBe(true);
});
```

Run: `cd client && npx vitest run src/api/userApi.test.ts`
Expected: PASS (5 tests total — the 2 from Task 19 plus these 3)

- [ ] **Step 3: Add `changePasswordFormSchema` to `client/src/validators/userSchemas.ts`**

```typescript
export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'At least 8 characters'),
    confirmNewPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  });
export type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;
```

- [ ] **Step 4: Write the failing test for `SettingsPage`**

`client/src/pages/settings/SettingsPage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SettingsPage from './SettingsPage';
import { useThemeStore } from '../../store/themeStore';

vi.mock('../../api/userApi', () => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  changePassword: vi.fn(),
}));

import { getSettings, updateSettings, changePassword } from '../../api/userApi';

const fakeSettings = {
  theme: 'system' as const,
  privacy: {
    hideOnlineStatus: false,
    hideDistance: false,
    hideProfile: false,
    invisibleMode: false,
    privateAccount: false,
  },
};

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSettings).mockResolvedValue(fakeSettings);
  });

  it('switches between tabs', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Password' }));
    expect(screen.getByLabelText('Current password')).toBeInTheDocument();
  });

  it('validates and submits a password change', async () => {
    vi.mocked(changePassword).mockResolvedValue({ message: 'Password updated successfully' });
    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Password' }));

    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByText('Current password is required')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Current password'), 'old-pass-123');
    await userEvent.type(screen.getByLabelText('New password'), 'new-pass-456');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'new-pass-456');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: 'old-pass-123',
        newPassword: 'new-pass-456',
      })
    );
  });

  it('toggles a privacy setting', async () => {
    vi.mocked(updateSettings).mockResolvedValue({
      ...fakeSettings,
      privacy: { ...fakeSettings.privacy, invisibleMode: true },
    });

    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Privacy' }));
    const invisibleToggle = await screen.findByLabelText('Invisible mode');
    await userEvent.click(invisibleToggle);

    await waitFor(() =>
      expect(updateSettings).toHaveBeenCalledWith({ privacy: { invisibleMode: true } })
    );
  });

  it('switches the theme instantly and persists it', async () => {
    vi.mocked(updateSettings).mockResolvedValue({ ...fakeSettings, theme: 'dark' });

    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Theme' }));
    await userEvent.click(screen.getByRole('button', { name: 'dark' }));

    expect(useThemeStore.getState().theme).toBe('dark');
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ theme: 'dark' }));
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/settings/SettingsPage.test.tsx`
Expected: FAIL — `SettingsPage.tsx` does not exist yet.

- [ ] **Step 6: Implement `client/src/pages/settings/SettingsPage.tsx`**

```typescript
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { toast } from '../../store/toastStore';
import { useThemeStore, ThemePreference } from '../../store/themeStore';
import { getSettings, updateSettings, changePassword } from '../../api/userApi';
import { changePasswordFormSchema, ChangePasswordFormValues } from '../../validators/userSchemas';
import type { PrivacySettings } from '../../types/user';

type SettingsTab = 'profile' | 'password' | 'privacy' | 'theme';

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'password', label: 'Password' },
  { key: 'privacy', label: 'Privacy' },
  { key: 'theme', label: 'Theme' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <div role="tablist" className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-sm font-medium ${
              activeTab === tab.key
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'profile' && <ProfileTab />}
      {activeTab === 'password' && <PasswordTab />}
      {activeTab === 'privacy' && <PrivacyTab />}
      {activeTab === 'theme' && <ThemeTab />}
    </div>
  );
}

function ProfileTab() {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Edit your display name, bio, interests, and other profile details from your profile page.
      </p>
      <a href="/profile" className="w-fit text-sm text-indigo-600 hover:underline">
        Go to your profile →
      </a>
    </div>
  );
}

function PasswordTab() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({ resolver: zodResolver(changePasswordFormSchema) });

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordFormValues) =>
      changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
    onSuccess: () => {
      toast.success('Password updated');
      reset();
    },
    onError: () => toast.error('Current password is incorrect'),
  });

  return (
    <form
      className="flex max-w-sm flex-col gap-4"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      <Input
        label="Current password"
        type="password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />
      <Input
        label="New password"
        type="password"
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />
      <Input
        label="Confirm new password"
        type="password"
        error={errors.confirmNewPassword?.message}
        {...register('confirmNewPassword')}
      />
      <Button type="submit" isLoading={mutation.isPending}>
        Update password
      </Button>
    </form>
  );
}

const PRIVACY_LABELS: { key: keyof PrivacySettings; label: string }[] = [
  { key: 'hideOnlineStatus', label: 'Hide my online status' },
  { key: 'hideDistance', label: 'Hide my distance from other users' },
  { key: 'hideProfile', label: 'Hide my profile from discovery' },
  { key: 'invisibleMode', label: 'Invisible mode' },
  { key: 'privateAccount', label: 'Private account' },
];

function PrivacyTab() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['settings'], queryFn: getSettings });

  const mutation = useMutation({
    mutationFn: (privacy: Partial<PrivacySettings>) => updateSettings({ privacy }),
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      toast.success('Privacy settings updated');
    },
    onError: () => toast.error('Unable to update privacy settings'),
  });

  if (query.isPending) {
    return <Skeleton className="h-40 w-full" />;
  }
  if (query.isError || !query.data) {
    return <p className="text-sm text-red-600">Unable to load privacy settings.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {PRIVACY_LABELS.map(({ key, label }) => (
        <label key={key} className="flex items-center justify-between gap-4 text-sm">
          {label}
          <input
            type="checkbox"
            checked={query.data!.privacy[key]}
            onChange={(e) => mutation.mutate({ [key]: e.target.checked })}
          />
        </label>
      ))}
    </div>
  );
}

const THEME_OPTIONS: ThemePreference[] = ['light', 'dark', 'system'];

function ThemeTab() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  const mutation = useMutation({
    mutationFn: (nextTheme: ThemePreference) => updateSettings({ theme: nextTheme }),
    onError: () => toast.error('Unable to save your theme preference'),
  });

  function handleSelect(nextTheme: ThemePreference) {
    setTheme(nextTheme);
    mutation.mutate(nextTheme);
  }

  return (
    <div className="flex gap-3">
      {THEME_OPTIONS.map((option) => (
        <button
          key={option}
          onClick={() => handleSelect(option)}
          aria-pressed={theme === option}
          className={`rounded-xl border px-4 py-2 text-sm capitalize ${
            theme === option
              ? 'border-indigo-600 bg-indigo-50 text-indigo-600 dark:bg-indigo-950'
              : 'border-gray-300 dark:border-gray-700'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/settings/SettingsPage.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 8: Add `/settings` to the `ProtectedRoute` layout route in `client/src/routes/router.tsx`**

```typescript
import SettingsPage from '../pages/settings/SettingsPage'; // add to imports

// extend the ProtectedRoute route's children (added in Task 19):
children: [
  { path: '/profile', element: <ProfilePage /> },
  { path: '/settings', element: <SettingsPage /> },
],
```

- [ ] **Step 9: Run the full client test suite**

Run: `cd client && npm test`
Expected: PASS (all tests so far)

- [ ] **Step 10: Commit**

```bash
git add client/src/api/userApi.ts client/src/api/userApi.test.ts client/src/validators/userSchemas.ts client/src/pages/settings client/src/routes/router.tsx
git commit -m "feat(client): add tabbed Settings page (Profile/Password/Privacy/Theme)"
```

---

### Task 21: Dashboard shell + app navigation layout

**Files:**
- Create: `client/src/components/layout/AppLayout.tsx`
- Modify: `client/src/components/auth/ProtectedRoute.tsx` (wrap authenticated content in `AppLayout`)
- Create: `client/src/pages/DashboardPage.tsx`
- Modify: `client/src/routes/router.tsx` (add `/dashboard`, redirect `/` to it)
- Test: `client/src/components/layout/AppLayout.test.tsx`
- Test: `client/src/pages/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `useAuthStore` (Task 12), `logoutUser` (Task 12), `Button` (Task 14), `EmptyState` (Task 14)
- Produces: `AppLayout` — default export, props `{ children: ReactNode }`, renders a top nav (NearMe / Profile / Settings links, signed-in user's display name, a Log out button) around `children`
- Produces: `DashboardPage` — default export

- [ ] **Step 1: Write the failing test for `AppLayout`**

`client/src/components/layout/AppLayout.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AppLayout from './AppLayout';
import { useAuthStore } from '../../store/authStore';

vi.mock('../../api/authApi', () => ({
  logoutUser: vi.fn().mockResolvedValue(undefined),
}));

import { logoutUser } from '../../api/authApi';

const fakeUser = { id: '1', username: 'alice', displayName: 'Alice' } as any;

function renderLayout() {
  return render(
    <MemoryRouter>
      <AppLayout>
        <div>Page content</div>
      </AppLayout>
    </MemoryRouter>
  );
}

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().setAuth(fakeUser, 'token');
  });

  it('renders navigation, the signed-in user, and the page content', () => {
    renderLayout();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('logs out and clears the auth store', async () => {
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(logoutUser).toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/layout/AppLayout.test.tsx`
Expected: FAIL — `AppLayout.tsx` does not exist yet.

- [ ] **Step 3: Implement `client/src/components/layout/AppLayout.tsx`**

```typescript
import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../store/authStore';
import { logoutUser } from '../../api/authApi';
import { toast } from '../../store/toastStore';

export default function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  async function handleLogout() {
    try {
      await logoutUser();
    } catch {
      // Best-effort: proceed with client-side logout even if the server call fails.
    } finally {
      clearAuth();
      toast.success('Logged out');
      navigate('/login');
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link to="/dashboard">NearMe</Link>
          <Link to="/profile">Profile</Link>
          <Link to="/settings">Settings</Link>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          {user && <span>{user.displayName}</span>}
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/layout/AppLayout.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Wrap `ProtectedRoute`'s authenticated content in `AppLayout`**

`client/src/components/auth/ProtectedRoute.tsx` (full replacement):

```typescript
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import AppLayout from '../layout/AppLayout';

export default function ProtectedRoute() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
```

Run the existing `ProtectedRoute.test.tsx` from Task 18 to confirm this change doesn't break it: `cd client && npx vitest run src/components/auth/ProtectedRoute.test.tsx` — it still asserts on the presence of `'Dashboard content'` / `'Login page'` text, which remains true with the `AppLayout` wrapper added around it.

- [ ] **Step 6: Write the failing test for `DashboardPage`**

`client/src/pages/DashboardPage.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardPage from './DashboardPage';
import { useAuthStore } from '../store/authStore';

const fakeUser = { id: '1', username: 'alice', displayName: 'Alice' } as any;

describe('DashboardPage', () => {
  beforeEach(() => {
    useAuthStore.getState().setAuth(fakeUser, 'token');
  });

  it('greets the signed-in user by display name', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Welcome back, Alice!')).toBeInTheDocument();
  });

  it('shows a placeholder empty state for upcoming features', () => {
    render(<DashboardPage />);
    expect(screen.getByText('More is on the way')).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/DashboardPage.test.tsx`
Expected: FAIL — `DashboardPage.tsx` does not exist yet.

- [ ] **Step 8: Implement `client/src/pages/DashboardPage.tsx`**

```typescript
import { useAuthStore } from '../store/authStore';
import { EmptyState } from '../components/ui/EmptyState';

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="rounded-2xl border border-gray-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
        <h1 className="text-xl font-semibold">Welcome back, {user?.displayName ?? 'there'}!</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Here's your NearMe dashboard.</p>
      </div>
      <EmptyState
        title="More is on the way"
        description="Friends, nearby discovery, chat, and voice calls are coming in upcoming updates."
      />
    </div>
  );
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/DashboardPage.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 10: Add `/dashboard` to the router and redirect `/` to it**

`client/src/routes/router.tsx` (full file, replacing the placeholder root route):

```typescript
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthLayout from '../components/layout/AuthLayout';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';
import VerifyEmailPage from '../pages/auth/VerifyEmailPage';
import DashboardPage from '../pages/DashboardPage';
import ProfilePage from '../pages/ProfilePage';
import SettingsPage from '../pages/settings/SettingsPage';

const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/verify-email', element: <VerifyEmailPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
  { path: '/', element: <Navigate to="/dashboard" replace /> },
]);

export default router;
```

This consolidates every incremental router edit from Tasks 15–21 into the final routing table — replace the file's contents wholesale rather than patching it further.

- [ ] **Step 11: Run the full client test suite**

Run: `cd client && npm test`
Expected: PASS (all tests so far — this completes the client side of Phase 1)

- [ ] **Step 12: Verify the production build still succeeds**

Run: `cd client && npm run build`
Expected: build completes with no TypeScript errors

- [ ] **Step 13: Commit**

```bash
git add client/src/components/layout/AppLayout.tsx client/src/components/layout/AppLayout.test.tsx client/src/components/auth/ProtectedRoute.tsx client/src/pages/DashboardPage.tsx client/src/pages/DashboardPage.test.tsx client/src/routes/router.tsx
git commit -m "feat(client): add Dashboard shell and app navigation layout"
```

---

### Task 22: README with local dev setup instructions

**Files:**
- Create: `README.md` (repo root)

**Interfaces:** none — this is a documentation-only deliverable, verified by a read-through rather than automated tests.

- [ ] **Step 1: Write `README.md`**

```markdown
# NearMe

A social discovery and chat platform — Phase 1 (Auth + Profile Foundation) is implemented here. See `docs/superpowers/specs/2026-08-03-auth-profile-foundation-design.md` for the full design and the phase roadmap (Friends/Discovery, Chat, Voice Calls, Notifications, Admin Panel, and Deployment follow as separate phases).

## Prerequisites

- Node.js 20+
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
```

- [ ] **Step 2: Read the file back and confirm it accurately describes the commands and env vars introduced in Tasks 1–21** (no automated check — a documentation deliverable is verified by inspection)

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README with local dev setup instructions"
```

---
