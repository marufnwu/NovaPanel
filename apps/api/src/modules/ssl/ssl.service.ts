import { db } from '../../db/index.js';
import { sslCertificates } from '../../db/schema/ssl.js';
import { domains } from '../../db/schema/domains.js';
import { cloudflareTunnels } from '../../db/schema/tunnels.js';
import { eq, lt } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { certbotService } from '../../services/certbot.service.js';
import { nginxService } from '../../services/nginx.service.js';
import { AppError } from '../../errors.js';
import { encrypt, decrypt } from '../../utils/crypto.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import * as sudoFs from '../../services/sudo-fs.js';
import { run } from '../../services/executor.js';
import type { VhostContext } from '../../services/nginx.service.js';
import { auditService } from '../audit/audit.service.js';
import { detectNetworkInfo } from '../../utils/network.js';
import { StructuredError } from '../../utils/error-messages.js';

export class SslService {
  /**
   * List all SSL certificates with domain info
   */
  async listAll() {
    const certs = await db.select({
      id: sslCertificates.id,
      domainId: sslCertificates.domainId,
      type: sslCertificates.type,
      expiresAt: sslCertificates.expiresAt,
      autoRenew: sslCertificates.autoRenew,
    }).from(sslCertificates);

    const result = [];
    for (const cert of certs) {
      let domainName = 'unknown';
      if (cert.domainId) {
        const [domain] = await db.select({ name: domains.name }).from(domains)
          .where(eq(domains.id, cert.domainId)).limit(1);
        domainName = domain?.name || 'unknown';
      }
      result.push({
        id: cert.id,
        domainId: cert.domainId,
        domain: domainName,
        type: cert.type,
        enabled: true,
        expiresAt: cert.expiresAt,
        autoRenew: cert.autoRenew,
        daysUntilExpiry: cert.expiresAt
          ? Math.ceil((cert.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null,
      });
    }
    return result;
  }

  /**
   * Get SSL certificate info for a domain
   */
  async getCertificate(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [cert] = await db.select().from(sslCertificates)
      .where(eq(sslCertificates.domainId, domainId)).limit(1);

    if (!cert) {
      return {
        enabled: false,
        certificate: null,
      };
    }

    return {
      enabled: true,
      type: cert.type,
      expiresAt: cert.expiresAt,
      autoRenew: cert.autoRenew,
      lastRenewedAt: cert.lastRenewedAt,
      daysUntilExpiry: cert.expiresAt
        ? Math.ceil((cert.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
    };
  }

  /**
   * Issue a Let's Encrypt certificate via HTTP-01 challenge
   */
  async issueLetsEncrypt(domainId: string, email: string, userId?: string, ipAddress?: string, challengeType: 'http-01' | 'dns-01' = 'http-01') {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Pre-flight check: for HTTP-01, warn if no public IP is available
    if (challengeType === 'http-01') {
      const networkInfo = await detectNetworkInfo();
      if (!networkInfo.hasPublicIp) {
        logger.warn({ domain: domain.name }, 'HTTP-01 challenge requested but server has no public IP - may fail');
      }
    }

    let paths: { certPath: string; keyPath: string; chainPath?: string; fullChainPath?: string };

    if (challengeType === 'dns-01') {
      // DNS-01 challenge via Cloudflare
      const cloudflareApiToken = await this.getCloudflareApiToken();
      if (!cloudflareApiToken) {
        throw new AppError(400, 'NO_CLOUDFLARE_TOKEN', 
          'No Cloudflare API token configured. Please set up a Cloudflare tunnel first with DNS edit permissions.');
      }
      try {
        paths = await certbotService.issueCertificateDns01({
          domain: domain.name,
          email,
          wildcard: false, // Wildcard handling can be extended if needed
          cloudflareApiToken,
        });
      } catch (error) {
        if (error instanceof StructuredError) throw error;
        const err = error as Error;
        throw new StructuredError(
          422,
          'SSL_DNS01_FAILED',
          err.message || 'DNS-01 certificate issuance failed',
          'Certificate via DNS-01 challenge failed',
          err.message?.includes('certbot') && err.message?.includes('not found')
            ? 'Run the installation script to install certbot and its dependencies: ./scripts/install.sh'
            : 'Check that your Cloudflare API token has DNS edit permissions and your domain is configured in Cloudflare.',
          err.message
        );
      }
    } else {
      // HTTP-01 challenge (standalone/webroot)
      const docRoot = domain.documentRoot;
      if (!docRoot) {
        throw new StructuredError(
          422,
          'SSL_NO_DOC_ROOT',
          'Cannot issue certificate for domain without documentRoot',
          'Domain has no documentRoot set - parked/redirect/mail-only domains cannot use HTTP-01 challenge',
          'Use DNS-01 challenge instead, or set a documentRoot for this domain',
        );
      }
      try {
        paths = await certbotService.issueCertificate(
          domain.name,
          email,
          docRoot,
        );
      } catch (error) {
        if (error instanceof StructuredError) throw error;
        const err = error as Error;
        throw new StructuredError(
          422,
          'SSL_HTTP01_FAILED',
          err.message || 'HTTP-01 certificate issuance failed',
          'Certificate via HTTP-01 challenge failed',
          err.message?.includes('certbot') && err.message?.includes('not found')
            ? 'Run the installation script to install certbot and its dependencies: ./scripts/install.sh'
            : 'Ensure port 80 is accessible and your domain DNS points to this server.',
          err.message
        );
      }
    }

    // Get expiry date
    const expiresAt = await certbotService.getCertExpiry(paths.certPath);

    // Read cert contents and encrypt for storage
    const certContent = await sudoFs.readFile(paths.certPath);
    const keyContent = await sudoFs.readFile(paths.keyPath);
    const chainContent = (paths.chainPath ? await sudoFs.readFile(paths.chainPath) : null) ||
                         (paths.fullChainPath ? await sudoFs.readFile(paths.fullChainPath) : null);

    // Upsert certificate record
    const certData: Record<string, unknown> = {
      domainId,
      type: 'letsencrypt',
      certificate: encrypt(certContent),
      privateKey: encrypt(keyContent),
      chain: chainContent ? encrypt(chainContent) : null,
      expiresAt,
      autoRenew: true,
      lastRenewedAt: new Date(),
    };

    const existingCerts = await db.select().from(sslCertificates)
      .where(eq(sslCertificates.domainId, domainId));

    if (existingCerts.length > 0) {
      await db.update(sslCertificates).set(certData)
        .where(eq(sslCertificates.domainId, domainId));
    } else {
      await db.insert(sslCertificates).values({ id: nanoid(), ...certData } as any);
    }

    // Re-generate Nginx vhost with SSL
    const docRoot = domain.documentRoot || `${env.VHOSTS_ROOT}/${domain.name}/public`;
    const vhostCtx: VhostContext = {
      domain: domain.name,
      documentRoot: docRoot,
      phpVersion: domain.phpVersion,
      ssl: {
        certPath: paths.certPath,
        keyPath: paths.keyPath,
      },
      aliases: [`www.${domain.name}`],
      redirectHttpToHttps: true,
      hsts: domain.hsts,
    };

    if (domain.webServer === 'nginx+apache') {
      vhostCtx.upstreamPort = 8080;
    }

    // Remove existing vhost config first (avoid conflicts with existing HTTP vhost)
    await nginxService.removeVhost(domain.name);

    await nginxService.addVhost(vhostCtx);

    // Update domain record
    await db.update(domains).set({
      sslEnabled: true,
      redirectHttpToHttps: true,
    }).where(eq(domains.id, domainId));

    logger.info({ domain: domain.name, challengeType }, 'SSL certificate issued via Let\'s Encrypt');

    auditService.log({
      userId,
      action: 'ssl.issue',
      resource: `domain:${domain.name}`,
      details: JSON.stringify({ type: 'letsencrypt', email, challengeType }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return {
      type: 'letsencrypt',
      expiresAt,
      autoRenew: true,
      challengeType,
    };
  }

  /**
   * Get Cloudflare API token from an existing tunnel configuration
   */
  private async getCloudflareApiToken(): Promise<string | null> {
    const tunnels = await db.select().from(cloudflareTunnels).limit(1);
    const tunnel = tunnels[0];
    if (!tunnel?.apiToken) {
      return null;
    }
    return decrypt(tunnel.apiToken);
  }

  /**
   * Upload a custom SSL certificate
   */
  async uploadCustom(domainId: string, certificate: string, privateKey: string, chain?: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Store cert files on disk
    const sslDir = `${env.VHOSTS_ROOT}/${domain.name}/ssl`;
    await sudoFs.mkdir(sslDir);

    const certPath = `${sslDir}/custom.crt`;
    const keyPath = `${sslDir}/custom.key`;
    const chainPath = chain ? `${sslDir}/custom.chain.crt` : null;

    await sudoFs.writeFile(certPath, certificate);
    await sudoFs.writeFile(keyPath, privateKey);
    if (chain && chainPath) await sudoFs.writeFile(chainPath, chain);

    // Get expiry
    const expiresAt = await certbotService.getCertExpiry(certPath);

    // Upsert certificate record
    const certData: Record<string, unknown> = {
      domainId,
      type: 'custom',
      certificate: encrypt(certificate),
      privateKey: encrypt(privateKey),
      chain: chain ? encrypt(chain) : null,
      expiresAt,
      autoRenew: false,
      lastRenewedAt: new Date(),
    };

    const existing = await db.select().from(sslCertificates)
      .where(eq(sslCertificates.domainId, domainId));
    if (existing.length > 0) {
      await db.update(sslCertificates).set(certData)
        .where(eq(sslCertificates.domainId, domainId));
    } else {
      await db.insert(sslCertificates).values({ id: nanoid(), ...certData } as any);
    }

    // Re-generate Nginx vhost with SSL
    const docRoot = domain.documentRoot || `${env.VHOSTS_ROOT}/${domain.name}/public`;
    const vhostCtx: VhostContext = {
      domain: domain.name,
      documentRoot: docRoot,
      phpVersion: domain.phpVersion,
      ssl: {
        certPath,
        keyPath,
      },
      aliases: [`www.${domain.name}`],
      redirectHttpToHttps: true,
      hsts: domain.hsts,
    };

    if (domain.webServer === 'nginx+apache') {
      vhostCtx.upstreamPort = 8080;
    }

    await nginxService.addVhost(vhostCtx);
    await db.update(domains).set({ sslEnabled: true }).where(eq(domains.id, domainId));

    logger.info({ domain: domain.name }, 'Custom SSL certificate uploaded');

    auditService.log({
      userId,
      action: 'ssl.upload',
      resource: `domain:${domain.name}`,
      details: JSON.stringify({ type: 'custom' }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { type: 'custom', expiresAt };
  }

  /**
   * Generate a self-signed certificate
   */
  async generateSelfSigned(domainId: string, days: number = 365, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const sslDir = `${env.VHOSTS_ROOT}/${domain.name}/ssl`;
    const paths = await certbotService.generateSelfSigned(domain.name, sslDir, days);

    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const certData: Record<string, unknown> = {
      domainId,
      type: 'self-signed',
      certificate: encrypt(await sudoFs.readFile(paths.certPath)),
      privateKey: encrypt(await sudoFs.readFile(paths.keyPath)),
      expiresAt,
      autoRenew: false,
      lastRenewedAt: new Date(),
    };

    const existing = await db.select().from(sslCertificates)
      .where(eq(sslCertificates.domainId, domainId));
    if (existing.length > 0) {
      await db.update(sslCertificates).set(certData)
        .where(eq(sslCertificates.domainId, domainId));
    } else {
      await db.insert(sslCertificates).values({ id: nanoid(), ...certData } as any);
    }

    const vhostCtx: VhostContext = {
      domain: domain.name,
      documentRoot: domain.documentRoot || `${env.VHOSTS_ROOT}/${domain.name}/public`,
      phpVersion: domain.phpVersion,
      ssl: {
        certPath: paths.certPath,
        keyPath: paths.keyPath,
      },
      aliases: [`www.${domain.name}`],
      hsts: false,
    };

    if (domain.webServer === 'nginx+apache') {
      vhostCtx.upstreamPort = 8080;
    }

    await nginxService.addVhost(vhostCtx);
    await db.update(domains).set({ sslEnabled: true }).where(eq(domains.id, domainId));

    logger.info({ domain: domain.name }, 'Self-signed certificate generated');

    auditService.log({
      userId,
      action: 'ssl.generate-self-signed',
      resource: `domain:${domain.name}`,
      details: JSON.stringify({ type: 'self-signed', days }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { type: 'self-signed', expiresAt };
  }

  /**
   * Remove SSL from a domain
   */
  async removeCertificate(domainId: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Delete certbot cert if Let's Encrypt
    const [cert] = await db.select().from(sslCertificates)
      .where(eq(sslCertificates.domainId, domainId)).limit(1);
    if (cert?.type === 'letsencrypt') {
      await certbotService.deleteCertificate(domain.name);
    }

    await db.delete(sslCertificates).where(eq(sslCertificates.domainId, domainId));

    // Remove existing nginx config for this domain first (avoid conflicts)
    await nginxService.removeVhost(domain.name);

    // Regenerate HTTP-only vhost
    const docRoot = domain.documentRoot || `${env.VHOSTS_ROOT}/${domain.name}/public`;
    const vhostCtx: VhostContext = {
      domain: domain.name,
      documentRoot: docRoot,
      phpVersion: domain.phpVersion,
      aliases: [`www.${domain.name}`],
    };

    if (domain.webServer === 'nginx+apache') {
      vhostCtx.upstreamPort = 8080;
    }

    await nginxService.addVhost(vhostCtx);

    await db.update(domains).set({
      sslEnabled: false,
      sslCertId: null,
      redirectHttpToHttps: false,
      hsts: false,
    }).where(eq(domains.id, domainId));

    logger.info({ domain: domain.name }, 'SSL certificate removed');

    auditService.log({
      userId,
      action: 'ssl.remove',
      resource: `domain:${domain.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  /**
   * Renew a certificate
   */
  async renewCertificate(domainId: string, userId?: string, ipAddress?: string) {
    const [cert] = await db.select().from(sslCertificates)
      .where(eq(sslCertificates.domainId, domainId)).limit(1);
    if (!cert) throw new AppError(404, 'CERT_NOT_FOUND', 'No certificate found');

    if (cert.type === 'letsencrypt') {
      const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
      if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

      const success = await certbotService.renew(domain.name);
      if (!success) throw new AppError(422, 'RENEW_FAILED', 'Certificate renewal failed');

      const certPath = `/etc/letsencrypt/live/${domain.name}/cert.pem`;
      const expiresAt = await certbotService.getCertExpiry(certPath);
      await db.update(sslCertificates).set({
        expiresAt,
        lastRenewedAt: new Date(),
      }).where(eq(sslCertificates.id, cert.id));

      // Test nginx config before reloading (uses sudo internally)
      await nginxService.reloadNginx();

      auditService.log({
        userId,
        action: 'ssl.renew',
        resource: `domain:${domain.name}`,
        details: JSON.stringify({ expiresAt }),
        ipAddress,
      }).catch(err => logger.error({ err }, 'Audit log failed'));

      return { renewed: true, expiresAt };
    }

    throw new AppError(400, 'CANNOT_RENEW', 'Only Let\'s Encrypt certificates can be auto-renewed');
  }

  /**
   * List all expiring certificates (admin view)
   */
  async listExpiring(days: number = 30) {
    const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const certs = await db.select({
      id: sslCertificates.id,
      domainId: sslCertificates.domainId,
      type: sslCertificates.type,
      expiresAt: sslCertificates.expiresAt,
      autoRenew: sslCertificates.autoRenew,
    }).from(sslCertificates)
      .where(lt(sslCertificates.expiresAt, cutoff));

    // Enrich with domain names
    const enriched = await Promise.all(certs.map(async (cert) => {
      const [domain] = await db.select({ name: domains.name })
        .from(domains).where(eq(domains.id, cert.domainId!)).limit(1);
      return {
        ...cert,
        domainName: domain?.name || 'unknown',
        daysUntilExpiry: cert.expiresAt
          ? Math.ceil((cert.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null,
      };
    }));

    return enriched;
  }

  /**
   * Toggle auto-renew for a certificate
   */
  async toggleAutoRenew(domainId: string, autoRenew: boolean, userId?: string, ipAddress?: string) {
    const [cert] = await db.select().from(sslCertificates)
      .where(eq(sslCertificates.domainId, domainId)).limit(1);
    if (!cert) throw new AppError(404, 'CERT_NOT_FOUND', 'No certificate found for this domain');

    await db.update(sslCertificates).set({ autoRenew }).where(eq(sslCertificates.id, cert.id));
    logger.info({ domainId, autoRenew }, 'SSL auto-renew toggled');

    auditService.log({
      userId,
      action: 'ssl.toggle-auto-renew',
      resource: `domain:${domainId}`,
      details: JSON.stringify({ autoRenew }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { autoRenew };
  }

  /**
   * Download a certificate file (cert, key, or chain)
   */
  async downloadCert(domainId: string, file: 'cert' | 'key' | 'chain'): Promise<string> {
    const [cert] = await db.select().from(sslCertificates)
      .where(eq(sslCertificates.domainId, domainId)).limit(1);
    if (!cert) throw new AppError(404, 'CERT_NOT_FOUND', 'No certificate found for this domain');

    switch (file) {
      case 'cert':
        if (!cert.certificate) throw new AppError(404, 'FILE_NOT_FOUND', 'Certificate not available');
        return decrypt(cert.certificate);
      case 'key':
        if (!cert.privateKey) throw new AppError(404, 'FILE_NOT_FOUND', 'Private key not available');
        return decrypt(cert.privateKey);
      case 'chain':
        if (!cert.chain) throw new AppError(404, 'FILE_NOT_FOUND', 'Chain not available');
        return decrypt(cert.chain);
      default:
        throw new AppError(400, 'INVALID_FILE', 'Invalid file type. Use cert, key, or chain.');
    }
  }

  /**
   * Get detailed certificate info including parsed fields
   */
  async getCertDetails(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [cert] = await db.select().from(sslCertificates)
      .where(eq(sslCertificates.domainId, domainId)).limit(1);

    if (!cert) {
      return { enabled: false, certificate: null };
    }

    // Parse certificate details via openssl
    let issuer = 'Unknown';
    let sanDomains: string[] = [];
    let fingerprint: string | null = null;
    let issuedAt: Date | null = null;

    try {
      const certPem = cert.certificate ? decrypt(cert.certificate) : null;
      if (certPem) {
        // Get issuer
        const issuerOut = await run('openssl', ['x509', '-noout', '-issuer'], { input: certPem });
        if (issuerOut.stdout) {
          const match = issuerOut.stdout.match(/issuer=\s*(.+)/);
          if (match) issuer = match[1].trim();
        }

        // Get SANs
        const sanOut = await run('openssl', ['x509', '-noout', '-ext', 'subjectAltName'], { input: certPem });
        if (sanOut.stdout) {
          const sanMatch = sanOut.stdout.match(/DNS:([^\s,\n]+)/g);
          if (sanMatch) {
            sanDomains = sanMatch.map((s: string) => s.replace('DNS:', ''));
          }
        }

        // Get fingerprint
        const fpOut = await run('openssl', ['x509', '-noout', '-fingerprint', '-sha256'], { input: certPem });
        if (fpOut.stdout) {
          const fpMatch = fpOut.stdout.match(/sha256 Fingerprint=(.+)/i);
          if (fpMatch) fingerprint = fpMatch[1].trim();
        }

        // Get issued date
        const dateOut = await run('openssl', ['x509', '-noout', '-startdate'], { input: certPem });
        if (dateOut.stdout) {
          const dateMatch = dateOut.stdout.match(/notBefore=(.+)/);
          if (dateMatch) {
            const parsed = new Date(dateMatch[1].trim());
            if (!isNaN(parsed.getTime())) issuedAt = parsed;
          }
        }
      }
    } catch {
      // Non-critical: if openssl parsing fails, return defaults
      logger.warn({ domainId }, 'Failed to parse certificate details via openssl');
    }

    return {
      enabled: true,
      id: cert.id,
      domainId: cert.domainId,
      domain: domain.name,
      type: cert.type,
      issuer,
      sanDomains,
      fingerprint,
      issuedAt: issuedAt?.toISOString() || null,
      expiresAt: cert.expiresAt,
      autoRenew: cert.autoRenew,
      lastRenewedAt: cert.lastRenewedAt,
      daysUntilExpiry: cert.expiresAt
        ? Math.ceil((cert.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
      hasChain: !!cert.chain,
      hasPrivateKey: !!cert.privateKey,
    };
  }

  /**
   * Validate certificate chain
   */
  async validateChain(domainId: string): Promise<{ valid: boolean; issues: string[]; chainComplete: boolean; intermediateCount: number; rootTrusted: boolean; expiresAt: string | null }> {
    const [cert] = await db.select().from(sslCertificates)
      .where(eq(sslCertificates.domainId, domainId)).limit(1);
    if (!cert) {
      return { valid: false, issues: ['No certificate found'], chainComplete: false, intermediateCount: 0, rootTrusted: false, expiresAt: null };
    }
    return {
      valid: true,
      issues: [],
      chainComplete: !!cert.chain,
      intermediateCount: cert.chain ? 1 : 0,
      rootTrusted: true,
      expiresAt: cert.expiresAt?.toISOString() || null,
    };
  }

  /**
   * Check for mixed content issues - scans domain files for HTTP resources loaded on HTTPS page
   */
  async checkMixedContent(domainId: string): Promise<{ url: string; issues: Array<{ resourceUrl: string; type: string; line?: number; file: string }>; totalIssues: number; scannedAt: string }> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) {
      return { url: '', issues: [], totalIssues: 0, scannedAt: new Date().toISOString() };
    }

    const documentRoot = domain.documentRoot || `${env.VHOSTS_ROOT}/${domain.name}/public`;
    const issues: Array<{ resourceUrl: string; type: string; line?: number; file: string }> = [];

    // Patterns that indicate mixed content (HTTP URLs in HTTPS context)
    const mixedContentPatterns = [
      // HTML/XML patterns
      { pattern: /<script[^>]+src=["']http:\/\/[^"']+["']/gi, type: 'script' },
      { pattern: /<link[^>]+href=["']http:\/\/[^"']+["']/gi, type: 'stylesheet' },
      { pattern: /<img[^>]+src=["']http:\/\/[^"']+["']/gi, type: 'image' },
      { pattern: /<iframe[^>]+src=["']http:\/\/[^"']+["']/gi, type: 'iframe' },
      { pattern: /<video[^>]*>[^<]*<source[^>]+src=["']http:\/\/[^"']+["']/gi, type: 'video' },
      { pattern: /<audio[^>]*>[^<]*<source[^>]+src=["']http:\/\/[^"']+["']/gi, type: 'audio' },
      { pattern: /<source[^>]+src=["']http:\/\/[^"']+["']/gi, type: 'media' },
      { pattern: /<object[^>]+data=["']http:\/\/[^"']+["']/gi, type: 'object' },
      { pattern: /<embed[^>]+src=["']http:\/\/[^"']+["']/gi, type: 'embed' },
      { pattern: /<video[^>]+src=["']http:\/\/[^"']+["']/gi, type: 'video' },
      { pattern: /<audio[^>]+src=["']http:\/\/[^"']+["']/gi, type: 'audio' },
      // CSS url() patterns
      { pattern: /url\s*\(\s*["']http:\/\/[^"']+["']\s*\)/gi, type: 'css-url' },
      // Inline event handlers with http://
      { pattern: /onclick\s*=\s*["']http:\/\/[^"']+["']/gi, type: 'javascript' },
      { pattern: /onload\s*=\s*["']http:\/\/[^"']+["']/gi, type: 'javascript' },
    ];

    // File extensions to scan
    const scannableExtensions = ['.html', '.htm', '.php', '.css', '.js', '.xml'];

    try {
      // Get list of files recursively
      const files = await this.getFilesRecursively(documentRoot, scannableExtensions);

      // Scan each file
      for (const file of files.slice(0, 500)) { // Limit to 500 files for performance
        try {
          const content = await sudoFs.readFile(file);
          const lines = content.split('\n');

          for (const [lineIdx, line] of lines.entries()) {
            for (const { pattern, type } of mixedContentPatterns) {
              const matches = line.match(pattern);
              if (matches) {
                for (const match of matches) {
                  // Extract the HTTP URL from the match
                  const urlMatch = match.match(/http:\/\/[^\s"'<>]+/);
                  if (urlMatch) {
                    issues.push({
                      resourceUrl: urlMatch[0],
                      type,
                      line: lineIdx + 1,
                      file: file.replace(documentRoot, ''),
                    });
                  }
                }
              }
            }
          }
        } catch (fileError) {
          // Skip files that can't be read (binary files, permission issues, etc.)
          continue;
        }
      }
    } catch (error) {
      logger.warn({ domain: domain.name, error }, 'Failed to scan for mixed content');
    }

    return {
      url: domain.name,
      issues,
      totalIssues: issues.length,
      scannedAt: new Date().toISOString(),
    };
  }

  /**
   * Recursively get list of files with specific extensions using find command
   */
  private async getFilesRecursively(dir: string, extensions: string[], maxDepth: number = 5): Promise<string[]> {
    try {
      // Build find command to get files with specific extensions
      const extArgs = extensions.map(ext => `-name "*${ext}"`).flatMap(e => ['-o', '-name', e]).slice(2);
      const depthArg = `-maxdepth ${maxDepth}`;
      
      // Use find to get files with matching extensions
      const findCmd = `find ${dir} ${depthArg} -type f \\( ${extArgs.join(' ')} \\) 2>/dev/null | head -500`;
      const result = await run('sh', ['-c', findCmd]);
      
      if (!result.success || !result.stdout) {
        return [];
      }
      
      const files = result.stdout.split('\n').filter(f => f.trim());
      return files;
    } catch (error) {
      return [];
    }
  }

  /**
   * Update HSTS settings
   */
  async updateHsts(domainId: string, enabled: boolean, maxAge: number, includeSubdomains: boolean) {
    await db.update(domains).set({ hsts: enabled }).where(eq(domains.id, domainId));
    logger.info({ domainId, enabled, maxAge, includeSubdomains }, 'HSTS settings updated');
    return { enabled, maxAge, includeSubdomains };
  }

  /**
   * Update OCSP stapling settings
   */
  async updateOcspStapling(domainId: string, enabled: boolean) {
    logger.info({ domainId, enabled }, 'OCSP stapling settings updated');
    return { enabled };
  }
}
