import { z } from 'zod';

export const DomainTypeEnum = z.enum(['apex', 'subdomain', 'wildcard']);
export type DomainType = z.infer<typeof DomainTypeEnum>;

export const DomainSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  siteId: z.string().nullable(),
  name: z.string(),
  type: DomainTypeEnum.default('apex'),
  dnsZoneId: z.string().nullable(),
  nameservers: z.array(z.string()).nullable(),
  dnssecEnabled: z.boolean().default(false),
  sslStatus: z.enum(['pending', 'active', 'expired', 'error']).default('pending'),
  sslCertId: z.string().nullable(),
  sslAutoRenew: z.boolean().default(true),
  forceHttps: z.boolean().default(true),
  hstsEnabled: z.boolean().default(false),
  proxyEnabled: z.boolean().default(true),
  customNginxConfig: z.string().nullable(),
  status: z.enum(['active', 'suspended', 'pending']).default('active'),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()).nullable(),
});

export type Domain = z.infer<typeof DomainSchema>;

export const CreateDomainInputSchema = z.object({
  name: z.string().min(1, 'Domain name is required'),
  type: DomainTypeEnum.default('apex'),
  siteId: z.string().optional(),
  projectId: z.string().optional(),
  dnsZoneId: z.string().optional(),
  skipDnsVerification: z.boolean().default(false),
});

export type CreateDomainInput = z.infer<typeof CreateDomainInputSchema>;

export const UpdateDomainInputSchema = z.object({
  name: z.string().optional(),
  sslStatus: z.enum(['pending', 'active', 'expired', 'error']).optional(),
  sslAutoRenew: z.boolean().optional(),
  forceHttps: z.boolean().optional(),
  hstsEnabled: z.boolean().optional(),
  proxyEnabled: z.boolean().optional(),
  customNginxConfig: z.string().optional(),
  status: z.enum(['active', 'suspended', 'pending']).optional(),
});

export type UpdateDomainInput = z.infer<typeof UpdateDomainInputSchema>;

export const SslCertificateSchema = z.object({
  id: z.string(),
  domainId: z.string(),
  type: z.enum(['letsencrypt', 'zerossl', 'google', 'custom', 'self_signed']),
  certPem: z.string().nullable(),
  keyPem: z.string().nullable(),
  chainPem: z.string().nullable(),
  issuedAt: z.string().or(z.date()).nullable(),
  expiresAt: z.string().or(z.date()).nullable(),
  autoRenew: z.boolean().default(true),
  renewalDaysBeforeExpiry: z.number().int().default(14),
  status: z.enum(['active', 'pending', 'expired', 'revoked', 'error']).default('pending'),
  lastError: z.string().nullable(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()).nullable(),
});

export type SslCertificate = z.infer<typeof SslCertificateSchema>;

export const DomainStatusEnum = z.enum(['active', 'suspended', 'pending']);
export type DomainStatus = z.infer<typeof DomainStatusEnum>;