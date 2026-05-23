import type { User, Site, Domain, Deployment, SiteEnvVar } from '@serverforge/schemas';

export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: '1',
  username: 'admin',
  email: 'admin@novapanel.com',
  displayName: 'Admin User',
  avatarUrl: null,
  locale: 'en',
  timezone: 'UTC',
  role: 'admin',
  twoFactorEnabled: false,
  mustChangePassword: false,
  lastLoginAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createMockSite = (overrides: Partial<Site> = {}): Site => ({
  id: 'site-1',
  projectId: 'proj-1',
  name: 'My Website',
  slug: 'my-website',
  description: 'Test website',
  runtime: 'node',
  runtimeVersion: '18',
  sourceType: 'git',
  gitRepo: 'https://github.com/example/repo',
  gitBranch: 'main',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  installCommand: 'npm install',
  startCommand: 'npm start',
  port: 3000,
  replicas: 1,
  autoRestart: true,
  memoryLimit: 512,
  cpuLimit: 1,
  status: 'active',
  healthCheckPath: '/health',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockDomain = (overrides: Partial<Domain> = {}): Domain => ({
  id: 'domain-1',
  projectId: 'proj-1',
  siteId: 'site-1',
  name: 'example.com',
  type: 'apex',
  dnsZoneId: null,
  nameservers: null,
  dnssecEnabled: false,
  sslStatus: 'active',
  sslCertId: 'cert-1',
  sslAutoRenew: true,
  forceHttps: true,
  hstsEnabled: false,
  proxyEnabled: true,
  customNginxConfig: null,
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockDeployment = (overrides: Partial<Deployment> = {}): Deployment => ({
  id: 'deploy-1',
  siteId: 'site-1',
  sequence: 1,
  sourceType: 'git',
  gitRef: 'main',
  commitSha: 'abc123',
  commitMessage: 'Initial commit',
  status: 'success',
  buildLogs: 'Build completed successfully',
  deployLogs: 'Deployment completed',
  deployedAt: new Date().toISOString(),
  durationMs: 45000,
  errorMessage: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createMockEnvVar = (overrides: Partial<SiteEnvVar> = {}): SiteEnvVar => ({
  id: 'env-1',
  siteId: 'site-1',
  key: 'NODE_ENV',
  value: 'production',
  scope: 'runtime',
  isSystem: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockServerStats = () => ({
  cpu: { usage: 45.2, cores: 4 },
  memory: { total: 16384, used: 8192, available: 8192, usagePercent: 50 },
  disk: { total: 512000, used: 256000, available: 256000, usagePercent: 50, mount: '/' },
  uptime: 864000,
});

export const createMockServiceStatus = () => [
  { name: 'nginx', status: 'running' },
  { name: 'mysql', status: 'running' },
  { name: 'php-fpm', status: 'running' },
  { name: 'redis', status: 'stopped' },
];