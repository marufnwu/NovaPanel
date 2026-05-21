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

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const updateProfileSchema = z.object({
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type Verify2faInput = z.infer<typeof verify2faSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  locale: z.string().default('en'),
  timezone: z.string().default('UTC'),
  role: z.string(),
  twoFactorEnabled: z.boolean(),
  mustChangePassword: z.boolean(),
  lastLoginAt: z.string().or(z.date()).nullable(),
  createdAt: z.string().or(z.date()),
});

export type User = z.infer<typeof UserSchema>;

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']).default('free'),
  status: z.enum(['active', 'suspended', 'cancelled']).default('active'),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()).nullable(),
});

export type Organization = z.infer<typeof OrganizationSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  environment: z.enum(['production', 'staging', 'development']).default('production'),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()).nullable(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const LoginResponseSchema = z.object({
  sessionId: z.string(),
  sessionHash: z.string(),
  user: UserSchema,
  organizations: z.array(OrganizationSchema),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const SessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  expiresAt: z.string().or(z.date()),
  lastActivityAt: z.string().or(z.date()),
  rememberMe: z.boolean(),
  createdAt: z.string().or(z.date()),
});

export type Session = z.infer<typeof SessionSchema>;

export const PermissionSchema = z.enum([
  'sites:read', 'sites:write', 'sites:delete',
  'domains:read', 'domains:write', 'domains:delete',
  'databases:read', 'databases:write', 'databases:delete',
  'containers:read', 'containers:write', 'containers:delete',
  'files:read', 'files:write', 'files:delete',
  'settings:read', 'settings:write',
  'billing:read', 'billing:write',
  'members:read', 'members:write',
]);

export type Permission = z.infer<typeof PermissionSchema>;