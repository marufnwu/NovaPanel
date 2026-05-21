import { db } from '../../db/index.js';
import { domains } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { AppError } from '../../errors.js';
import { nginxService } from '../../services/nginx.service.js';

export class WebServerService {
  async applyWebsiteConfig(_websiteId: string) {
    throw new AppError(501, 'NOT_IMPLEMENTED', 'Website-based config not available in v5 - use domain config');
  }

  async removeWebsiteConfig(_websiteId: string) {
    throw new AppError(501, 'NOT_IMPLEMENTED', 'Website-based config not available in v5 - use domain config');
  }

  async getConfig(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'NOT_FOUND', 'Domain not found');
    return nginxService.renderVhostConfig({
      domain: domain.name,
      documentRoot: `/var/www/${domain.projectId}/${domain.siteId || 'default'}`,
      phpVersion: '8.3',
      ssl: undefined,
      redirectHttpToHttps: domain.forceHttps,
      hsts: domain.hstsEnabled,
    });
  }

  async getConfigByName(domainName: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.name, domainName)).limit(1);
    if (!domain) throw new AppError(404, 'NOT_FOUND', 'Domain not found');
    return this.getConfig(domain.id);
  }

  async updateConfig(domainId: string, _userId: string | undefined, data: any) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'NOT_FOUND', 'Domain not found');
    await db.update(domains).set({
      ...(data.forceHttps !== undefined && { forceHttps: data.forceHttps }),
      ...(data.hstsEnabled !== undefined && { hstsEnabled: data.hstsEnabled }),
      ...(data.customNginxConfig !== undefined && { customNginxConfig: data.customNginxConfig }),
    }).where(eq(domains.id, domainId));
    return this.getConfig(domainId);
  }

  async updateConfigByName(domainName: string, userId: string | undefined, data: any) {
    const [domain] = await db.select().from(domains).where(eq(domains.name, domainName)).limit(1);
    if (!domain) throw new AppError(404, 'NOT_FOUND', 'Domain not found');
    return this.updateConfig(domain.id, userId, data);
  }

  async previewConfig(domainId: string) {
    return this.getConfig(domainId);
  }

  async testConfig(_domainId: string) {
    return nginxService.testConfig();
  }

  async listDomains() {
    return db.select({ id: domains.id, name: domains.name, siteId: domains.siteId, status: domains.status }).from(domains);
  }

  async getErrorPages(_domainName: string) {
    return [];
  }

  async updateErrorPages(_domainName: string, _errorPages: any[], _userId?: string) {
    return { success: true };
  }

  async getRateLimitConfig(_domainName: string) {
    return { enabled: false, requestsPerSecond: 10, burstSize: 20, timeoutSeconds: 60 };
  }

  async updateRateLimitConfig(_domainName: string, _data: any, _userId?: string) {
    return { success: true };
  }
}

export const webServerService = new WebServerService();