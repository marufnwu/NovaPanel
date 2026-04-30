import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface Mailbox {
  id: string;
  email: string;
  quotaMb: number;
  usedMb: number;
  isActive: boolean;
  isSuspended?: boolean;
  autoresponder: boolean;
  autoresponderSubject?: string;
  autoresponderMessage?: string;
}

export interface MailAlias {
  id: string;
  alias: string;
  destination: string;
  forwardType?: 'forward_only' | 'forward_and_keep';
}

export interface MailForward {
  id: string;
  fromMailbox: string;
  forwardTo: string;
  keepCopy: boolean;
}

export interface MailDomainInfo {
  enabled: boolean;
  mailDomain: {
    id: string;
    isActive: boolean;
    spfRecord?: string;
    dmarcPolicy?: string;
    hasDkimKey: boolean;
    catchAllDestination?: string;
    spamAssassinEnabled?: boolean;
    spamScoreThreshold?: number;
  } | null;
  mailboxes: Mailbox[];
  aliases: MailAlias[];
  forwards: MailForward[];
}

export interface DkimStatus {
  enabled: boolean;
  hasPublicKey: boolean;
  selector?: string;
  dnsRecord?: string;
  spfRecord?: string;
  dmarcPolicy?: string;
}

export interface MailQueueItem {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  age: string;
  size?: string;
  status?: string;
}

/* ------------------------------------------------------------------ */
/*  Query Hooks                                                       */
/* ------------------------------------------------------------------ */

export function useMailDomainInfo(domainId: string) {
  return useQuery({
    queryKey: ['mail', 'info', domainId],
    queryFn: () => api.get<MailDomainInfo>(`/domains/${domainId}/mail/info`),
    enabled: !!domainId,
  });
}

export function useMailboxes(domainId: string) {
  return useQuery({
    queryKey: ['mail', 'mailboxes', domainId],
    queryFn: () => api.get<Mailbox[]>(`/domains/${domainId}/mail/mailboxes`),
    enabled: !!domainId,
  });
}

export function useMailAliases(domainId: string) {
  return useQuery({
    queryKey: ['mail', 'aliases', domainId],
    queryFn: () => api.get<MailAlias[]>(`/domains/${domainId}/mail/aliases`),
    enabled: !!domainId,
  });
}

export function useDkimStatus(domainId: string) {
  return useQuery({
    queryKey: ['mail', 'dkim', domainId],
    queryFn: () => api.get<DkimStatus>(`/domains/${domainId}/mail/dkim/status`),
    enabled: !!domainId,
  });
}

export function useMailQueue(domainId: string) {
  return useQuery({
    queryKey: ['mail', 'queue', domainId],
    queryFn: async (): Promise<MailQueueItem[]> => {
      const data = await api.get<Record<string, unknown>>(`/domains/${domainId}/mail/info`);
      const queue = (data as Record<string, unknown>)?.queue;
      return Array.isArray(queue) ? (queue as MailQueueItem[]) : [];
    },
    enabled: !!domainId,
    refetchInterval: 30_000, // Auto-refresh every 30s
  });
}

/* ------------------------------------------------------------------ */
/*  Mutation Hooks                                                    */
/* ------------------------------------------------------------------ */

export function useEnableMail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (domainId: string) => api.post(`/domains/${domainId}/mail/enable`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  });
}

export function useDisableMail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (domainId: string) => api.delete(`/domains/${domainId}/mail/disable`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  });
}

export function useCreateMailbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domainId, ...data }: { domainId: string; username: string; password: string; quotaMb?: number }) =>
      api.post(`/domains/${domainId}/mail/mailboxes`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  });
}

export function useUpdateMailbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      domainId,
      id,
      ...data
    }: {
      domainId: string;
      id: string;
      password?: string;
      quotaMb?: number;
      isActive?: boolean;
      isSuspended?: boolean;
      autoresponder?: boolean;
      autoresponderSubject?: string;
      autoresponderMessage?: string;
    }) => api.put(`/domains/${domainId}/mail/mailboxes/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  });
}

export function useDeleteMailbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domainId, id }: { domainId: string; id: string }) =>
      api.delete(`/domains/${domainId}/mail/mailboxes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  });
}

export function useCreateAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      domainId,
      alias,
      destination,
      forwardType,
    }: {
      domainId: string;
      alias: string;
      destination: string;
      forwardType?: 'forward_only' | 'forward_and_keep';
    }) => api.post(`/domains/${domainId}/mail/aliases`, { alias, destination, forwardType }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  });
}

export function useDeleteAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domainId, id }: { domainId: string; id: string }) =>
      api.delete(`/domains/${domainId}/mail/aliases/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  });
}

export function useGenerateDKIM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (domainId: string) => api.post(`/domains/${domainId}/mail/dkim/generate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  });
}

export function useSetSPF() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domainId, serverIp }: { domainId: string; serverIp: string }) =>
      api.put(`/domains/${domainId}/mail/spf`, { serverIp }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  });
}

export function useSetDMARC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      domainId,
      policy,
      reportEmail,
    }: {
      domainId: string;
      policy: 'none' | 'quarantine' | 'reject';
      reportEmail?: string;
    }) => api.put(`/domains/${domainId}/mail/dmarc`, { policy, reportEmail }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  });
}

export function useSetCatchAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      domainId,
      destination,
    }: {
      domainId: string;
      destination: string;
    }) => api.put(`/domains/${domainId}/mail/mailboxes/catch-all`, { destination }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  });
}

export function useSetSpamAssassin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      domainId,
      enabled,
      spamScoreThreshold,
    }: {
      domainId: string;
      enabled: boolean;
      spamScoreThreshold?: number;
    }) => api.put(`/domains/${domainId}/mail/spamassassin`, { enabled, spamScoreThreshold }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail'] }),
  });
}
