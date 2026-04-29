import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { useEffect, useRef, useState } from 'react';

export interface CloudflareTunnel {
  id: string;
  tunnelId: string;
  name: string;
  status: 'active' | 'inactive';
}

export interface TunnelRoute {
  id: string;
  tunnelId: string;
  hostname: string;
  service: string;
  isActive: boolean;
  domainId?: string;
}

export interface TunnelStatus {
  status: 'active' | 'inactive';
  tunnels: CloudflareTunnel[];
}

export interface TunnelInfo {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  connections: {
    id: string;
    colo: string;
    ip: string;
    client_version: string;
  }[];
  createdAt?: string;
}

export interface CloudflareZone {
  id: string;
  name: string;
  status: string;
}

export interface TokenValidation {
  valid: boolean;
  email?: string;
  username?: string;
}

export function useTunnelStatus() {
  return useQuery({
    queryKey: ['tunnel', 'status'],
    queryFn: () => api.get<TunnelStatus>('/tunnel/status'),
  });
}

export function useTunnelRoutes() {
  return useQuery({
    queryKey: ['tunnel', 'routes'],
    queryFn: () => api.get<TunnelRoute[]>('/tunnel/routes'),
  });
}

export function useTunnelInfo(tunnelId: string) {
  return useQuery({
    queryKey: ['tunnel', 'info', tunnelId],
    queryFn: () => api.get<TunnelInfo>(`/tunnel/${tunnelId}/info`),
    enabled: !!tunnelId,
  });
}

export function useTunnelConfig(tunnelId: string) {
  return useQuery({
    queryKey: ['tunnel', 'config', tunnelId],
    queryFn: () => api.get<string>(`/tunnel/${tunnelId}/config`),
    enabled: !!tunnelId,
  });
}

export function useValidateToken() {
  return useMutation({
    mutationFn: (apiToken: string) => api.post<TokenValidation>('/tunnel/validate-token', { apiToken }),
  });
}

export function useFetchZones() {
  return useMutation({
    mutationFn: (data: { apiToken: string; accountId?: string }) =>
      api.post<CloudflareZone[]>('/tunnel/fetch-zones', data),
  });
}

export function useSetupTunnel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; apiToken: string; accountId?: string }) =>
      api.post('/tunnel/setup', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tunnel'] }),
  });
}

export function useDeleteTunnel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tunnelId: string) => api.delete(`/tunnel/${tunnelId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tunnel'] }),
  });
}

export function useStartTunnel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/tunnel/start'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tunnel'] }),
  });
}

export function useStopTunnel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/tunnel/stop'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tunnel'] }),
  });
}

export function useAddTunnelRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { tunnelId: string; hostname: string; service: string; domainId?: string }) =>
      api.post('/tunnel/routes', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tunnel'] }),
  });
}

export function useEditTunnelRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { routeId: string; hostname?: string; service?: string }) =>
      api.put(`/tunnel/routes/${data.routeId}`, { hostname: data.hostname, service: data.service }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tunnel'] }),
  });
}

export function useDeleteTunnelRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routeId: string) => api.delete(`/tunnel/routes/${routeId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tunnel'] }),
  });
}

export function useToggleTunnelRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routeId: string) => api.post(`/tunnel/routes/${routeId}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tunnel'] }),
  });
}

export function useCreateDnsCname() {
  return useMutation({
    mutationFn: (data: { zoneId: string; hostname: string; target: string }) =>
      api.post('/tunnel/dns/cname', data),
  });
}

export function useTunnelLogs(tunnelId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [logs, setLogs] = useState<Array<{ data: string; timestamp: string }>>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tunnelId) return;

    // Cookie-based auth: browser automatically sends sf_session cookie on WS upgrade
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/tunnel/logs?tunnelId=${tunnelId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'log') {
          setLogs(prev => [...prev, { data: message.data, timestamp: message.timestamp }]);
        } else if (message.type === 'error') {
          setError(message.data);
        } else if (message.type === 'closed') {
          setIsConnected(false);
        }
      } catch (err) {
        console.error('Failed to parse log message:', err);
      }
    };

    ws.onerror = () => {
      setError('Connection error');
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    wsRef.current = ws;

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [tunnelId]);

  return { logs, isConnected, error };
}
