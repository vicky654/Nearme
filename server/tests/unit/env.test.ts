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

import { envSchema } from '../../src/config/env';

describe('env config', () => {
  it('throws when a required variable is missing', () => {
    const invalidEnv = {
      MONGODB_URI: 'mongodb://localhost:27017/nearme-test',
      // JWT_ACCESS_SECRET is missing
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      JWT_PURPOSE_SECRET: 'c'.repeat(32),
      RESEND_API_KEY: 'test-key',
      EMAIL_FROM: 'NearMe <no-reply@test.dev>',
      CLIENT_URL: 'http://localhost:5173',
    };
    expect(() => envSchema.parse(invalidEnv)).toThrow();
  });

  it('loads successfully when all required variables are present', () => {
    const validEnv = {
      NODE_ENV: 'test',
      PORT: '4000',
      MONGODB_URI: 'mongodb://localhost:27017/nearme-test',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      JWT_PURPOSE_SECRET: 'c'.repeat(32),
      RESEND_API_KEY: 'test-key',
      EMAIL_FROM: 'NearMe <no-reply@test.dev>',
      CLIENT_URL: 'http://localhost:5173',
    };

    const parsed = envSchema.parse(validEnv);
    expect(parsed.PORT).toBe(4000);
    expect(parsed.MONGODB_URI).toBe('mongodb://localhost:27017/nearme-test');
  });

  it('parses the development discovery switch as a real boolean', () => {
    const parsed = envSchema.parse({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://localhost:27017/nearme-test',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      JWT_PURPOSE_SECRET: 'c'.repeat(32),
      RESEND_API_KEY: 'test-key',
      EMAIL_FROM: 'NearMe <no-reply@test.dev>',
      CLIENT_URL: 'http://localhost:5173',
      SHOW_ALL_USERS: 'false',
    });
    expect(parsed.SHOW_ALL_USERS).toBe(false);
    expect(parsed.SEED_ADMIN).toBe(false);
  });

  it('rejects development-only discovery and implicit admin credentials in production', () => {
    const productionEnv = {
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://localhost:27017/nearme-test',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      JWT_PURPOSE_SECRET: 'c'.repeat(32),
      RESEND_API_KEY: 'test-key',
      EMAIL_FROM: 'NearMe <no-reply@test.dev>',
      CLIENT_URL: 'https://nearme.example.com',
    };

    expect(() => envSchema.parse({ ...productionEnv, SHOW_ALL_USERS: 'true' })).toThrow();
    expect(() => envSchema.parse({ ...productionEnv, SEED_ADMIN: 'true' })).toThrow();
  });
});
