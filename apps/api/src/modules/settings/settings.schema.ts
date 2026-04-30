import { z } from 'zod';

// PUT /settings/identity
export const updateIdentitySchema = z.object({
  hostname: z.string().min(1).max(253).regex(/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/).optional(),
  domain: z.string().max(253).optional(),
});

// PUT /settings/timezone
export const updateTimezoneSchema = z.object({
  timezone: z.string().min(1),
});

// PUT /settings/backup
export const updateBackupSettingsSchema = z.object({
  backupPath: z.string().min(1).optional(),
  retentionDays: z.number().int().min(1).max(365).optional(),
  schedule: z.string().min(9).max(100).optional(),
  enabled: z.boolean().optional(),
});

// PUT /settings/security/ssh-port
export const updateSshPortSchema = z.object({
  port: z.number().int().min(1).max(65535),
});

// PUT /settings/panel
export const updatePanelSettingsSchema = z.object({
  panelUrl: z.string().url().optional(),
  adminEmail: z.string().email().optional(),
});

// PUT /settings/nameservers
export const updateNameserversSchema = z.object({
  ns1: z.string().min(1).optional(),
  ns2: z.string().min(1).optional(),
});

// PUT /settings/session
export const updateSessionSchema = z.object({
  timeout: z.number().int().min(60).max(604800).optional(), // 1 min to 7 days
});

// PUT /settings/password-policy
export const updatePasswordPolicySchema = z.object({
  minLength: z.number().int().min(4).max(128).optional(),
  requireUppercase: z.boolean().optional(),
  requireLowercase: z.boolean().optional(),
  requireNumbers: z.boolean().optional(),
  requireSpecialChars: z.boolean().optional(),
});

// PUT /settings/ssh
export const updateSshSettingsSchema = z.object({
  port: z.number().int().min(1).max(65535).optional(),
  permitRootLogin: z.boolean().optional(),
  passwordAuth: z.boolean().optional(),
  pubkeyAuth: z.boolean().optional(),
});

// PUT /settings/panel-port
export const updatePanelPortSchema = z.object({
  port: z.number().int().min(1).max(65535),
});

// PUT /settings/default-webserver
export const updateDefaultWebserverSchema = z.object({
  mode: z.enum(['nginx', 'apache', 'nginx+apache']),
});

// PUT /settings/ssl-email
export const updateSslEmailSchema = z.object({
  email: z.string().email(),
});

// PUT /settings/maintenance
export const updateMaintenanceSchema = z.object({
  enabled: z.boolean(),
});

// POST /settings/import
export const importConfigSchema = z.record(z.unknown());

// PUT /settings/data-retention
export const updateDataRetentionSchema = z.object({
  auditLogRetentionDays: z.number().int().min(1).max(3650).optional(),
  logRetentionDays: z.number().int().min(1).max(3650).optional(),
  backupRetentionCount: z.number().int().min(1).max(365).optional(),
});
