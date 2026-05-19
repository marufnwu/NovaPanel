export interface ProcessStatus {
  running: boolean;
  pid?: number;
  uptime?: number;      // seconds
  memoryMb?: number;
  cpuPercent?: number;
  restartCount: number;
  status: 'online' | 'stopped' | 'errored' | 'launching';
}

export interface ProcessConfig {
  name: string;
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  replicas?: number;
  healthCheckPath?: string;
  logFile?: string;
  errorFile?: string;
}

export interface ProcessManager {
  /**
   * Start a process
   */
  start(config: ProcessConfig): Promise<void>;

  /**
   * Stop a process
   */
  stop(name: string): Promise<void>;

  /**
   * Restart a process
   */
  restart(name: string): Promise<void>;

  /**
   * Get process status
   */
  getStatus(name: string): Promise<ProcessStatus>;

  /**
   * Get process logs
   */
  logs(name: string, lines?: number): Promise<string>;

  /**
   * Delete a process
   */
  delete(name: string): Promise<void>;

  /**
   * Check if process manager is available
   */
  isAvailable(): Promise<boolean>;
}