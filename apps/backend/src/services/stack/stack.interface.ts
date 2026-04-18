import { NodeJsDriver } from './nodejs.driver.js';
import { PhpDriver } from './php.driver.js';
import { LaravelDriver } from './laravel.driver.js';
import { PythonDriver } from './python.driver.js';

export function getDriver(stackType: string, phpVersion?: string): StackDriver {
  switch (stackType) {
    case 'nodejs': return new NodeJsDriver();
    case 'php': return new PhpDriver(phpVersion);
    case 'laravel': return new LaravelDriver(phpVersion);
    case 'python': return new PythonDriver();
    default: throw new Error(`Unsupported stack: ${stackType}`);
  }
}

export interface StackDriver {
  install(ctx: ProvisioningContext): Promise<void>;
  configure(ctx: ProvisioningContext): Promise<void>;
  start(ctx: ProvisioningContext): Promise<void>;
  stop(ctx: ProvisioningContext): Promise<void>;
  restart(ctx: ProvisioningContext): Promise<void>;
  getLogs(ctx: ProvisioningContext): Promise<string>;
  getStatus(ctx: ProvisioningContext): Promise<'running' | 'stopped' | 'error'>;
  deploy(ctx: ProvisioningContext): Promise<void>;
  uninstall(ctx: ProvisioningContext): Promise<void>;
}

export interface ProvisioningContext {
  siteId: string;
  serverId: string;
  domain: string;
  port: number;
  rootPath: string;
  gitUrl: string | null;
  gitBranch: string | null;
  envVars: Record<string, string>;
  // Callbacks for logging
  log: (step: string, message: string) => void;
}
