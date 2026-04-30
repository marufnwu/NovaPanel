import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

export const verify2faSchema = z.object({
  tempToken: z.string().min(1, 'Temp token is required'),
  code: z.string().min(1, '2FA code or backup code is required'),
  rememberMe: z.boolean().default(false),
});

export const enable2faResponseSchema = z.object({
  secret: z.string(),
  qrCodeUri: z.string(), // otpauth://totp/...
  manualEntryKey: z.string(),
});

export const verify2faAndEnableSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
  secret: z.string().min(1, 'Encrypted secret is required'),
});

export const disable2faSchema = z.object({
  password: z.string().min(1, 'Current password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email is required'),
});

export const verifyResetTokenSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const regenerateBackupCodesSchema = z.object({
  password: z.string().min(1, 'Current password is required'),
});

export const generateApiTokenSchema = z.object({
  name: z.string().min(1).max(50),
  expiresAt: z.string().datetime().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const changeEmailSchema = z.object({
  newEmail: z.string().email(),
  password: z.string().min(1),
});

export const updateProfileSchema = z.object({
  displayName: z.string().optional(),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type Verify2faInput = z.infer<typeof verify2faSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type VerifyResetTokenInput = z.infer<typeof verifyResetTokenSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type RegenerateBackupCodesInput = z.infer<typeof regenerateBackupCodesSchema>;
export type GenerateApiTokenInput = z.infer<typeof generateApiTokenSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
