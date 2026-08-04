import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const verifyIdTokenMock = vi.fn();

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(function () {
    return { verifyIdToken: verifyIdTokenMock };
  }),
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
