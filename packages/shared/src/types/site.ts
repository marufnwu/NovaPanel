import type { StackType, SiteStatus, DeployStatus } from './enums.js';

export interface CreateSiteRequest {
  name: string;
  serverId: string;
  stackType: StackType;
  domain: string;
  port?: number;
  phpVersion?: string;
  gitUrl?: string;
  gitBranch?: string;
  envVars?: Record<string, string>;
}

export interface UpdateSiteRequest {
  name?: string;
  port?: number;
  gitBranch?: string;
}

export interface SiteResponse {
  id: string;
  serverId: string;
  name: string;
  domain: string;
  subdomain: string | null;
  stackType: StackType;
  rootPath: string | null;
  port: number | null;
  status: SiteStatus;
  gitUrl: string | null;
  gitBranch: string | null;
  createdAt: string;
}

export interface DeployResponse {
  id: string;
  siteId: string;
  triggeredBy: string;
  status: DeployStatus;
  gitCommit: string | null;
  gitMessage: string | null;
  logOutput: string | null;
  durationMs: number | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface SiteEnvVar {
  id: string;
  key: string;
  version: number;
  createdAt: string;
}
