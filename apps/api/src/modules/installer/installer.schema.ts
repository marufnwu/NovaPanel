import { z } from 'zod';

// POST /installer/install
export const installAppSchema = z.object({
  appId: z.string().min(1),
  domain: z.string().min(1),
  path: z.string().min(1),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
});

// POST /installer/uninstall
export const uninstallAppSchema = z.object({
  appId: z.string().min(1),
});

// POST /installer/update
export const updateAppSchema = z.object({
  appId: z.string().min(1),
});

// POST /installer/config
export const setAppConfigSchema = z.object({
  appId: z.string().min(1),
  configKey: z.string().min(1),
  configValue: z.string(),
});

// DELETE /installer/config
export const deleteAppConfigSchema = z.object({
  appId: z.string().min(1),
  configKey: z.string().min(1),
});

// POST /installer/check-path
export const checkPathSchema = z.object({
  path: z.string().min(1),
});
