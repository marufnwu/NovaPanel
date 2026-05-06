import { z } from 'zod';

export const notificationTypeSchema = z.enum([
  'ssl_expiry',
  'backup_complete',
  'cron_failed',
  'security_alert',
  'disk_space_low',
  'service_down',
  'info',
]);

export const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  sslExpiry: z.boolean().optional(),
  backupComplete: z.boolean().optional(),
  cronFailed: z.boolean().optional(),
  securityAlert: z.boolean().optional(),
  diskSpaceLow: z.boolean().optional(),
  serviceDown: z.boolean().optional(),
});

export const createNotificationSchema = z.object({
  type: notificationTypeSchema,
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(10000),
});
