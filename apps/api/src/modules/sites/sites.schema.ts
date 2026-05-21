import { z } from 'zod';
import { RuntimeConfigSchema, CreateSiteInputSchema } from '@serverforge/schemas/sites';

export const runtimeConfigSchema = RuntimeConfigSchema;
export const createSiteSchema = CreateSiteInputSchema;

export const updateSiteSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  runtime: z.enum(['docker', 'node', 'python', 'php', 'go', 'ruby', 'rust', 'static']).optional(),
  runtimeVersion: z.string().optional(),
  sourceType: z.enum(['git', 'docker_registry', 'upload', 'empty']).optional(),
  gitRepo: z.string().optional(),
  gitBranch: z.string().optional(),
  buildCommand: z.string().optional(),
  outputDirectory: z.string().optional(),
  installCommand: z.string().optional(),
  startCommand: z.string().optional(),
  port: z.number().int().optional(),
  replicas: z.number().int().optional(),
  autoRestart: z.boolean().optional(),
  memoryLimit: z.number().int().optional(),
  cpuLimit: z.number().int().optional(),
  healthCheckPath: z.string().optional(),
});

export const attachDomainToSiteSchema = z.object({
  domainId: z.string().min(1),
});

export const detachDomainFromSiteSchema = z.object({
  domainId: z.string().min(1),
});

export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;
