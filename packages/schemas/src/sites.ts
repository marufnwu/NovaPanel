import { z } from 'zod';

export const RuntimeConfigSchema = z.object({
  schemaVersion: z.number().int().min(1),
  runtime: z.enum(['php', 'node', 'python', 'static', 'docker', 'ruby', 'go']),
  version: z.string().optional(),
  buildCommand: z.string().optional(),
  startCommand: z.string().optional(),
  healthCheckPath: z.string().optional(),
  phpVersion: z.string().optional(),
  nodeVersion: z.string().optional(),
  pythonVersion: z.string().optional(),
  venvPath: z.string().optional(),
  dockerfile: z.string().optional(),
  dockerImage: z.string().optional(),
});

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;

export const SiteSchema = z.object({
  id: z.string(),
  name: z.string(),
  systemUser: z.string(),
  homeDir: z.string(),
  status: z.enum(['active', 'suspended']),
  diskUsedMb: z.number().int().default(0),
  bandwidthUsedMb: z.number().int().default(0),
  createdAt: z.string().or(z.date()),
});

export type Site = z.infer<typeof SiteSchema>;

export const SiteWithRuntimeSchema = SiteSchema.extend({
  runtime: z.object({
    id: z.string(),
    siteId: z.string(),
    runtimeConfig: RuntimeConfigSchema,
    webServer: z.enum(['nginx', 'apache']),
    createdAt: z.string().or(z.date()),
    updatedAt: z.string().or(z.date()),
  }).optional(),
  process: z.object({
    id: z.string(),
    siteId: z.string(),
    startCommand: z.string(),
    internalPort: z.number().int().optional(),
    processManager: z.enum(['pm2', 'supervisor', 'systemd', 'php-fpm']),
    replicas: z.number().int().default(1),
    autoRestart: z.boolean().default(true),
    healthCheckPath: z.string().optional(),
    pid: z.number().int().optional(),
    uptime: z.number().int().optional(),
    restartCount: z.number().int().default(0),
    memoryMb: z.number().int().optional(),
    cpuPercent: z.number().int().optional(),
    createdAt: z.string().or(z.date()),
    updatedAt: z.string().or(z.date()),
  }).optional(),
  domains: z.array(z.any()).optional(),
});

export type SiteWithRuntime = z.infer<typeof SiteWithRuntimeSchema>;

export const CreateSiteInputSchema = z.object({
  name: z.string().min(1, 'Site name is required'),
  runtime: RuntimeConfigSchema,
  primaryDomain: z.string().optional(),
});

export type CreateSiteInput = z.infer<typeof CreateSiteInputSchema>;

export const SiteProcessSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  startCommand: z.string(),
  internalPort: z.number().int().optional(),
  processManager: z.enum(['pm2', 'supervisor', 'systemd', 'php-fpm']),
  replicas: z.number().int().default(1),
  autoRestart: z.boolean().default(true),
  healthCheckPath: z.string().optional(),
  pid: z.number().int().optional(),
  uptime: z.number().int().optional(),
  restartCount: z.number().int().default(0),
  memoryMb: z.number().int().optional(),
  cpuPercent: z.number().int().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type SiteProcess = z.infer<typeof SiteProcessSchema>;

export const SiteStateSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  nginxStatus: z.enum(['ok', 'missing', 'invalid', 'reload_needed', 'unknown']).default('unknown'),
  nginxConfigValid: z.boolean().optional(),
  nginxReloadNeeded: z.boolean().default(false),
  processStatus: z.enum(['running', 'stopped', 'error', 'restarting', 'unknown']).default('unknown'),
  processRunning: z.boolean().optional(),
  processPid: z.number().int().optional(),
  processUptime: z.number().int().optional(),
  processRestartCount: z.number().int().default(0),
  currentInternalPort: z.number().int().optional(),
  deployedCommitSha: z.string().optional(),
  lastDeploymentStatus: z.enum(['success', 'failed', 'pending', 'unknown']).default('unknown'),
  lastDeployAt: z.string().or(z.date()).optional(),
  sslProvisioned: z.boolean().default(false),
  sslExpiresAt: z.string().or(z.date()).optional(),
  sslAutoRenew: z.boolean().default(true),
  dnsResolving: z.boolean().optional(),
  dnsPointsToServer: z.boolean().optional(),
  lastHealthCheckAt: z.string().or(z.date()).optional(),
  lastHealthyAt: z.string().or(z.date()).optional(),
  lastReconcileAt: z.string().or(z.date()).optional(),
  reconcileErrors: z.any().optional(),
  observedAt: z.string().or(z.date()),
});

export type SiteState = z.infer<typeof SiteStateSchema>;
