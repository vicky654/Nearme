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
