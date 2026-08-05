import { CorsOptions } from 'cors';
import { env } from '../config/env';

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // Allow non-browser clients (Postman, mobile, server-to-server)

  const normalizedOrigin = origin.replace(/\/$/, '');
  const configuredClientUrl = env.CLIENT_URL.replace(/\/$/, '');

  if (normalizedOrigin === configuredClientUrl) {
    return true;
  }

  // Allow localhost origins in non-production
  if (env.NODE_ENV !== 'production') {
    if (
      normalizedOrigin.startsWith('http://localhost') ||
      normalizedOrigin.startsWith('http://127.0.0.1')
    ) {
      return true;
    }
  }

  // Allow Vercel production & preview deployment domains (*.vercel.app)
  if (/\.vercel\.app$/.test(normalizedOrigin)) {
    return true;
  }

  return false;
}

export const getCorsOptions = (): CorsOptions => ({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS error: Origin ${origin} not allowed by Access-Control-Allow-Origin`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Set-Cookie'],
});
