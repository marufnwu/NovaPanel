import { z } from 'zod';

export const RuntimeConfigSchema = z.object({
  schemaVersion: z.number().int().min(1).default(1),
  runtime: z.enum(['docker', 'node', 'python', 'php', 'go', 'ruby', 'rust', 'static']),
  version: z.string().optional(),
  buildCommand: z.string().optional(),
  startCommand: z.string().optional(),
  healthCheckPath: z.string().optional(),
});

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;

export const SiteSchema = z.object({
  id: z.string(),
  orgId: z.string().nullable(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  runtime: z.enum(['docker', 'node', 'python', 'php', 'go', 'ruby', 'rust', 'static']),
  runtimeVersion: z.string().nullable(),
  sourceType: z.enum(['git', 'docker_registry', 'upload', 'empty']),
  gitRepo: z.string().nullable(),
  gitBranch: z.string().default('main'),
  gitWebhookSecret: z.string().nullable(),
  buildCommand: z.string().nullable(),
  outputDirectory: z.string().default('dist'),
  installCommand: z.string().nullable(),
  startCommand: z.string().nullable(),
  port: z.number().int().nullable(),
  replicas: z.number().int().default(1),
  autoRestart: z.boolean().default(true),
  memoryLimit: z.number().int().nullable(),
  cpuLimit: z.number().int().nullable(),
  status: z.enum(['active', 'building', 'deploying', 'error', 'suspended', 'stopped']),
  lastDeploymentId: z.string().nullable(),
  healthCheckPath: z.string().default('/health'),
  databaseId: z.string().nullable(),
  autoDeploy: z.boolean().default(false),
  deployOnPush: z.boolean().default(false),
  deployOnPr: z.boolean().default(false),
  autoRollback: z.boolean().default(true),
  preDeployHook: z.string().nullable(),
  postDeployHook: z.string().nullable(),
  deployPath: z.string().default('/var/www/html'),
  gitCredentials: z.any().nullable(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()).nullable(),
});

export type Site = z.infer<typeof SiteSchema>;

export const CreateSiteInputSchema = z.object({
  name: z.string().min(1, 'Site name is required'),
  orgId: z.string().optional(),
  runtime: RuntimeConfigSchema,
  primaryDomain: z.string().optional(),
  sourceType: z.enum(['git', 'docker_registry', 'upload', 'empty']).default('empty'),
  gitRepo: z.string().optional(),
  gitBranch: z.string().optional(),
  buildCommand: z.string().optional(),
  startCommand: z.string().optional(),
});

export type CreateSiteInput = z.infer<typeof CreateSiteInputSchema>;

export const DeploymentSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  sequence: z.number().int(),
  sourceType: z.enum(['git', 'docker_registry', 'upload', 'rollback']),
  gitRef: z.string().nullable(),
  commitSha: z.string().nullable(),
  commitMessage: z.string().nullable(),
  status: z.enum(['pending', 'building', 'testing', 'deploying', 'success', 'failed', 'cancelled']),
  buildLogs: z.string().nullable(),
  deployLogs: z.string().nullable(),
  deployedAt: z.string().or(z.date()).nullable(),
  durationMs: z.number().int().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string().or(z.date()),
});

export type Deployment = z.infer<typeof DeploymentSchema>;

export const SiteEnvVarSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  key: z.string(),
  value: z.string(),
  scope: z.enum(['runtime', 'build', 'secret']).default('runtime'),
  isSystem: z.boolean().default(false),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()).nullable(),
});

export type SiteEnvVar = z.infer<typeof SiteEnvVarSchema>;
