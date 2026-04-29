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
