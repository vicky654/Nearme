import { z } from 'zod';
import { sanitizeText } from '../utils/sanitize';

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).transform(sanitizeText).optional(),
  bio: z.string().max(300).transform(sanitizeText).optional(),
  gender: z.enum(['male', 'female', 'non-binary', 'prefer-not-to-say']).optional(),
  age: z.number().int().min(13).max(120).optional(),
  country: z.string().max(60).optional(),
  city: z.string().max(60).optional(),
  avatarUrl: z.string().url().max(500).optional(),
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

export const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional(),
});
