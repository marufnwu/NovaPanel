import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface UfwRule {
  number: number;
  rule: string;
  action: string;
  direction: string;
  from: string;
  enabled?: boolean;
}

export interface F2BJail {
  name: string;
  bannedCount: number;
  bannedIps: string[];
}

export interface FirewallStatus {
  enabled: boolean;
  defaultInput: string;
  defaultOutput: string;
  defaultForward: string;
}

export function useFirewallStatus() {
  return useQuery({
    queryKey: ['firewall', 'status'],
    queryFn: () => api.get<FirewallStatus>('/firewall/status'),
  });
}

export function useFirewallRules() {
  return useQuery({
    queryKey: ['firewall', 'rules'],
    queryFn: () => api.get<UfwRule[]>('/firewall/rules'),
  });
}

export function useAddFirewallRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { action: 'allow' | 'deny'; port?: string; protocol?: string; from?: string; to?: string }) =>
      api.post('/firewall/rules', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firewall', 'rules'] }),
  });
}

export function useDeleteFirewallRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleNumber: number) => api.delete(`/firewall/rules/${ruleNumber}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firewall', 'rules'] }),
  });
}

export function useApplyFirewallPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (preset: 'ssh' | 'http' | 'https' | 'ftp' | 'smtp' | 'imap') =>
      api.post(`/firewall/preset/${preset}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firewall', 'rules'] }),
  });
}

export function useToggleFirewall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: 'enable' | 'disable') =>
      api.post(`/firewall/${action}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firewall'] }),
  });
}

export function useFail2BanJails() {
  return useQuery({
    queryKey: ['firewall', 'fail2ban'],
    queryFn: () => api.get<F2BJail[]>('/firewall/fail2ban'),
  });
}

export function useUnbanIp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jail, ip }: { jail: string; ip: string }) =>
      api.post('/firewall/fail2ban/unban', { jail, ip }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firewall', 'fail2ban'] }),
  });
}

/** Ban an IP address, optionally in a specific jail */
export function useBanIp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jail, ip }: { jail?: string; ip: string }) =>
      api.post('/firewall/fail2ban/ban', { jail, ip }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firewall', 'fail2ban'] }),
  });
}

/** Reset all rules to defaults (SSH/HTTP/HTTPS) */
export function useResetFirewallRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/firewall/reset'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firewall', 'rules'] }),
  });
}

/** Toggle an individual firewall rule on/off */
export function useToggleRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleNumber, enabled }: { ruleNumber: number; enabled: boolean }) =>
      api.post(`/firewall/rules/${ruleNumber}/toggle`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firewall', 'rules'] }),
  });
}
