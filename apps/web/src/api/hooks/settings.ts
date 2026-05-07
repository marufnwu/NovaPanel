import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface ServerIdentity {
  hostname: string;
  domain: string;
}

export interface TimezoneSettings {
  timezone: string;
}

export interface BackupSettings {
  backupPath: string;
  retentionDays: number;
  schedule: string;
  enabled: boolean;
}

export interface SecuritySettings {
  sshPort: number;
  sshPasswordAuth: boolean;
  sshPermitRootLogin: boolean;
  fail2banEnabled: boolean;
  ufwEnabled: boolean;
}

export interface SystemUpdates {
  updatesAvailable: number;
  lastCheck: string;
  autoUpdate: boolean;
}

export interface PanelSettings {
  panelUrl: string;
  adminEmail: string;
}

export interface NameserverSettings {
  ns1: string;
  ns2: string;
}

export interface DomainVerificationResult {
  domain: string;
  resolvesTo: string[];
  pointsToServer: boolean;
  serverIp: string;
  error?: string;
}

export interface SessionSettings {
  timeout: number;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

export interface SystemInfo {
  os: string;
  kernel: string;
  arch: string;
  hostname: string;
  cpu: { model: string; cores: number };
  ram: { total: number; used: number; available: number };
  disk: { total: number; used: number; available: number };
  uptime: number;
  softwareVersions: {
    nginx: string;
    php: string;
    mysql: string;
    node: string;
    redis: string;
    [key: string]: string;
  };
}

export interface SshSettings {
  port: number;
  permitRootLogin: boolean;
  passwordAuth: boolean;
  pubkeyAuth: boolean;
}

export interface DataRetentionSettings {
  auditLogRetentionDays: number;
  logRetentionDays: number;
  backupRetentionCount: number;
}

export function useServerIdentity() {
  return useQuery({
    queryKey: ['settings', 'identity'],
    queryFn: () => api.get<ServerIdentity>('/settings/identity'),
  });
}

export function useUpdateServerIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ServerIdentity>) =>
      api.put('/settings/identity', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'identity'] }),
  });
}

export function useTimezone() {
  return useQuery({
    queryKey: ['settings', 'timezone'],
    queryFn: () => api.get<TimezoneSettings>('/settings/timezone'),
  });
}

export function useAvailableTimezones() {
  return useQuery({
    queryKey: ['settings', 'timezones'],
    queryFn: () => api.get<string[]>('/settings/timezones'),
  });
}

export function useUpdateTimezone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (timezone: string) =>
      api.put('/settings/timezone', { timezone }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'timezone'] }),
  });
}

export function useBackupSettings() {
  return useQuery({
    queryKey: ['settings', 'backup'],
    queryFn: () => api.get<BackupSettings>('/settings/backup'),
  });
}

export function useUpdateBackupSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<BackupSettings>) =>
      api.put('/settings/backup', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'backup'] }),
  });
}

export function useSecuritySettings() {
  return useQuery({
    queryKey: ['settings', 'security'],
    queryFn: () => api.get<SecuritySettings>('/settings/security'),
  });
}

export function useUpdateSshPort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (port: number) =>
      api.put('/settings/security/ssh-port', { port }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'security'] }),
  });
}

export function useSystemUpdates() {
  return useQuery({
    queryKey: ['settings', 'updates'],
    queryFn: () => api.get<SystemUpdates>('/settings/updates'),
  });
}

export function useCheckForUpdates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/settings/updates/check'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'updates'] }),
  });
}

export function usePanelSettings() {
  return useQuery({
    queryKey: ['settings', 'panel'],
    queryFn: () => api.get<PanelSettings>('/settings/panel'),
  });
}

export function useUpdatePanelSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PanelSettings>) =>
      api.put('/settings/panel', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'panel'] }),
  });
}

export function useNameserverSettings() {
  return useQuery({
    queryKey: ['settings', 'nameservers'],
    queryFn: () => api.get<NameserverSettings>('/settings/nameservers'),
  });
}

export function useUpdateNameserverSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<NameserverSettings>) =>
      api.put('/settings/nameservers', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'nameservers'] }),
  });
}

export function useVerifyNameserverDomain() {
  return useMutation({
    mutationFn: (domain: string) =>
      api.post<DomainVerificationResult>('/settings/nameservers/verify-domain', { domain }),
  });
}

export function useSessionSettings() {
  return useQuery({
    queryKey: ['settings', 'session'],
    queryFn: () => api.get<SessionSettings>('/settings/session'),
  });
}

export function useUpdateSessionSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SessionSettings>) =>
      api.put('/settings/session', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'session'] }),
  });
}

export function usePasswordPolicy() {
  return useQuery({
    queryKey: ['settings', 'password-policy'],
    queryFn: () => api.get<PasswordPolicy>('/settings/password-policy'),
  });
}

export function useUpdatePasswordPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PasswordPolicy>) =>
      api.put('/settings/password-policy', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'password-policy'] }),
  });
}

export function useSystemInfo() {
  return useQuery({
    queryKey: ['settings', 'system-info'],
    queryFn: () => api.get<SystemInfo>('/settings/system-info'),
  });
}

// ─── SSH Settings ─────────────────────────────────────────────────────────────

export function useSshSettings() {
  return useQuery({
    queryKey: ['settings', 'ssh'],
    queryFn: () => api.get<SshSettings>('/settings/ssh'),
  });
}

export function useUpdateSshSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SshSettings>) =>
      api.put('/settings/ssh', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'ssh'] }),
  });
}

// ─── Panel Port ───────────────────────────────────────────────────────────────

export function usePanelPort() {
  return useQuery({
    queryKey: ['settings', 'panel-port'],
    queryFn: () => api.get<{ port: number }>('/settings/panel-port'),
  });
}

export function useUpdatePanelPort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (port: number) =>
      api.put('/settings/panel-port', { port }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'panel-port'] }),
  });
}

// ─── Default Web Server ───────────────────────────────────────────────────────

export function useDefaultWebServer() {
  return useQuery({
    queryKey: ['settings', 'default-webserver'],
    queryFn: () => api.get<{ mode: string }>('/settings/default-webserver'),
  });
}

export function useUpdateDefaultWebServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mode: string) =>
      api.put('/settings/default-webserver', { mode }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'default-webserver'] }),
  });
}

// ─── Default SSL Email ────────────────────────────────────────────────────────

export function useSslEmail() {
  return useQuery({
    queryKey: ['settings', 'ssl-email'],
    queryFn: () => api.get<{ email: string }>('/settings/ssl-email'),
  });
}

export function useUpdateSslEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) =>
      api.put('/settings/ssl-email', { email }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'ssl-email'] }),
  });
}

// ─── Server Power ─────────────────────────────────────────────────────────────

export function useRebootServer() {
  return useMutation({
    mutationFn: () => api.post('/settings/reboot'),
  });
}

export function useShutdownServer() {
  return useMutation({
    mutationFn: () => api.post('/settings/shutdown'),
  });
}

// ─── Maintenance Mode ─────────────────────────────────────────────────────────

export function useMaintenanceMode() {
  return useQuery({
    queryKey: ['settings', 'maintenance'],
    queryFn: () => api.get<{ enabled: boolean }>('/settings/maintenance'),
  });
}

export function useUpdateMaintenanceMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) =>
      api.put('/settings/maintenance', { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'maintenance'] }),
  });
}

// ─── Panel Config Export / Import ─────────────────────────────────────────────

export function useExportConfig() {
  return useMutation({
    mutationFn: async () => {
      return api.get<Record<string, unknown>>('/settings/export');
    },
  });
}

export function useImportConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: Record<string, unknown>) =>
      api.post('/settings/import', config),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
}

// ─── Data Retention ───────────────────────────────────────────────────────────

export interface DataRetentionSettings {
  auditLogRetentionDays: number;
  logRetentionDays: number;
  backupRetentionCount: number;
}

export function useDataRetention() {
  return useQuery({
    queryKey: ['settings', 'data-retention'],
    queryFn: () => api.get<DataRetentionSettings>('/settings/data-retention'),
  });
}

export function useUpdateDataRetention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<DataRetentionSettings>) =>
      api.put('/settings/data-retention', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'data-retention'] }),
  });
}

// ─── Server Context ───────────────────────────────────────────────────────────

export interface ServerContext {
  localIps: string[];
  hasPublicIp: boolean;
  publicIp: string | null;
  primaryIp: string;
  panelUrl: string;
  panelUrlIsPrivate: boolean;
  tunnelConfigured: boolean;
  tunnelActive: boolean;
  tunnelUrl: string | null;
  canIssueHttpSsl: boolean;
  canReceiveExternalMail: boolean;
  canServePublicDns: boolean;
  // DNS / Nameserver info
  nameservers: {
    ns1: string;
    ns2: string;
  };
}

export function useServerContext() {
  return useQuery({
    queryKey: ['server-context'],
    queryFn: () => api.get<ServerContext>('/settings/server-context'),
    staleTime: 5 * 60 * 1000, // 5 minutes (matches backend cache)
  });
}
