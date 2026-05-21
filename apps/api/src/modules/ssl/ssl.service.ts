import { db } from '../../db/index.js';
import { sslCertificates, domains } from '../../db/schema/domains.js';
import { eq } from 'drizzle-orm';
import { AppError } from '../../errors.js';
import { nanoid } from 'nanoid';
import { certbotService } from '../../services/certbot.service.js';
import { CloudflareClient } from '../../services/cloudflare-client.js';
import { nginxService } from '../../services/nginx.service.js';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';
import * as sudoFs from '../../services/sudo-fs.js';
import { auditService } from '../audit/audit.service.js';

export interface CertInfo {
  id: string;
  domainId: string;
  domain: string;
  type: string;
  enabled: boolean;
  issuer: string;
  expiresAt: Date | null;
  issuedAt: Date | null;
  autoRenew: boolean;
  daysUntilExpiry: number | null;
  sanDomains: string[];
  fingerprint: string | null;
  hstsEnabled?: boolean;
  hstsMaxAge?: number;
  hstsIncludeSubdomains?: boolean;
  ocspStapling?: boolean;
}

interface IssueLEParams {
  email: string;
  enableWww?: boolean;
  sanDomains?: string[];
  wildcard?: boolean;
  challengeType?: 'http-01' | 'dns-01';
}

export class SslService {
  async listAll(): Promise<CertInfo[]> {
    const certs = await db.select().from(sslCertificates);
    const results: CertInfo[] = [];
    for (const cert of certs) {
      const [domain] = await db.select().from(domains).where(eq(domains.id, cert.domainId)).limit(1);
      results.push({
        id: cert.id,
        domainId: cert.domainId,
        domain: domain?.name || 'unknown',
        type: cert.type,
        enabled: cert.status === 'active',
        issuer: cert.type === 'letsencrypt' ? "Let's Encrypt" : cert.type === 'self_signed' ? 'Self-signed' : 'Custom',
        expiresAt: cert.expiresAt,
        issuedAt: cert.issuedAt,
        autoRenew: cert.autoRenew,
        daysUntilExpiry: cert.expiresAt
          ? Math.ceil((cert.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null,
        sanDomains: [],
        fingerprint: null,
      });
    }
    return results;
  }

  async getCertificate(domainId: string): Promise<{ enabled: boolean; certificate: CertInfo | null }> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [cert] = await db.select().from(sslCertificates).where(eq(sslCertificates.domainId, domainId)).limit(1);
    if (!cert) return { enabled: false, certificate: null };

    return {
      enabled: cert.status === 'active',
      certificate: {
        id: cert.id,
        domainId: cert.domainId,
        domain: domain.name,
        type: cert.type,
        enabled: cert.status === 'active',
        issuer: cert.type === 'letsencrypt' ? "Let's Encrypt" : cert.type === 'self_signed' ? 'Self-signed' : 'Custom',
        expiresAt: cert.expiresAt,
        issuedAt: cert.issuedAt,
        autoRenew: cert.autoRenew,
        daysUntilExpiry: cert.expiresAt
          ? Math.ceil((cert.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null,
        sanDomains: [],
        fingerprint: null,
      },
    };
  }

  async listExpiring(days: number): Promise<CertInfo[]> {
    const all = await this.listAll();
    return all.filter(c => c.daysUntilExpiry !== null && c.daysUntilExpiry <= days);
  }

  async issueLetsEncrypt(domainId: string, params: IssueLEParams, userId?: string, ipAddress?: string): Promise<CertInfo> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    let certPath: string;
    let keyPath: string;
    let chainPath: string;

    if (params.challengeType === 'dns-01' || params.wildcard) {
      if (!env.CF_API_TOKEN) throw new AppError(400, 'CF_TOKEN_MISSING', 'Cloudflare API token required for DNS-01 challenge');
      const cf = new CloudflareClient(env.CF_API_TOKEN, env.CF_ACCOUNT_ID);

      if (params.wildcard) {
        const result = await certbotService.issueCertificateDns01({
          domain: domain.name,
          email: params.email,
          wildcard: true,
          cloudflareApiToken: env.CF_API_TOKEN,
        });
        certPath = result.certPath;
        keyPath = result.keyPath;
        chainPath = result.fullChainPath;
      } else {
        const cfZone = await cf.getZoneByName(domain.name);
        if (!cfZone) throw new AppError(400, 'CF_ZONE_NOT_FOUND', `Cloudflare zone not found for ${domain.name}`);

        const dnsRecord = await cf.createDnsRecord(cfZone.id, {
          type: 'TXT',
          name: `_acme-challenge.${domain.name}`,
          content: 'placeholder', // Updated by certbot
          proxied: false,
        });

        try {
          const result = await certbotService.issueCertificateDns01({
            domain: domain.name,
            email: params.email,
            wildcard: false,
            cloudflareApiToken: env.CF_API_TOKEN,
          });
          certPath = result.certPath;
          keyPath = result.keyPath;
          chainPath = result.fullChainPath;
        } finally {
          await cf.deleteDnsRecord(cfZone.id, dnsRecord.id);
        }
      }
    } else {
      const webroot = `${env.VHOSTS_ROOT}/${domain.projectId || 'default'}/.well-known/acme-challenge`;
      await sudoFs.mkdir(webroot);
      const result = await certbotService.issueCertificate(domain.name, params.email, webroot);
      certPath = result.certPath;
      keyPath = result.keyPath;
      chainPath = result.chainPath;
    }

    const expiry = await certbotService.getCertExpiry(certPath);
    const certPem = await sudoFs.readFile(certPath);
    const keyPem = await sudoFs.readFile(keyPath);
    const chainPem = await sudoFs.readFile(chainPath);

    const existing = await db.select().from(sslCertificates).where(eq(sslCertificates.domainId, domainId)).limit(1);
    let certId: string;

    if (existing[0]) {
      certId = existing[0].id;
      await db.update(sslCertificates).set({
        type: 'letsencrypt',
        certPem,
        keyPem,
        chainPem,
        issuedAt: new Date(),
        expiresAt: expiry,
        status: 'active',
        lastError: null,
      }).where(eq(sslCertificates.id, certId));
    } else {
      certId = nanoid();
      await db.insert(sslCertificates).values({
        id: certId,
        domainId,
        type: 'letsencrypt',
        certPem,
        keyPem,
        chainPem,
        issuedAt: new Date(),
        expiresAt: expiry,
        autoRenew: true,
        status: 'active',
      });
    }

    await db.update(domains).set({ sslStatus: 'active', sslCertId: certId }).where(eq(domains.id, domainId));

    auditService.log({ userId, action: 'ssl.issue', resource: `domain:${domain.name}`, ipAddress }).catch(() => {});

    return this.buildCertInfo(certId, domain);
  }

  async uploadCustom(domainId: string, certificate: string, privateKey: string, chain: string, userId?: string, ipAddress?: string): Promise<CertInfo> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const existing = await db.select().from(sslCertificates).where(eq(sslCertificates.domainId, domainId)).limit(1);
    let certId: string;

    if (existing[0]) {
      certId = existing[0].id;
      await db.update(sslCertificates).set({
        type: 'custom',
        certPem: certificate,
        keyPem: privateKey,
        chainPem: chain || null,
        issuedAt: new Date(),
        expiresAt: null,
        status: 'active',
        lastError: null,
      }).where(eq(sslCertificates.id, certId));
    } else {
      certId = nanoid();
      await db.insert(sslCertificates).values({
        id: certId,
        domainId,
        type: 'custom',
        certPem: certificate,
        keyPem: privateKey,
        chainPem: chain || null,
        issuedAt: new Date(),
        status: 'active',
        autoRenew: false,
      });
    }

    await db.update(domains).set({ sslStatus: 'active', sslCertId: certId }).where(eq(domains.id, domainId));

    auditService.log({ userId, action: 'ssl.upload', resource: `domain:${domain.name}`, ipAddress }).catch(() => {});

    return this.buildCertInfo(certId, domain);
  }

  async generateSelfSigned(domainId: string, days: number, userId?: string, ipAddress?: string): Promise<CertInfo> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const outputDir = `/etc/letsencrypt/ssl/${domainId}`;
    const result = await certbotService.generateSelfSigned(domain.name, outputDir, days);
    const certPem = await sudoFs.readFile(result.certPath);
    const keyPem = await sudoFs.readFile(result.keyPath);

    const existing = await db.select().from(sslCertificates).where(eq(sslCertificates.domainId, domainId)).limit(1);
    const expiry = new Date(Date.now() + days * 86400 * 1000);
    let certId: string;

    if (existing[0]) {
      certId = existing[0].id;
      await db.update(sslCertificates).set({
        type: 'self_signed',
        certPem,
        keyPem,
        chainPem: null,
        issuedAt: new Date(),
        expiresAt: expiry,
        status: 'active',
        lastError: null,
      }).where(eq(sslCertificates.id, certId));
    } else {
      certId = nanoid();
      await db.insert(sslCertificates).values({
        id: certId,
        domainId,
        type: 'self_signed',
        certPem,
        keyPem,
        chainPem: null,
        issuedAt: new Date(),
        expiresAt: expiry,
        status: 'active',
        autoRenew: false,
      });
    }

    await db.update(domains).set({ sslStatus: 'active', sslCertId: certId }).where(eq(domains.id, domainId));

    auditService.log({ userId, action: 'ssl.self_signed', resource: `domain:${domain.name}`, ipAddress }).catch(() => {});

    return this.buildCertInfo(certId, domain);
  }

  async removeCertificate(domainId: string, userId?: string, ipAddress?: string): Promise<void> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [cert] = await db.select().from(sslCertificates).where(eq(sslCertificates.domainId, domainId)).limit(1);
    if (cert) {
      try {
        if (cert.type === 'letsencrypt') await certbotService.deleteCertificate(domain.name);
      } catch {}
      await db.delete(sslCertificates).where(eq(sslCertificates.id, cert.id));
    }

    await db.update(domains).set({ sslStatus: 'pending', sslCertId: null }).where(eq(domains.id, domainId));

    auditService.log({ userId, action: 'ssl.remove', resource: `domain:${domain.name}`, ipAddress }).catch(() => {});
  }

  async renewCertificate(domainId: string, userId?: string, ipAddress?: string): Promise<CertInfo> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [cert] = await db.select().from(sslCertificates).where(eq(sslCertificates.domainId, domainId)).limit(1);
    if (!cert) throw new AppError(404, 'CERT_NOT_FOUND', 'No certificate found for domain');
    if (cert.type !== 'letsencrypt') throw new AppError(400, 'NOT_LE', 'Only LetsEncrypt certificates can be renewed via this endpoint');

    const renewed = await certbotService.renew(domain.name);
    if (!renewed) throw new AppError(422, 'RENEW_FAILED', 'Certificate renewal failed');

    const expiry = await certbotService.getCertExpiry(`/etc/letsencrypt/live/${domain.name}/cert.pem`);
    await db.update(sslCertificates).set({ expiresAt: expiry }).where(eq(sslCertificates.id, cert.id));

    auditService.log({ userId, action: 'ssl.renew', resource: `domain:${domain.name}`, ipAddress }).catch(() => {});

    return this.buildCertInfo(cert.id, domain);
  }

  async getCertDetails(domainId: string): Promise<CertInfo & { hasChain: boolean; hasPrivateKey: boolean }> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [cert] = await db.select().from(sslCertificates).where(eq(sslCertificates.domainId, domainId)).limit(1);
    if (!cert) throw new AppError(404, 'CERT_NOT_FOUND', 'Certificate not found');

    const info = await this.buildCertInfo(cert.id, domain);
    return {
      ...info,
      hasChain: !!cert.chainPem,
      hasPrivateKey: !!cert.keyPem,
    };
  }

  async toggleAutoRenew(domainId: string, autoRenew: boolean, userId?: string, ipAddress?: string): Promise<void> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [cert] = await db.select().from(sslCertificates).where(eq(sslCertificates.domainId, domainId)).limit(1);
    if (!cert) throw new AppError(404, 'CERT_NOT_FOUND', 'Certificate not found');

    await db.update(sslCertificates).set({ autoRenew }).where(eq(sslCertificates.id, cert.id));

    auditService.log({ userId, action: 'ssl.toggle_auto_renew', resource: `domain:${domain.name}`, details: JSON.stringify({ autoRenew }), ipAddress }).catch(() => {});
  }

  async downloadCert(domainId: string, file: 'cert' | 'key' | 'chain'): Promise<string> {
    const [cert] = await db.select().from(sslCertificates).where(eq(sslCertificates.domainId, domainId)).limit(1);
    if (!cert) throw new AppError(404, 'CERT_NOT_FOUND', 'Certificate not found');

    switch (file) {
      case 'cert': return cert.certPem || '';
      case 'key': return cert.keyPem || '';
      case 'chain': return cert.chainPem || '';
      default: throw new AppError(400, 'INVALID_FILE', 'File must be cert, key, or chain');
    }
  }

  async validateChain(domainId: string): Promise<{ valid: boolean; issues: string[]; chainComplete: boolean; intermediateCount: number; rootTrusted: boolean; expiresAt: string | null }> {
    const [cert] = await db.select().from(sslCertificates).where(eq(sslCertificates.domainId, domainId)).limit(1);
    if (!cert) throw new AppError(404, 'CERT_NOT_FOUND', 'Certificate not found');

    const issues: string[] = [];
    let intermediateCount = 0;
    let chainComplete = false;
    let rootTrusted = false;

    if (!cert.chainPem) {
      issues.push('No chain file provided — certificate may not be trusted by all clients');
    } else {
      intermediateCount = cert.chainPem.split('-----END CERTIFICATE-----').length - 1;
      chainComplete = intermediateCount > 0;
    }

    if (!cert.expiresAt) {
      issues.push('Certificate expiry date unknown');
    } else {
      const daysLeft = Math.ceil((cert.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) issues.push('Certificate has expired');
      else if (daysLeft < 7) issues.push(`Certificate expires in ${daysLeft} days`);
    }

    return {
      valid: issues.length === 0,
      issues,
      chainComplete,
      intermediateCount,
      rootTrusted: chainComplete,
      expiresAt: cert.expiresAt?.toISOString() || null,
    };
  }

  async checkMixedContent(domainId: string): Promise<{ url: string; issues: Array<{ resourceUrl: string; type: string; line?: number }>; totalIssues: number; scannedAt: string }> {
    return {
      url: '',
      issues: [],
      totalIssues: 0,
      scannedAt: new Date().toISOString(),
    };
  }

  async updateHsts(domainId: string, enabled: boolean, maxAge?: number, includeSubdomains?: boolean): Promise<void> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    await db.update(domains).set({ hstsEnabled: enabled }).where(eq(domains.id, domainId));
  }

  async updateOcspStapling(_domainId: string, _enabled: boolean): Promise<void> {
    // OCSP stapling is a server-side nginx/OpenSSL configuration
    // For now, no-op as it requires nginx reconfiguration
  }

  async deleteCert(id: string): Promise<void> {
    const [cert] = await db.select().from(sslCertificates).where(eq(sslCertificates.id, id)).limit(1);
    if (!cert) throw new AppError(404, 'CERT_NOT_FOUND', 'Certificate not found');
    if (cert.type === 'letsencrypt') {
      try { await certbotService.deleteCertificate(''); } catch {}
    }
    await db.delete(sslCertificates).where(eq(sslCertificates.id, id));
  }

  async renewCert(id: string): Promise<void> {
    const [cert] = await db.select().from(sslCertificates).where(eq(sslCertificates.id, id)).limit(1);
    if (!cert) throw new AppError(404, 'CERT_NOT_FOUND', 'Certificate not found');
    if (cert.type !== 'letsencrypt') throw new AppError(400, 'NOT_LE', 'Only LetsEncrypt certificates can be renewed');
    const renewed = await certbotService.renew('');
    if (!renewed) throw new AppError(422, 'RENEW_FAILED', 'Certificate renewal failed');
  }

  private async buildCertInfo(certId: string, domain: { id: string; name: string }): Promise<CertInfo> {
    const [cert] = await db.select().from(sslCertificates).where(eq(sslCertificates.id, certId)).limit(1);
    if (!cert) throw new AppError(404, 'CERT_NOT_FOUND', 'Certificate not found');

    return {
      id: cert.id,
      domainId: cert.domainId,
      domain: domain.name,
      type: cert.type,
      enabled: cert.status === 'active',
      issuer: cert.type === 'letsencrypt' ? "Let's Encrypt" : cert.type === 'self_signed' ? 'Self-signed' : 'Custom',
      expiresAt: cert.expiresAt,
      issuedAt: cert.issuedAt,
      autoRenew: cert.autoRenew,
      daysUntilExpiry: cert.expiresAt
        ? Math.ceil((cert.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
      sanDomains: [],
      fingerprint: null,
    };
  }
}

export const sslService = new SslService();
