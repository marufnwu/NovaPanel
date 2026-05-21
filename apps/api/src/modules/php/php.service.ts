import { db } from '../../db/index.js';
import { domains } from '../../db/schema/domains.js';
import { eq } from 'drizzle-orm';
import { AppError } from '../../errors.js';
import { phpFpmServices, PhpFpmService } from '../../services/php-fpm.service.js';
import { run } from '../../services/executor.js';
import { logger } from '../../config/logger.js';
import { auditService } from '../audit/audit.service.js';

export class PhpService {
  async listVersions() {
    return PhpFpmService.getInstalledVersions();
  }

  async getVersion(_version: string) {
    return { version: _version, status: 'available' };
  }

  async installVersion(_version: string, _userId?: string, _ipAddress?: string) {
    throw new AppError(501, 'NOT_IMPLEMENTED', 'PHP install requires OS-level package manager - use server terminal');
  }

  async uninstallVersion(_version: string, _userId?: string, _ipAddress?: string) {
    throw new AppError(501, 'NOT_IMPLEMENTED', 'PHP uninstall requires OS-level package manager - use server terminal');
  }

  async getSettings(_version: string) {
    return { disableFunctions: [], uploadMaxFilesize: '8M', postMaxSize: '8M', maxExecutionTime: 30, memoryLimit: '128M' };
  }

  async updateSettings(_version: string, _settings: Record<string, any>, _userId?: string, _ipAddress?: string) {
    throw new AppError(501, 'NOT_IMPLEMENTED', 'PHP settings requires php-fpm pool config files - not available in v5 schema');
  }

  async restartFpm(version: string, userId?: string, _ipAddress?: string) {
    const svc = phpFpmServices[version as keyof typeof phpFpmServices];
    if (!svc) throw new AppError(400, 'INVALID_VERSION', `PHP ${version} not available`);
    await svc.restart();
    auditService.log({ userId, action: 'php.restart', resource: `php:${version}`, ipAddress: _ipAddress }).catch(() => {});
    return { success: true };
  }

  async getPoolConfig(_version: string, _domainId: string) {
    return '';
  }

  async updatePoolConfig(_version: string, _domainId: string, _config: Record<string, any>, _userId?: string, _ipAddress?: string) {
    throw new AppError(501, 'NOT_IMPLEMENTED', 'PHP pool config update requires php-fpm pool config files - not available in v5 schema');
  }

  async listDisabledFunctions(_version: string) {
    return [];
  }

  async updateDisabledFunctions(_version: string, _functions: string[], _userId?: string, _ipAddress?: string) {
    throw new AppError(501, 'NOT_IMPLEMENTED', 'PHP functions update requires php-fpm pool config files - not available in v5 schema');
  }

  async getUploadLimits(_version: string) {
    return { uploadMaxFilesize: '8M', postMaxSize: '8M', maxExecutionTime: 30, maxInputTime: 60 };
  }

  async updateUploadLimits(_version: string, _limits: Record<string, any>, _userId?: string, _ipAddress?: string) {
    throw new AppError(501, 'NOT_IMPLEMENTED', 'PHP limits update requires php-fpm pool config files - not available in v5 schema');
  }

  async getOpcodeCacheSettings(_version: string) {
    return { enabled: false };
  }

  async updateOpcodeCacheSettings(_version: string, _settings: Record<string, any>, _userId?: string, _ipAddress?: string) {
    throw new AppError(501, 'NOT_IMPLEMENTED', 'PHP opcode cache update requires php-fpm pool config files - not available in v5 schema');
  }

  async getMemlimit(_version: string) {
    return '128M';
  }

  async setMemlimit(_version: string, _memlimit: string, _userId?: string, _ipAddress?: string) {
    throw new AppError(501, 'NOT_IMPLEMENTED', 'PHP memlimit set requires php-fpm pool config files - not available in v5 schema');
  }

  async listDomainsWithPhpVersion() {
    return db.select({ id: domains.id, name: domains.name, type: domains.type }).from(domains);
  }

  async setDomainPhpVersion(_domainId: string, _version: string, _userId?: string, _ipAddress?: string) {
    throw new AppError(501, 'NOT_IMPLEMENTED', 'PHP version set requires domain-level php version tracking - not available in v5 schema');
  }

  async bulkSetPhpVersion(_domainIds: string[], _version: string, _userId?: string, _ipAddress?: string) {
    throw new AppError(501, 'NOT_IMPLEMENTED', 'PHP bulk version set requires domain-level php version tracking - not available in v5 schema');
  }
}

export const phpService = new PhpService();