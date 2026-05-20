import { z } from 'zod';

export const DomainTypeEnum = z.enum(['primary', 'addon', 'parked', 'subdomain', 'redirect', 'mail-only']);

export type DomainType = z.infer<typeof DomainTypeEnum>;

export const DomainSchema = z.object({
  id: z.string(),
  name: z.string(),
  siteId: z.string().nullable(),
  type: DomainTypeEnum.default('primary'),
  isPrimary: z.boolean().default(false),
  parentDomainId: z.string().nullable(),
  documentRoot: z.string().nullable(),
  phpVersion: z.string().default('8.2'),
  phpHandler: z.enum(['php-fpm', 'cgi', 'disabled']).default('php-fpm'),
  webServer: z.enum(['nginx', 'apache', 'nginx+apache']).default('nginx+apache'),
  redirectTarget: z.string().nullable(),
  redirectType: z.enum(['301', '302']).default('301'),
  sslEnabled: z.boolean().default(false),
  sslCertId: z.string().nullable(),
  redirectHttpToHttps: z.boolean().default(false),
  hsts: z.boolean().default(false),
  suspendedConfig: z.string().nullable(),
  status: z.enum(['active', 'suspended', 'pending']).default('active'),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()).nullable(),
  // Disk/bandwidth tracking fields (populated from site stats)
  diskUsedMb: z.number().nullable(),
  bandwidthUsedMb: z.number().nullable(),
});

export type Domain = z.infer<typeof DomainSchema>;

export const CreateDomainInputSchema = z.object({
  name: z.string().min(1, 'Domain name is required'),
  type: DomainTypeEnum.default('primary'),
  siteId: z.string().optional(),
  documentRoot: z.string().optional(),
  phpVersion: z.string().optional(),
  phpHandler: z.enum(['php-fpm', 'cgi', 'disabled']).optional(),
  webServer: z.enum(['nginx', 'apache', 'nginx+apache']).optional(),
  parentDomainId: z.string().optional(),
  redirectTarget: z.string().optional(),
  createDns: z.boolean().optional(),
  createMail: z.boolean().optional(),
  enableMail: z.boolean().optional(),
  makePublic: z.boolean().optional(),
  tunnelId: z.string().optional(),
  skipDnsVerification: z.boolean().optional(),
  createDnsZone: z.boolean().optional(),
  // Legacy v3 fields — kept for backward compat during migration
  websiteMode: z.enum(['none', 'create', 'existing']).optional(),
  websiteName: z.string().optional(),
  // Subdomain/create subdomain fields
  subdomain: z.string().optional(),
});

export type CreateDomainInput = z.infer<typeof CreateDomainInputSchema>;

export const DomainRedirectSchema = z.object({
  id: z.string(),
  domainId: z.string(),
  sourcePath: z.string(),
  targetUrl: z.string(),
  type: z.enum(['301', '302']).default('301'),
  createdAt: z.string().or(z.date()),
});

export type DomainRedirect = z.infer<typeof DomainRedirectSchema>;

export const DomainStatusEnum = z.enum(['active', 'suspended', 'pending']);
export type DomainStatus = z.infer<typeof DomainStatusEnum>;