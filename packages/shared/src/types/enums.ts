export enum UserRole {
  Admin = 'admin',
  Developer = 'developer',
  Viewer = 'viewer',
}

export enum ServerStatus {
  Online = 'online',
  Offline = 'offline',
  Unknown = 'unknown',
}

export enum SiteStatus {
  Provisioning = 'provisioning',
  Live = 'live',
  Stopped = 'stopped',
  Error = 'error',
}

export enum StackType {
  NodeJS = 'nodejs',
  Laravel = 'laravel',
  Python = 'python',
  Static = 'static',
  Docker = 'docker',
}

export enum AuthType {
  Key = 'key',
  Password = 'password',
}

export enum DeployStatus {
  Running = 'running',
  Success = 'success',
  Failed = 'failed',
}

export enum TunnelStatus {
  Connected = 'connected',
  Disconnected = 'disconnected',
  Installing = 'installing',
}

export enum AlertType {
  Cpu = 'cpu',
  Ram = 'ram',
  Disk = 'disk',
  SiteDown = 'site_down',
  DeployFail = 'deploy_fail',
}
