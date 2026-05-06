import { z } from 'zod';

// --- Zone Schemas ---

export const linkZoneSchema = z.object({
  zoneId: z.string().optional(),
  zoneName: z.string().optional(),
  apiToken: z.string().min(1),
  accountId: z.string().optional(),
  domainId: z.string().optional(),
});

export const updateZoneSettingsSchema = z.object({
  sslMode: z.enum(['off', 'flexible', 'full', 'strict']).optional(),
  alwaysUseHttps: z.boolean().optional(),
  automaticHttpsRewrites: z.boolean().optional(),
  minTlsVersion: z.enum(['1.0', '1.1', '1.2', '1.3']).optional(),
  http2: z.boolean().optional(),
  http3: z.boolean().optional(),
  browserCacheTtl: z.number().min(0).optional(),
  developmentMode: z.boolean().optional(),
  emailObfuscation: z.boolean().optional(),
  hotlinkProtection: z.boolean().optional(),
});

// --- DNS Record Schemas ---

export const createDnsRecordSchema = z.object({
  type: z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'PTR']),
  name: z.string().min(1),
  content: z.string().min(1),
  proxied: z.boolean().optional(),
  ttl: z.number().min(1).optional(),
  priority: z.number().optional(),
  comment: z.string().optional(),
});

export const updateDnsRecordSchema = z.object({
  type: z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'PTR']).optional(),
  name: z.string().optional(),
  content: z.string().optional(),
  proxied: z.boolean().optional(),
  ttl: z.number().min(1).optional(),
  priority: z.number().optional(),
  comment: z.string().optional(),
});

// --- Firewall Schemas ---

export const createFirewallRuleSchema = z.object({
  action: z.enum(['block', 'challenge', 'allow', 'js_challenge', 'log']),
  expression: z.string().min(1),
  description: z.string().optional(),
  paused: z.boolean().optional(),
});

export const updateFirewallRuleSchema = z.object({
  action: z.enum(['block', 'challenge', 'allow', 'js_challenge', 'log']).optional(),
  expression: z.string().optional(),
  description: z.string().optional(),
  paused: z.boolean().optional(),
});

// --- Access Rule Schemas ---

export const createAccessRuleSchema = z.object({
  mode: z.enum(['block', 'challenge', 'whitelist', 'js_challenge']),
  target: z.enum(['ip', 'ip_range', 'country', 'asn']),
  value: z.string().min(1),
  notes: z.string().optional(),
});

// --- Redirect Rule Schemas ---

export const createRedirectRuleSchema = z.object({
  sourcePattern: z.string().min(1),
  destinationUrl: z.string().min(1),
  redirectType: z.enum(['301', '302']).default('301'),
});

export const updateRedirectRuleSchema = z.object({
  sourcePattern: z.string().optional(),
  destinationUrl: z.string().optional(),
  redirectType: z.enum(['301', '302']).optional(),
  isActive: z.boolean().optional(),
});

// --- Cache Schemas ---

export const purgeCacheSchema = z.object({
  purgeEverything: z.boolean().optional(),
  files: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

// --- Mail Preset Schemas ---

export const applyMailPresetSchema = z.object({
  provider: z.enum(['google', 'microsoft', 'zoho', 'custom']),
  customRecords: z.array(z.object({
    type: z.string(),
    name: z.string(),
    content: z.string(),
    priority: z.number().optional(),
  })).optional(),
});

// --- Verification Schemas ---

export const verifyDomainSchema = z.object({
  domainId: z.string().optional(),
});
