import 'dotenv/config';
import { z } from 'zod';

const booleanFromEnvironment = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() === 'true' : value),
  z.boolean().optional(),
);

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
  SEED_ADMIN: booleanFromEnvironment,
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_USERNAME: z.string().min(3).max(30).optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
  // Development uses the relaxed discovery mode by default so test accounts
  // without finalized geolocation are still visible. Set SHOW_ALL_USERS=false
  // when you want to exercise production-style radius filtering locally.
  SHOW_ALL_USERS: booleanFromEnvironment,
}).transform((values) => ({
  ...values,
  SEED_ADMIN: values.SEED_ADMIN ?? values.NODE_ENV !== 'production',
  SHOW_ALL_USERS: values.SHOW_ALL_USERS ?? values.NODE_ENV === 'development',
})).superRefine((values, context) => {
  if (values.NODE_ENV !== 'production') return;
  if (values.SHOW_ALL_USERS) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['SHOW_ALL_USERS'], message: 'SHOW_ALL_USERS must be false in production' });
  }
  if (values.SEED_ADMIN && (!values.ADMIN_EMAIL || !values.ADMIN_USERNAME || !values.ADMIN_PASSWORD)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['SEED_ADMIN'], message: 'Production admin seeding requires ADMIN_EMAIL, ADMIN_USERNAME, and ADMIN_PASSWORD' });
  }
  for (const field of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'JWT_PURPOSE_SECRET'] as const) {
    if (values[field].startsWith('replace-with')) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `${field} must use a production secret` });
    }
  }
  if (values.RESEND_API_KEY.startsWith('dummy') || values.RESEND_API_KEY.startsWith('replace-with')) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['RESEND_API_KEY'], message: 'A real email provider key is required in production' });
  }
});

export const env = envSchema.parse(process.env);
export type Env = typeof env;
