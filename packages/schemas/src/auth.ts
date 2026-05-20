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

export const enable2faSchema = z.object({
  password: z.string().min(1, 'Current password is required'),
});

export const disable2faSchema = z.object({
  password: z.string().min(1, 'Current password is required'),
});

export const regenerateBackupCodesSchema = z.object({
  password: z.string().min(1, 'Current password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const updateProfileSchema = z.object({
  displayName: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type Verify2faInput = z.infer<typeof verify2faSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type VerifyResetTokenInput = z.infer<typeof verifyResetTokenSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type Enable2faInput = z.infer<typeof enable2faSchema>;
export type Disable2faInput = z.infer<typeof disable2faSchema>;
export type RegenerateBackupCodesInput = z.infer<typeof regenerateBackupCodesSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  displayName: z.string().nullable(),
  role: z.enum(['admin']),
  twoFactorEnabled: z.boolean(),
  mustChangePassword: z.boolean(),
});

export type User = z.infer<typeof UserSchema>;

export const SessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  expiresAt: z.string().or(z.date()),
  lastActivityAt: z.string().or(z.date()),
  rememberMe: z.boolean(),
  createdAt: z.string().or(z.date()),
});

export type Session = z.infer<typeof SessionSchema>;