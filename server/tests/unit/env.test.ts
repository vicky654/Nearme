import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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
    vi.resetModules();
    delete process.env.JWT_ACCESS_SECRET;
    await expect(import('../../src/config/env')).rejects.toBeDefined();
  });

  it('loads successfully when all required variables are present', async () => {
    vi.resetModules();
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
