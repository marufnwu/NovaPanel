export * from './types.js';
export { Pm2Manager, pm2Manager } from './pm2.manager.js';
export { SystemdManager, systemdManager } from './systemd.manager.js';

// Factory function to get the best available process manager
import { pm2Manager } from './pm2.manager.js';
import { systemdManager } from './systemd.manager.js';
import { ProcessManager } from './types.js';

export async function getProcessManager(): Promise<ProcessManager> {
  if (await pm2Manager.isAvailable()) {
    return pm2Manager;
  }
  
  if (await systemdManager.isAvailable()) {
    return systemdManager;
  }
  
  // Fallback to PM2 if nothing else available
  return pm2Manager;
}