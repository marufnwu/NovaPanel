import { z } from 'zod';
import { CreateDomainInputSchema } from '@serverforge/schemas/domains';

const phpVersionSchema = z.string().regex(/^\d+\.\d+$/, 'Invalid PHP version format');

const domainNameSchema = z.string()
  .min(1, 'Domain name is required')
  .max(253, 'Domain name must be 253 characters or fewer')
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/, 'Invalid domain name format');

export const createDomainSchema = CreateDomainInputSchema;

// Schema for verifying domain DNS points to this server
export const verifyDomainDnsSchema = z.object({
  domain: domainNameSchema,
});

export const updateDomainSchema = z.object({
  phpVersion: phpVersionSchema.optional(),
  phpHandler: z.enum(['php-fpm', 'cgi', 'disabled']).optional(),
  webServer: z.enum(['nginx', 'apache', 'nginx+apache']).optional(),
  redirectHttpToHttps: z.boolean().optional(),
  hsts: z.boolean().optional(),
});

export const deleteDomainSchema = z.object({
  deleteWebsite: z.boolean().default(false),
});

export const createSubdomainSchema = z.object({
  name: z.string().min(1).max(63).regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Invalid subdomain name'),
  documentRoot: z.string().optional(),
  phpVersion: phpVersionSchema.optional(),
});

export const createAliasSchema = z.object({
  alias: domainNameSchema,
});

export const createRedirectSchema = z.object({
  sourcePath: z.string().min(1),
  targetUrl: z.string().min(1),
  type: z.enum(['301', '302']).default('301'),
});

export type CreateDomainInput = z.infer<typeof createDomainSchema>;
export type UpdateDomainInput = z.infer<typeof updateDomainSchema>;
export type DeleteDomainInput = z.infer<typeof deleteDomainSchema>;
