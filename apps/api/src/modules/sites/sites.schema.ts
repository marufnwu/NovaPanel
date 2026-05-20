import { z } from 'zod';
import { RuntimeConfigSchema, CreateSiteInputSchema } from '@serverforge/schemas/sites';

export const runtimeConfigSchema = RuntimeConfigSchema;
export const createSiteSchema = CreateSiteInputSchema;

export const updateSiteSchema = z.object({
  name: z.string().min(1).max(255).optional(),
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
