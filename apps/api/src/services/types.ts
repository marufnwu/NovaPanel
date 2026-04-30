export type ServiceStatus = 'running' | 'stopped' | 'error' | 'unknown';

export interface ServiceInfo {
  name: string;
  displayName: string;
  status: ServiceStatus;
  version?: string;
  uptime?: number; // seconds
}

export interface SystemService {
  readonly name: string;
  readonly displayName: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  reload(): Promise<void>;
  status(): Promise<ServiceInfo>;
  isInstalled(): Promise<boolean>;
}
