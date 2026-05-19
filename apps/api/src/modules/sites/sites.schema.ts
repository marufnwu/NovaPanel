import { z } from 'zod';

// Runtime configuration schemas
export const runtimeConfigSchema = z.object({
  schemaVersion: z.number().default(1),
  runtime: z.enum(['php', 'node', 'python', 'static', 'docker']),
  version: z.string().optional(),
  buildCommand: z.string().optional(),
  startCommand: z.string().optional(),
  healthCheckPath: z.string().optional(),
  // PHP specific
  phpVersion: z.string().optional(),
  // Node specific
  nodeVersion: z.string().optional(),
  // Python specific
  pythonVersion: z.string().optional(),
  venvPath: z.string().optional(),
});

// Create site schema
export const createSiteSchema = z.object({
  name: z.string().min(1).max(255),
  runtime: runtimeConfigSchema,
  primaryDomain: z.string().optional(),
});

// Update site schema  
export const updateSiteSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

// Attach/detach domain schemas
export const attachDomainToSiteSchema = z.object({
  domainId: z.string().min(1),
});

export const detachDomainFromSiteSchema = z.object({
  domainId: z.string().min(1),
});

// Types
export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;
