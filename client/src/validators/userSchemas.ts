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
