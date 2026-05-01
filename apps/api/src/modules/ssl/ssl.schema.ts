import { z } from 'zod';

/** SSL certificate type enum — must match DB enum values */
export const sslTypeEnum = z.enum(['letsencrypt', 'custom', 'self-signed']);

export const issueLetsEncryptSchema = z.object({
  email: z.string().email(),
  enableWww: z.boolean().default(true),
  /** Subject Alternative Names — additional domains to include on the certificate */
  sanDomains: z.array(z.string().min(1)).max(100).optional(),
  /** Whether to issue a wildcard certificate (*.domain) via DNS-01 challenge */
  wildcard: z.boolean().default(false),
  /** Challenge type: 'http-01' (port 80 required) or 'dns-01' (Cloudflare DNS) */
  challengeType: z.enum(['http-01', 'dns-01']).default('http-01'),
});

export const uploadCustomSchema = z.object({
  certificate: z.string().min(1, 'Certificate PEM is required'),
  privateKey: z.string().min(1, 'Private key PEM is required'),
  chain: z.string().optional(),
  /** Subject Alternative Names associated with this custom certificate */
  sanDomains: z.array(z.string().min(1)).max(100).optional(),
});

export const generateSelfSignedSchema = z.object({
  days: z.number().min(1).max(3650).default(365),
  /** Subject Alternative Names — additional domains/IPs to include */
  sanDomains: z.array(z.string().min(1)).max(100).optional(),
  /** Whether to include a wildcard SAN (*.domain) */
  wildcard: z.boolean().default(false),
});

export const updateSslSettingsSchema = z.object({
  autoRenew: z.boolean().optional(),
  redirectHttpToHttps: z.boolean().optional(),
  hsts: z.boolean().optional(),
});

export const toggleAutoRenewSchema = z.object({
  autoRenew: z.boolean(),
});

export const updateHstsSchema = z.object({
  enabled: z.boolean(),
  maxAge: z.number().int().min(0).max(63072000),
  includeSubdomains: z.boolean(),
});

export const updateOcspStaplingSchema = z.object({
  enabled: z.boolean(),
});
