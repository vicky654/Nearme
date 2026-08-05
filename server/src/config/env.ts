import 'dotenv/config';
import { z } from 'zod';

export const envSchema = z.object({
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
  CHAT_UPLOAD_DIR: z.string().optional(),
  PUBLIC_SERVER_URL: z.string().url().optional(),
  FCM_PROJECT_ID: z.string().min(1).optional(),
});

export const env = envSchema.parse(process.env);
export type Env = typeof env;
