import type { ServerStatus, AuthType } from './enums.js';

export interface CreateServerRequest {
  name: string;
  host: string;
  port?: number;
  username: string;
  authType: AuthType;
  sshKeyId?: string;
  password?: string;
  tags?: string[];
}

export interface UpdateServerRequest {
  name?: string;
  host?: string;
  port?: number;
  username?: string;
  tags?: string[];
}

export interface ServerResponse {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  sshKeyId: string | null;
  status: ServerStatus;
  tags: string[];
  osInfo: { distro?: string; arch?: string; kernel?: string } | null;
  createdAt: string;
}

export interface TestConnectionResponse {
  connected: boolean;
  osInfo?: { distro: string; arch: string; kernel: string };
  error?: string;
}

export interface CreateSshKeyRequest {
  name: string;
  publicKey: string;
  privateKey: string;
}

export interface SshKeyResponse {
  id: string;
  name: string;
  publicKey: string;
  fingerprint: string;
  createdAt: string;
}

export interface MetricsResponse {
  cpuPercent: number;
  ramUsed: number;
  ramTotal: number;
  diskUsed: number | null;
  diskTotal: number | null;
  netIn: number | null;
  netOut: number | null;
  loadAvg: { '1m': number; '5m': number; '15m': number } | null;
  recordedAt: string;
}

export interface MetricsHistoryResponse {
  metrics: MetricsResponse[];
  from: string;
  to: string;
}
