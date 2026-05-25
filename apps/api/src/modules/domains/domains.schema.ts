import { z } from 'zod';

const domainNameSchema = z.string()
  .min(1, 'Domain name is required')
  .max(253, 'Domain name must be 253 characters or fewer')
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/, 'Invalid domain name format');

export const createDomainSchema = z.object({
  name: domainNameSchema,
  type: z.enum(['apex', 'subdomain', 'wildcard']).default('apex'),
  siteId: z.string().optional(),
  projectId: z.string().optional(),
  dnsZoneId: z.string().optional(),
  skipDnsVerification: z.boolean().default(false),
});

export const verifyDomainDnsSchema = z.object({
  domain: domainNameSchema,
});

export const updateDomainSchema = z.object({
  name: domainNameSchema.optional(),
  sslStatus: z.enum(['pending', 'active', 'expired', 'error']).optional(),
  sslAutoRenew: z.boolean().optional(),
  forceHttps: z.boolean().optional(),
  hstsEnabled: z.boolean().optional(),
  proxyEnabled: z.boolean().optional(),
  customNginxConfig: z.string().optional(),
  status: z.enum(['active', 'suspended', 'pending']).optional(),
});

export const deleteDomainSchema = z.object({
  deleteWebsite: z.boolean().default(false),
});

export const createSubdomainSchema = z.object({
  name: z.string().min(1).max(63).regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Invalid subdomain name'),
  documentRoot: z.string().optional(),
  phpVersion: z.string().optional(),
  siteId: z.string().optional(),
  websiteId: z.string().optional(),
});

export const createAliasSchema = z.object({
  alias: domainNameSchema,
});

export const createRedirectSchema = z.object({
  sourcePath: z.string().min(1),
  targetUrl: z.string().min(1).url('Invalid target URL'),
  type: z.enum(['301', '302']).default('301'),
});

export const makePublicSchema = z.object({
  tunnelId: z.string().optional(),
});

export const domainLogsQuerySchema = z.object({
  lines: z.coerce.number().min(10).max(5000).default(100),
});

export type CreateDomainInput = z.infer<typeof createDomainSchema>;
export type UpdateDomainInput = z.infer<typeof updateDomainSchema>;
export type DeleteDomainInput = z.infer<typeof deleteDomainSchema>;
export type CreateSubdomainInput = z.infer<typeof createSubdomainSchema>;
export type CreateAliasInput = z.infer<typeof createAliasSchema>;
export type CreateRedirectInput = z.infer<typeof createRedirectSchema>;
export type MakePublicInput = z.infer<typeof makePublicSchema>;
export type DomainLogsQuery = z.infer<typeof domainLogsQuerySchema>;