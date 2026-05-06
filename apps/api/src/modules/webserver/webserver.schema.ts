import { z } from 'zod';

export const updateWebServerSchema = z.object({
  webServer: z.enum(['nginx', 'apache', 'nginx+apache']).optional(),
  // Performance
  gzipEnabled: z.boolean().optional(),
  browserCachingEnabled: z.boolean().optional(),
  staticFileExpiryDays: z.number().min(0).max(365).optional(),
  // Security
  hotlinkProtection: z.boolean().optional(),
  hotlinkAllowedDomains: z.string().optional(),
  directoryBrowsing: z.boolean().optional(),
  ipRestrictionMode: z.enum(['allow_all', 'whitelist', 'blacklist']).optional(),
  ipList: z.string().optional(), // newline-separated IPs/CIDRs
  // Reverse Proxy
  reverseProxyEnabled: z.boolean().optional(),
  reverseProxyTarget: z.string().optional(),
  // Upload
  maxUploadSizeMb: z.number().min(1).max(1024).optional(),
  // Custom directives
  customNginxDirectives: z.string().max(10000).optional(),
  customApacheDirectives: z.string().max(10000).optional(),
});

const errorPageSchema = z.object({
  code: z.number().int().min(400).max(599),
  enabled: z.boolean().default(true),
  content: z.string().max(50000),
  contentType: z.enum(['text/html', 'text/plain', 'application/json']).default('text/html'),
});

export const updateErrorPagesSchema = z.object({
  errorPages: z.array(errorPageSchema).min(0).max(20),
});

export const updateRateLimitSchema = z.object({
  enabled: z.boolean().optional(),
  requestsPerSecond: z.number().min(1).max(10000).optional(),
  burstSize: z.number().min(1).max(100000).optional(),
  timeoutSeconds: z.number().min(1).max(3600).optional(),
});
