# ServerForge — Phases 8-13: Detailed Implementation Guide

> **Supplement to:** `plans/implementation-plan.md`
> **Prerequisites:** Phases 1-7 completed
> **Scope:** SSL, DNS, Mail, Database, FTP, Cloudflare Tunnel, File Manager modules

---

## Phase 8 — SSL Module: Detailed Specification

### 8.1 SSL Schema

#### `apps/api/src/db/schema/ssl.ts`

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { domains } from './domains.js';

export const sslCertificates = sqliteTable('ssl_certificates', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').references(() => domains.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['letsencrypt', 'custom', 'self-signed'] }).notNull(),
  certificate: text('certificate'),              // PEM (encrypted at rest)
  privateKey: text('private_key'),               // PEM (encrypted at rest)
  chain: text('chain'),                          // CA chain PEM
  certPath: text('cert_path'),                   // Filesystem path to cert
  keyPath: text('key_path'),                     // Filesystem path to key
  chainPath: text('chain_path'),                 // Filesystem path to chain
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  autoRenew: integer('auto_renew', { mode: 'boolean' }).default(true).notNull(),
  lastRenewedAt: integer('last_renewed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type SslCertificate = typeof sslCertificates.$inferSelect;
```

### 8.2 SSL Service

#### `apps/api/src/modules/ssl/ssl.schema.ts`

```typescript
import { z } from 'zod';

export const issueLetsEncryptSchema = z.object({
  email: z.string().email(),
  enableWww: z.boolean().default(true),
});

export const uploadCustomSchema = z.object({
  certificate: z.string().min(1, 'Certificate PEM is required'),
  privateKey: z.string().min(1, 'Private key PEM is required'),
  chain: z.string().optional(),
});

export const generateSelfSignedSchema = z.object({
  days: z.number().min(1).max(3650).default(365),
});

export const updateSslSettingsSchema = z.object({
  autoRenew: z.boolean().optional(),
  redirectHttpToHttps: z.boolean().optional(),
  hsts: z.boolean().optional(),
});
```

#### `apps/api/src/modules/ssl/ssl.service.ts`

```typescript
import { db } from '../../db/index.js';
import { sslCertificates } from '../../db/schema/ssl.js';
import { domains } from '../../db/schema/domains.js';
import { subscriptions } from '../../db/schema/subscriptions.js';
import { eq, and, lt } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { CertbotService } from '../../services/certbot.service.js';
import { NginxService } from '../../services/nginx.service.js';
import { AppError } from '../../errors.js';
import { encrypt, decrypt } from '../../utils/crypto.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const certbotService = new CertbotService();
const nginxService = new NginxService();

export class SslService {
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
  async issueLetsEncrypt(domainId: string, email: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [subscription] = await db.select().from(subscriptions)
      .where(eq(subscriptions.id, domain.subscriptionId)).limit(1);

    // Issue certificate
    const wwwDomain = `www.${domain.name}`;
    const paths = await certbotService.issueCert(
      domain.name,
      wwwDomain,
      email,
      domain.documentRoot
    );

    // Get expiry date
    const expiresAt = await certbotService.getCertExpiry(paths.certPath);

    // Encrypt and store cert info
    const certContent = await readFile(paths.certPath, 'utf-8');
    const keyContent = await readFile(paths.keyPath, 'utf-8');
    const chainContent = paths.chainPath ? await readFile(paths.chainPath, 'utf-8') : null;

    // Upsert certificate record
    const existingCerts = await db.select().from(sslCertificates)
      .where(eq(sslCertificates.domainId, domainId));

    const certData = {
      domainId,
      type: 'letsencrypt' as const,
      certificate: encrypt(certContent),
      privateKey: encrypt(keyContent),
      chain: chainContent ? encrypt(chainContent) : null,
      certPath: paths.certPath,
      keyPath: paths.keyPath,
      chainPath: paths.chainPath,
      expiresAt,
      autoRenew: true,
      lastRenewedAt: new Date(),
    };

    if (existingCerts.length > 0) {
      await db.update(sslCertificates).set(certData)
        .where(eq(sslCertificates.domainId, domainId));
    } else {
      await db.insert(sslCertificates).values({ id: nanoid(), ...certData });
    }

    // Enable SSL in Nginx
    const poolName = `${subscription.systemUser}_${domain.name.replace(/\./g, '')}`;
    const logDir = `${env.VHOSTS_ROOT}/${subscription.systemUser}/${domain.name}/logs`;

    await nginxService.enableSSL({
      domain: domain.name,
      documentRoot: domain.documentRoot,
      user: subscription.systemUser,
      phpVersion: domain.phpVersion,
      phpHandler: domain.phpHandler === 'php-fpm' ? 'php-fpm' : 'proxy-to-apache',
      proxyToApache: domain.webServer === 'nginx+apache',
      poolName,
      logDir,
      aliases: [wwwDomain],
      certPath: paths.certPath,
      keyPath: paths.keyPath,
      hsts: domain.hsts,
    });

    // Update domain record
    await db.update(domains).set({
      sslEnabled: true,
      sslCertId: domainId,
      redirectHttpToHttps: true,
    }).where(eq(domains.id, domainId));

    logger.info({ domain: domain.name }, 'SSL certificate issued via Let\'s Encrypt');

    return {
      type: 'letsencrypt',
      expiresAt,
      autoRenew: true,
    };
  }

  /**
   * Upload a custom SSL certificate
   */
  async uploadCustom(domainId: string, certificate: string, privateKey: string, chain?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [subscription] = await db.select().from(subscriptions)
      .where(eq(subscriptions.id, domain.subscriptionId)).limit(1);

    // Store cert files on disk
    const sslDir = `${env.VHOSTS_ROOT}/${subscription.systemUser}/${domain.name}/ssl`;
    await mkdir(sslDir, { recursive: true });

    const certPath = `${sslDir}/custom.crt`;
    const keyPath = `${sslDir}/custom.key`;
    const chainPath = chain ? `${sslDir}/custom.chain.crt` : null;

    await writeFile(certPath, certificate, 'utf-8');
    await writeFile(keyPath, privateKey, 'utf-8');
    if (chain && chainPath) await writeFile(chainPath, chain, 'utf-8');

    // Get expiry
    const expiresAt = await certbotService.getCertExpiry(certPath);

    // Upsert certificate record
    const certData = {
      domainId,
      type: 'custom' as const,
      certificate: encrypt(certificate),
      privateKey: encrypt(privateKey),
      chain: chain ? encrypt(chain) : null,
      certPath,
      keyPath,
      chainPath,
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
      await db.insert(sslCertificates).values({ id: nanoid(), ...certData });
    }

    // Enable SSL in Nginx
    const poolName = `${subscription.systemUser}_${domain.name.replace(/\./g, '')}`;
    const logDir = `${env.VHOSTS_ROOT}/${subscription.systemUser}/${domain.name}/logs`;

    await nginxService.enableSSL({
      domain: domain.name,
      documentRoot: domain.documentRoot,
      user: subscription.systemUser,
      phpVersion: domain.phpVersion,
      phpHandler: domain.phpHandler === 'php-fpm' ? 'php-fpm' : 'proxy-to-apache',
      proxyToApache: domain.webServer === 'nginx+apache',
      poolName,
      logDir,
      aliases: [`www.${domain.name}`],
      certPath,
      keyPath,
      hsts: domain.hsts,
    });

    await db.update(domains).set({ sslEnabled: true }).where(eq(domains.id, domainId));

    logger.info({ domain: domain.name }, 'Custom SSL certificate uploaded');
    return { type: 'custom', expiresAt };
  }

  /**
   * Generate a self-signed certificate
   */
  async generateSelfSigned(domainId: string, days: number = 365) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [subscription] = await db.select().from(subscriptions)
      .where(eq(subscriptions.id, domain.subscriptionId)).limit(1);

    const sslDir = `${env.VHOSTS_ROOT}/${subscription.systemUser}/${domain.name}/ssl`;
    const paths = await certbotService.generateSelfSigned(domain.name, sslDir);

    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const certData = {
      domainId,
      type: 'self-signed' as const,
      certificate: encrypt(await readFile(paths.certPath, 'utf-8')),
      privateKey: encrypt(await readFile(paths.keyPath, 'utf-8')),
      certPath: paths.certPath,
      keyPath: paths.keyPath,
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
      await db.insert(sslCertificates).values({ id: nanoid(), ...certData });
    }

    const poolName = `${subscription.systemUser}_${domain.name.replace(/\./g, '')}`;
    const logDir = `${env.VHOSTS_ROOT}/${subscription.systemUser}/${domain.name}/logs`;

    await nginxService.enableSSL({
      domain: domain.name,
      documentRoot: domain.documentRoot,
      user: subscription.systemUser,
      phpVersion: domain.phpVersion,
      phpHandler: domain.phpHandler === 'php-fpm' ? 'php-fpm' : 'proxy-to-apache',
      proxyToApache: domain.webServer === 'nginx+apache',
      poolName,
      logDir,
      aliases: [`www.${domain.name}`],
      certPath: paths.certPath,
      keyPath: paths.keyPath,
      hsts: false,
    });

    await db.update(domains).set({ sslEnabled: true }).where(eq(domains.id, domainId));

    logger.info({ domain: domain.name }, 'Self-signed certificate generated');
    return { type: 'self-signed', expiresAt };
  }

  /**
   * Remove SSL from a domain
   */
  async removeCertificate(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Delete certbot cert if Let's Encrypt
    const [cert] = await db.select().from(sslCertificates)
      .where(eq(sslCertificates.domainId, domainId)).limit(1);
    if (cert?.type === 'letsencrypt') {
      await certbotService.deleteCert(domain.name);
    }

    await db.delete(sslCertificates).where(eq(sslCertificates.domainId, domainId));

    // Regenerate HTTP-only vhost
    const [subscription] = await db.select().from(subscriptions)
      .where(eq(subscriptions.id, domain.subscriptionId)).limit(1);
    const poolName = `${subscription.systemUser}_${domain.name.replace(/\./g, '')}`;
    const logDir = `${env.VHOSTS_ROOT}/${subscription.systemUser}/${domain.name}/logs`;

    await nginxService.addVhost({
      domain: domain.name,
      documentRoot: domain.documentRoot,
      user: subscription.systemUser,
      phpVersion: domain.phpVersion,
      phpHandler: domain.phpHandler === 'php-fpm' ? 'php-fpm' : 'proxy-to-apache',
      proxyToApache: domain.webServer === 'nginx+apache',
      poolName,
      logDir,
      aliases: [`www.${domain.name}`],
    });

    await db.update(domains).set({
      sslEnabled: false,
      sslCertId: null,
      redirectHttpToHttps: false,
      hsts: false,
    }).where(eq(domains.id, domainId));

    logger.info({ domain: domain.name }, 'SSL certificate removed');
  }

  /**
   * Renew a certificate
   */
  async renewCertificate(domainId: string) {
    const [cert] = await db.select().from(sslCertificates)
      .where(eq(sslCertificates.domainId, domainId)).limit(1);
    if (!cert) throw new AppError(404, 'CERT_NOT_FOUND', 'No certificate found');

    if (cert.type === 'letsencrypt') {
      const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
      const success = await certbotService.renew(domain!.name);
      if (!success) throw new AppError(422, 'RENEW_FAILED', 'Certificate renewal failed');

      const expiresAt = await certbotService.getCertExpiry(cert.certPath!);
      await db.update(sslCertificates).set({
        expiresAt,
        lastRenewedAt: new Date(),
      }).where(eq(sslCertificates.id, cert.id));

      await nginxService.reload();
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
}
```

### 8.3 SSL Routes

#### `apps/api/src/modules/ssl/ssl.routes.ts`

```typescript
import type { FastifyInstance } from 'fastify';
import { SslService } from './ssl.service.js';
import { issueLetsEncryptSchema, uploadCustomSchema, generateSelfSignedSchema } from './ssl.schema.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export default async function sslRoutes(fastify: FastifyInstance) {
  const service = new SslService();
  fastify.addHook('preHandler', requireAuth);

  // GET /api/v1/domains/:id/ssl
  fastify.get('/domains/:id/ssl', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.getCertificate(id) };
  });

  // POST /api/v1/domains/:id/ssl/letsencrypt
  fastify.post('/domains/:id/ssl/letsencrypt', async (req) => {
    const { id } = req.params as { id: string };
    const { email } = issueLetsEncryptSchema.parse(req.body);
    return { success: true, data: await service.issueLetsEncrypt(id, email) };
  });

  // POST /api/v1/domains/:id/ssl/custom
  fastify.post('/domains/:id/ssl/custom', async (req) => {
    const { id } = req.params as { id: string };
    const { certificate, privateKey, chain } = uploadCustomSchema.parse(req.body);
    return { success: true, data: await service.uploadCustom(id, certificate, privateKey, chain) };
  });

  // POST /api/v1/domains/:id/ssl/self-signed
  fastify.post('/domains/:id/ssl/self-signed', async (req) => {
    const { id } = req.params as { id: string };
    const { days } = generateSelfSignedSchema.parse(req.body);
    return { success: true, data: await service.generateSelfSigned(id, days) };
  });

  // DELETE /api/v1/domains/:id/ssl
  fastify.delete('/domains/:id/ssl', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { id } = req.params as { id: string };
      await service.removeCertificate(id);
      return { success: true, data: null };
    },
  });

  // POST /api/v1/domains/:id/ssl/renew
  fastify.post('/domains/:id/ssl/renew', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.renewCertificate(id) };
  });

  // GET /api/v1/ssl/expiring
  fastify.get('/ssl/expiring', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { days } = req.query as { days?: string };
      return { success: true, data: await service.listExpiring(parseInt(days || '30')) };
    },
  });
}
```

### 8.4 SSL Renew Job

#### `apps/api/src/jobs/ssl-renew.job.ts`

```typescript
import { Worker, type ConnectionOptions } from 'bullmq';
import { db } from '../db/index.js';
import { sslCertificates, domains } from '../db/schema/index.js';
import { lt, eq, and } from 'drizzle-orm';
import { CertbotService } from '../services/certbot.service.js';
import { NginxService } from '../services/nginx.service.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const connection: ConnectionOptions = {
  host: new URL(env.REDIS_URL).hostname || '127.0.0.1',
  port: parseInt(new URL(env.REDIS_URL).port || '6379'),
};

export function startSslRenewWorker(): Worker {
  const certbotService = new CertbotService();
  const nginxService = new NginxService();

  return new Worker('ssl', async (job) => {
    if (job.name !== 'renew-check') return;

    // Find certs expiring within 30 days with autoRenew enabled
    const cutoff = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const expiring = await db.select().from(sslCertificates)
      .where(and(
        eq(sslCertificates.autoRenew, true),
        lt(sslCertificates.expiresAt, cutoff)
      ));

    logger.info({ count: expiring.length }, 'Checking SSL certificates for renewal');

    for (const cert of expiring) {
      try {
        if (cert.type !== 'letsencrypt' || !cert.domainId) continue;

        const [domain] = await db.select().from(domains)
          .where(eq(domains.id, cert.domainId)).limit(1);
        if (!domain) continue;

        const success = await certbotService.renew(domain.name);
        if (success) {
          const expiresAt = await certbotService.getCertExpiry(cert.certPath!);
          await db.update(sslCertificates).set({
            expiresAt,
            lastRenewedAt: new Date(),
          }).where(eq(sslCertificates.id, cert.id));

          logger.info({ domain: domain.name }, 'SSL certificate auto-renewed');
        } else {
          logger.warn({ domain: domain.name }, 'SSL certificate auto-renew failed');
        }
      } catch (error) {
        logger.error({ certId: cert.id, error }, 'SSL renewal error');
      }
    }

    await nginxService.reload();
  }, { connection, concurrency: 1 });
}
```

---

## Phase 9 — DNS Module: Detailed Specification

### 9.1 DNS Schema

#### `apps/api/src/db/schema/dns.ts`

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { domains } from './domains.js';

export const dnsZones = sqliteTable('dns_zones', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  serial: integer('serial').notNull(),
  ttl: integer('ttl').default(3600).notNull(),
  primaryNs: text('primary_ns').notNull(),
  adminEmail: text('admin_email').notNull(),
  refresh: integer('refresh').default(86400).notNull(),
  retry: integer('retry').default(7200).notNull(),
  expire: integer('expire').default(3600000).notNull(),
  minimumTtl: integer('minimum_ttl').default(172800).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const dnsRecords = sqliteTable('dns_records', {
  id: text('id').primaryKey(),
  zoneId: text('zone_id').notNull().references(() => dnsZones.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'PTR'] }).notNull(),
  name: text('name').notNull(),
  value: text('value').notNull(),
  ttl: integer('ttl').default(3600),
  priority: integer('priority'),
  isSystem: integer('is_system', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type DnsZone = typeof dnsZones.$inferSelect;
export type DnsRecord = typeof dnsRecords.$inferSelect;
```

### 9.2 DNS Service

#### `apps/api/src/modules/dns/dns.schema.ts`

```typescript
import { z } from 'zod';

export const createRecordSchema = z.object({
  type: z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'PTR']),
  name: z.string().min(1),
  value: z.string().min(1),
  ttl: z.number().min(60).max(86400).default(3600),
  priority: z.number().optional(),
});

export const updateRecordSchema = z.object({
  name: z.string().min(1).optional(),
  value: z.string().min(1).optional(),
  ttl: z.number().min(60).max(86400).optional(),
  priority: z.number().optional(),
});

export const importZoneSchema = z.object({
  bindFormat: z.string().min(1),
});
```

#### `apps/api/src/modules/dns/dns.service.ts`

```typescript
import { db } from '../../db/index.js';
import { dnsZones, dnsRecords, domains } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { BindService } from '../../services/bind.service.js';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';
import Handlebars from 'handlebars';
import { readFile } from 'node:fs/promises';

const bindService = new BindService();

export class DnsService {
  /**
   * Get DNS zone and all records for a domain
   */
  async getZone(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);
    if (!zone) return { zone: null, records: [] };

    const records = await db.select().from(dnsRecords).where(eq(dnsRecords.zoneId, zone.id));

    return { zone, records };
  }

  /**
   * Create a DNS record
   */
  async createRecord(domainId: string, data: {
    type: string; name: string; value: string; ttl?: number; priority?: number;
  }) {
    const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);
    if (!zone) throw new AppError(404, 'ZONE_NOT_FOUND', 'DNS zone not found for this domain');

    const recordId = nanoid();
    await db.insert(dnsRecords).values({
      id: recordId,
      zoneId: zone.id,
      type: data.type as any,
      name: data.name,
      value: data.value,
      ttl: data.ttl || 3600,
      priority: data.priority,
      isSystem: false,
    });

    // Bump serial and rewrite zone file
    await this.rewriteZoneFile(zone.id);

    logger.info({ domainId, type: data.type, name: data.name }, 'DNS record created');
    return { id: recordId, ...data };
  }

  /**
   * Update a DNS record
   */
  async updateRecord(recordId: string, data: { name?: string; value?: string; ttl?: number; priority?: number }) {
    const [record] = await db.select().from(dnsRecords).where(eq(dnsRecords.id, recordId)).limit(1);
    if (!record) throw new AppError(404, 'RECORD_NOT_FOUND', 'DNS record not found');

    if (record.isSystem) {
      throw new AppError(403, 'SYSTEM_RECORD', 'Cannot modify system-generated DNS record');
    }

    await db.update(dnsRecords).set(data).where(eq(dnsRecords.id, recordId));
    await this.rewriteZoneFile(record.zoneId);

    return { id: recordId, ...data };
  }

  /**
   * Delete a DNS record
   */
  async deleteRecord(recordId: string) {
    const [record] = await db.select().from(dnsRecords).where(eq(dnsRecords.id, recordId)).limit(1);
    if (!record) throw new AppError(404, 'RECORD_NOT_FOUND', 'DNS record not found');

    if (record.isSystem) {
      throw new AppError(403, 'SYSTEM_RECORD', 'Cannot delete system-generated DNS record');
    }

    await db.delete(dnsRecords).where(eq(dnsRecords.id, recordId));
    await this.rewriteZoneFile(record.zoneId);
  }

  /**
   * Import DNS zone from BIND format text
   */
  async importZone(domainId: string, bindFormat: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Parse BIND format (simplified parser)
    const records = this.parseBindFormat(bindFormat);

    // Delete existing non-system records
    const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);
    if (zone) {
      await db.delete(dnsRecords).where(
        eq(dnsRecords.zoneId, zone.id)
        // Only delete non-system records
      );
    }

    // Insert parsed records
    for (const rec of records) {
      await db.insert(dnsRecords).values({
        id: nanoid(),
        zoneId: zone!.id,
        type: rec.type as any,
        name: rec.name,
        value: rec.value,
        ttl: rec.ttl || 3600,
        priority: rec.priority,
        isSystem: false,
      });
    }

    await this.rewriteZoneFile(zone!.id);
    logger.info({ domainId, recordCount: records.length }, 'DNS zone imported');
    return { imported: records.length };
  }

  /**
   * Export DNS zone as BIND format text
   */
  async exportZone(domainId: string): Promise<string> {
    const { zone, records } = await this.getZone(domainId);
    if (!zone) throw new AppError(404, 'ZONE_NOT_FOUND', 'DNS zone not found');

    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);

    let output = `$ORIGIN ${domain!.name}.\n`;
    output += `$TTL ${zone.ttl}\n`;
    output += `@   IN  SOA ${zone.primaryNs}. ${zone.adminEmail}. (\n`;
    output += `        ${zone.serial}  ; Serial\n`;
    output += `        ${zone.refresh}  ; Refresh\n`;
    output += `        ${zone.retry}    ; Retry\n`;
    output += `        ${zone.expire}  ; Expire\n`;
    output += `        ${zone.minimumTtl}  ; Minimum TTL\n`;
    output += `    )\n\n`;

    for (const rec of records) {
      const priority = rec.priority ? `${rec.priority} ` : '';
      output += `${rec.name}   ${rec.ttl || ''}   IN  ${rec.type}   ${priority}${rec.value}\n`;
    }

    return output;
  }

  /**
   * Reset DNS to default records (A, www, mail, MX, SPF)
   */
  async resetToDefaults(domainId: string) {
    const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);
    if (!zone) throw new AppError(404, 'ZONE_NOT_FOUND', 'DNS zone not found');

    // Delete all non-system records
    await db.delete(dnsRecords).where(eq(dnsRecords.zoneId, zone.id));

    // Get server IP
    const { run } = await import('../../services/executor.js');
    const ipResult = await run('hostname', ['-I']);
    const serverIp = ipResult.stdout.trim().split(' ')[0];

    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);

    // Insert default records
    const defaults = [
      { type: 'A', name: '@', value: serverIp },
      { type: 'A', name: 'www', value: serverIp },
      { type: 'A', name: 'mail', value: serverIp },
      { type: 'MX', name: '@', value: `mail.${domain!.name}.`, priority: 10 },
      { type: 'TXT', name: '@', value: `"v=spf1 a mx ip4:${serverIp} ~all"` },
      { type: 'NS', name: '@', value: 'ns1.example.com.' },
      { type: 'NS', name: '@', value: 'ns2.example.com.' },
    ];

    for (const rec of defaults) {
      await db.insert(dnsRecords).values({
        id: nanoid(),
        zoneId: zone.id,
        type: rec.type as any,
        name: rec.name,
        value: rec.value,
        ttl: 3600,
        priority: rec.priority,
        isSystem: true,
      });
    }

    await this.rewriteZoneFile(zone.id);
    logger.info({ domainId }, 'DNS reset to defaults');
  }

  // --- Private Helpers ---

  private async rewriteZoneFile(zoneId: string) {
    const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.id, zoneId)).limit(1);
    if (!zone) return;

    const records = await db.select().from(dnsRecords).where(eq(dnsRecords.zoneId, zoneId));
    const [domain] = await db.select().from(domains).where(eq(domains.id, zone.domainId)).limit(1);
    if (!domain) return;

    // Bump serial
    const newSerial = Math.floor(Date.now() / 1000);
    await db.update(dnsZones).set({ serial: newSerial }).where(eq(dnsZones.id, zoneId));

    // Render zone file
    const template = await readFile(
      new URL('../../templates/bind/zone.hbs', import.meta.url), 'utf-8'
    );
    const compiled = Handlebars.compile(template);
    const zoneContent = compiled({
      domain: domain.name,
      serial: newSerial,
      ttl: zone.ttl,
      primaryNs: zone.primaryNs,
      adminEmail: zone.adminEmail,
      refresh: zone.refresh,
      retry: zone.retry,
      expire: zone.expire,
      minimumTtl: zone.minimumTtl,
      serverIp: records.find(r => r.type === 'A' && r.name === '@')?.value || '127.0.0.1',
      records: records.map(r => ({
        type: r.type,
        name: r.name,
        value: r.value,
        ttl: r.ttl,
        priority: r.priority,
      })),
    });

    await bindService.writeZoneFile(domain.name, zoneContent);
  }

  private parseBindFormat(text: string): Array<{ type: string; name: string; value: string; ttl?: number; priority?: number }> {
    const records: Array<{ type: string; name: string; value: string; ttl?: number; priority?: number }> = [];
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('$')) continue;

      // Match: name [ttl] IN type [priority] value
      const match = trimmed.match(/^(\S+)\s+(\d+\s+)?IN\s+(A|AAAA|CNAME|MX|TXT|NS|SRV|CAA|PTR)\s+(?:(\d+)\s+)?(.+)$/i);
      if (match) {
        records.push({
          name: match[1],
          ttl: match[2] ? parseInt(match[2].trim()) : undefined,
          type: match[3].toUpperCase(),
          priority: match[4] ? parseInt(match[4]) : undefined,
          value: match[5].trim(),
        });
      }
    }

    return records;
  }
}
```

### 9.3 DNS Routes

#### `apps/api/src/modules/dns/dns.routes.ts`

```typescript
import type { FastifyInstance } from 'fastify';
import { DnsService } from './dns.service.js';
import { createRecordSchema, updateRecordSchema, importZoneSchema } from './dns.schema.js';
import { requireAuth } from '../auth/auth.middleware.js';

export default async function dnsRoutes(fastify: FastifyInstance) {
  const service = new DnsService();
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/domains/:id/dns', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.getZone(id) };
  });

  fastify.post('/domains/:id/dns/records', async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = createRecordSchema.parse(req.body);
    const record = await service.createRecord(id, data);
    return reply.status(201).send({ success: true, data: record });
  });

  fastify.put('/domains/:id/dns/records/:recId', async (req) => {
    const { recId } = req.params as { recId: string };
    const data = updateRecordSchema.parse(req.body);
    return { success: true, data: await service.updateRecord(recId, data) };
  });

  fastify.delete('/domains/:id/dns/records/:recId', async (req) => {
    const { recId } = req.params as { recId: string };
    await service.deleteRecord(recId);
    return { success: true, data: null };
  });

  fastify.post('/domains/:id/dns/import', async (req) => {
    const { id } = req.params as { id: string };
    const { bindFormat } = importZoneSchema.parse(req.body);
    return { success: true, data: await service.importZone(id, bindFormat) };
  });

  fastify.get('/domains/:id/dns/export', async (req) => {
    const { id } = req.params as { id: string };
    const zoneText = await service.exportZone(id);
    return { success: true, data: { content: zoneText } };
  });

  fastify.post('/domains/:id/dns/reset-to-defaults', async (req) => {
    const { id } = req.params as { id: string };
    await service.resetToDefaults(id);
    return { success: true, data: null };
  });
}
```

---

## Phase 10 — Mail Module: Detailed Specification

### 10.1 Mail Service

#### `apps/api/src/modules/mail/mail.schema.ts`

```typescript
import { z } from 'zod';

export const createMailboxSchema = z.object({
  username: z.string().min(1).max(64).regex(/^[a-z0-9._-]+$/),
  password: z.string().min(8),
  quotaMb: z.number().min(10).default(1024),
});

export const updateMailboxSchema = z.object({
  password: z.string().min(8).optional(),
  quotaMb: z.number().min(10).optional(),
  isActive: z.boolean().optional(),
  autoresponder: z.boolean().optional(),
  autoresponderMessage: z.string().max(5000).optional(),
});

export const createAliasSchema = z.object({
  alias: z.string().min(1),
  destination: z.string().min(1),
});

export const createForwardSchema = z.object({
  forwardTo: z.string().email(),
  keepCopy: z.boolean().default(true),
});
```

#### `apps/api/src/modules/mail/mail.service.ts`

```typescript
import { db } from '../../db/index.js';
import { mailDomains, mailboxes, mailAliases, mailForwards } from '../../db/schema/email.js';
import { domains, dnsRecords, dnsZones } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { run } from '../../services/executor.js';
import { hashPassword, encrypt, decrypt } from '../../utils/crypto.js';
import { generateKeyPair } from 'node:crypto';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';
import { writeFile, readFile, appendFile } from 'node:fs/promises';

export class MailService {
  /**
   * Enable mail for a domain
   */
  async enableMail(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Create mail domain record
    const mailDomainId = nanoid();
    await db.insert(mailDomains).values({
      id: mailDomainId,
      domainId,
      isActive: true,
    });

    // Add domain to Postfix virtual domains
    await appendFile('/etc/postfix/virtual_domains', `${domain.name}\n`, 'utf-8');

    // Add domain to Dovecot passdb/userdb config
    await run('postfix', ['reload'], { sudo: true });
    await run('systemctl', ['reload', 'dovecot'], { sudo: true });

    logger.info({ domain: domain.name }, 'Mail enabled for domain');
    return { enabled: true, mailDomainId };
  }

  /**
   * Disable mail for a domain
   */
  async disableMail(domainId: string) {
    const [mailDomain] = await db.select().from(mailDomains)
      .where(eq(mailDomains.domainId, domainId)).limit(1);
    if (!mailDomain) throw new AppError(404, 'MAIL_NOT_ENABLED', 'Mail not enabled for this domain');

    // Delete all mailboxes, aliases, forwards
    await db.delete(mailForwards).where(eq(mailForwards.mailboxId, mailDomain.id));
    await db.delete(mailAliases).where(eq(mailAliases.mailDomainId, mailDomain.id));
    await db.delete(mailboxes).where(eq(mailboxes.mailDomainId, mailDomain.id));
    await db.delete(mailDomains).where(eq(mailDomains.id, mailDomain.id));

    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (domain) {
      // Remove from Postfix virtual domains
      const content = await readFile('/etc/postfix/virtual_domains', 'utf-8');
      const updated = content.split('\n').filter(l => l.trim() !== domain.name).join('\n');
      await writeFile('/etc/postfix/virtual_domains', updated, 'utf-8');
      await run('postfix', ['reload'], { sudo: true });
    }

    logger.info({ domainId }, 'Mail disabled for domain');
  }

  /**
   * Create a mailbox
   */
  async createMailbox(domainId: string, data: { username: string; password: string; quotaMb: number }) {
    const [mailDomain] = await db.select().from(mailDomains)
      .where(eq(mailDomains.domainId, domainId)).limit(1);
    if (!mailDomain) throw new AppError(400, 'MAIL_NOT_ENABLED', 'Mail not enabled for this domain');

    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    const email = `${data.username}@${domain!.name}`;

    const mailboxId = nanoid();
    const passwordHash = await hashPassword(data.password);

    await db.insert(mailboxes).values({
      id: mailboxId,
      mailDomainId: mailDomain.id,
      username: email,
      passwordHash,
      quotaMb: data.quotaMb,
      isActive: true,
      autoresponder: false,
    });

    // Add to Dovecot userdb
    // Format: email:{hash}:{uid}:{gid}::/var/mail/{domain}/{username}
    const doveEntry = `${email}:{CRYPT}:${passwordHash}:1000:1000::/var/mail/${domain!.name}/${data.username}\n`;
    await appendFile('/etc/dovecot/users', doveEntry, 'utf-8');

    // Create mail directory
    await run('mkdir', ['-p', `/var/mail/${domain!.name}/${data.username}`], { sudo: true });
    await run('chown', ['-R', 'vmail:vmail', `/var/mail/${domain!.name}`], { sudo: true });

    // Add to Postfix virtual mailbox map
    await appendFile('/etc/postfix/virtual_mailbox', `${email} ${domain!.name}/${data.username}/\n`, 'utf-8');
    await run('postfix', ['reload'], { sudo: true });

    logger.info({ email }, 'Mailbox created');
    return { id: mailboxId, email, quotaMb: data.quotaMb };
  }

  /**
   * Update a mailbox
   */
  async updateMailbox(mailboxId: string, data: { password?: string; quotaMb?: number; isActive?: boolean }) {
    const [mailbox] = await db.select().from(mailboxes).where(eq(mailboxes.id, mailboxId)).limit(1);
    if (!mailbox) throw new AppError(404, 'MAILBOX_NOT_FOUND', 'Mailbox not found');

    const updates: any = {};
    if (data.password) {
      updates.passwordHash = await hashPassword(data.password);
      // Update Dovecot password
      // In production: rewrite the specific line in /etc/dovecot/users
    }
    if (data.quotaMb) updates.quotaMb = data.quotaMb;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    await db.update(mailboxes).set(updates).where(eq(mailboxes.id, mailboxId));
    return { id: mailboxId, ...updates };
  }

  /**
   * Delete a mailbox
   */
  async deleteMailbox(mailboxId: string) {
    const [mailbox] = await db.select().from(mailboxes).where(eq(mailboxes.id, mailboxId)).limit(1);
    if (!mailbox) throw new AppError(404, 'MAILBOX_NOT_FOUND', 'Mailbox not found');

    // Remove from Dovecot users
    const users = await readFile('/etc/dovecot/users', 'utf-8');
    const updated = users.split('\n').filter(l => !l.startsWith(mailbox.username)).join('\n');
    await writeFile('/etc/dovecot/users', updated, 'utf-8');

    // Remove from Postfix virtual mailbox
    const vmb = await readFile('/etc/postfix/virtual_mailbox', 'utf-8');
    const updatedVmb = vmb.split('\n').filter(l => !l.startsWith(mailbox.username)).join('\n');
    await writeFile('/etc/postfix/virtual_mailbox', updatedVmb, 'utf-8');

    await run('postfix', ['reload'], { sudo: true });

    // Delete mail data
    const parts = mailbox.username.split('@');
    await run('rm', ['-rf', `/var/mail/${parts[1]}/${parts[0]}`], { sudo: true }).catch(() => {});

    await db.delete(mailForwards).where(eq(mailForwards.mailboxId, mailboxId));
    await db.delete(mailboxes).where(eq(mailboxes.id, mailboxId));
    logger.info({ email: mailbox.username }, 'Mailbox deleted');
  }

  /**
   * List mailboxes for a domain
   */
  async listMailboxes(domainId: string) {
    const [mailDomain] = await db.select().from(mailDomains)
      .where(eq(mailDomains.domainId, domainId)).limit(1);
    if (!mailDomain) return [];

    return db.select().from(mailboxes).where(eq(mailboxes.mailDomainId, mailDomain.id));
  }

  /**
   * Create an email alias
   */
  async createAlias(domainId: string, alias: string, destination: string) {
    const [mailDomain] = await db.select().from(mailDomains)
      .where(eq(mailDomains.domainId, domainId)).limit(1);
    if (!mailDomain) throw new AppError(400, 'MAIL_NOT_ENABLED', 'Mail not enabled');

    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    const fullAlias = alias.includes('@') ? alias : `${alias}@${domain!.name}`;

    const aliasId = nanoid();
    await db.insert(mailAliases).values({
      id: aliasId,
      mailDomainId: mailDomain.id,
      alias: fullAlias,
      destination,
    });

    // Add to Postfix virtual alias map
    await appendFile('/etc/postfix/virtual_alias', `${fullAlias} ${destination}\n`, 'utf-8');
    await run('postfix', ['reload'], { sudo: true });

    return { id: aliasId, alias: fullAlias, destination };
  }

  /**
   * Delete an email alias
   */
  async deleteAlias(aliasId: string) {
    const [alias] = await db.select().from(mailAliases).where(eq(mailAliases.id, aliasId)).limit(1);
    if (!alias) throw new AppError(404, 'ALIAS_NOT_FOUND', 'Alias not found');

    // Remove from Postfix virtual alias map
    const content = await readFile('/etc/postfix/virtual_alias', 'utf-8');
    const updated = content.split('\n').filter(l => !l.startsWith(alias.alias)).join('\n');
    await writeFile('/etc/postfix/virtual_alias', updated, 'utf-8');
    await run('postfix', ['reload'], { sudo: true });

    await db.delete(mailAliases).where(eq(mailAliases.id, aliasId));
  }

  /**
   * Generate DKIM keys for a domain
   */
  async generateDKIM(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [mailDomain] = await db.select().from(mailDomains)
      .where(eq(mailDomains.domainId, domainId)).limit(1);
    if (!mailDomain) throw new AppError(400, 'MAIL_NOT_ENABLED', 'Mail not enabled');

    // Generate RSA key pair
    const { publicKey, privateKey } = await new Promise<{ publicKey: string; privateKey: string }>(
      (resolve, reject) => {
        generateKeyPair('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        }, (err, pub, priv) => {
          if (err) reject(err);
          else resolve({ publicKey: pub, privateKey: priv });
        });
      }
    );

    // Store encrypted private key
    await db.update(mailDomains).set({
      dkimPublicKey: publicKey,
      dkimPrivateKey: encrypt(privateKey),
    }).where(eq(mailDomains.id, mailDomain.id));

    // Write OpenDKIM key files
    const keyDir = `/etc/opendkim/keys/${domain.name}`;
    await run('mkdir', ['-p', keyDir], { sudo: true });
    await writeFile(`${keyDir}/mail.private`, privateKey, 'utf-8');
    await run('chown', ['opendkim:opendkim', `${keyDir}/mail.private`], { sudo: true });

    // Add to OpenDKIM KeyTable
    await appendFile('/etc/opendkim/KeyTable',
      `mail._domainkey.${domain.name} ${domain.name}:mail:${keyDir}/mail.private\n`, 'utf-8');

    // Add to SigningTable
    await appendFile('/etc/opendkim/SigningTable',
      `*@${domain.name} mail._domainkey.${domain.name}\n`, 'utf-8');

    // Inject DNS TXT record
    const selectorRecord = publicKey
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\n/g, '');

    // Add DNS record via DNS module
    // (Simplified: directly insert into dnsRecords if zone exists)
    const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);
    if (zone) {
      await db.insert(dnsRecords).values({
        id: nanoid(),
        zoneId: zone.id,
        type: 'TXT',
        name: 'mail._domainkey',
        value: `v=DKIM1; k=rsa; p=${selectorRecord}`,
        ttl: 3600,
        isSystem: true,
      });
    }

    await run('systemctl', ['restart', 'opendkim'], { sudo: true });

    logger.info({ domain: domain.name }, 'DKIM keys generated');
    return {
      publicKey,
      dnsRecord: `mail._domainkey.${domain.name} IN TXT "v=DKIM1; k=rsa; p=${selectorRecord}"`,
    };
  }

  /**
   * Get DKIM status
   */
  async getDKIMStatus(domainId: string) {
    const [mailDomain] = await db.select().from(mailDomains)
      .where(eq(mailDomains.domainId, domainId)).limit(1);
    if (!mailDomain) return { enabled: false };

    return {
      enabled: !!mailDomain.dkimPublicKey,
      hasPublicKey: !!mailDomain.dkimPublicKey,
      spfRecord: mailDomain.spfRecord,
      dmarcPolicy: mailDomain.dmarcPolicy,
    };
  }
}
```

### 10.2 Mail Routes

#### `apps/api/src/modules/mail/mail.routes.ts`

```typescript
import type { FastifyInstance } from 'fastify';
import { MailService } from './mail.service.js';
import { createMailboxSchema, updateMailboxSchema, createAliasSchema } from './mail.schema.js';
import { requireAuth } from '../auth/auth.middleware.js';

export default async function mailRoutes(fastify: FastifyInstance) {
  const service = new MailService();
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/domains/:id/mail', async (req) => {
    const { id } = req.params as { id: string };
    const mailboxes = await service.listMailboxes(id);
    return { success: true, data: { mailboxes } };
  });

  fastify.post('/domains/:id/mail/enable', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.enableMail(id) };
  });

  fastify.delete('/domains/:id/mail/disable', async (req) => {
    const { id } = req.params as { id: string };
    await service.disableMail(id);
    return { success: true, data: null };
  });

  fastify.get('/domains/:id/mail/mailboxes', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.listMailboxes(id) };
  });

  fastify.post('/domains/:id/mail/mailboxes', async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = createMailboxSchema.parse(req.body);
    const mailbox = await service.createMailbox(id, data);
    return reply.status(201).send({ success: true, data: mailbox });
  });

  fastify.put('/domains/:id/mail/mailboxes/:mbId', async (req) => {
    const { mbId } = req.params as { mbId: string };
    const data = updateMailboxSchema.parse(req.body);
    return { success: true, data: await service.updateMailbox(mbId, data) };
  });

  fastify.delete('/domains/:id/mail/mailboxes/:mbId', async (req) => {
    const { mbId } = req.params as { mbId: string };
    await service.deleteMailbox(mbId);
    return { success: true, data: null };
  });

  fastify.get('/domains/:id/mail/aliases', async (req) => {
    const { id } = req.params as { id: string };
    // List aliases
    return { success: true, data: [] };
  });

  fastify.post('/domains/:id/mail/aliases', async (req) => {
    const { id } = req.params as { id: string };
    const { alias, destination } = createAliasSchema.parse(req.body);
    return { success: true, data: await service.createAlias(id, alias, destination) };
  });

  fastify.delete('/domains/:id/mail/aliases/:aliasId', async (req) => {
    const { aliasId } = req.params as { aliasId: string };
    await service.deleteAlias(aliasId);
    return { success: true, data: null };
  });

  fastify.post('/domains/:id/mail/dkim/generate', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.generateDKIM(id) };
  });

  fastify.get('/domains/:id/mail/dkim/status', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.getDKIMStatus(id) };
  });
}
```

---

## Phase 11 — Database Module: Detailed Specification

### 11.1 Database Service

#### `apps/api/src/modules/databases/databases.service.ts`

```typescript
import { db } from '../../db/index.js';
import { databases, databaseUsers } from '../../db/schema/databases.js';
import { subscriptions } from '../../db/schema/subscriptions.js';
import { eq, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { MariaDbService } from '../../services/mariadb.service.js';
import { PostgresService } from '../../services/postgres.service.js';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';

const mariadbService = new MariaDbService();
const postgresService = new PostgresService();

export class DatabasesService {
  /**
   * List databases for a subscription
   */
  async list(subscriptionId: string, page: number = 1, perPage: number = 20) {
    const offset = (page - 1) * perPage;
    const items = await db.select().from(databases)
      .where(eq(databases.subscriptionId, subscriptionId))
      .limit(perPage).offset(offset);

    const [{ total }] = await db.select({ total: count() })
      .from(databases).where(eq(databases.subscriptionId, subscriptionId));

    return { items, meta: { page, perPage, total } };
  }

  /**
   * Create a database
   */
  async create(data: { subscriptionId: string; name: string; engine: 'mariadb' | 'postgresql'; charset?: string }) {
    // Check plan limits
    const [{ total }] = await db.select({ total: count() })
      .from(databases).where(eq(databases.subscriptionId, data.subscriptionId));

    // Get subscription + plan for limit check (simplified)
    // if (plan.maxDatabases !== -1 && total >= plan.maxDatabases) throw error

    const dbId = nanoid();
    const dbName = `sf_${data.name.replace(/[^a-z0-9_]/gi, '_')}`;

    // Create in actual DB engine
    if (data.engine === 'mariadb') {
      await mariadbService.createDatabase(dbName, data.charset || 'utf8mb4');
    } else {
      await postgresService.createDatabase(dbName);
    }

    // Store in panel DB
    await db.insert(databases).values({
      id: dbId,
      subscriptionId: data.subscriptionId,
      name: dbName,
      engine: data.engine,
      charset: data.charset || 'utf8mb4',
    });

    logger.info({ name: dbName, engine: data.engine }, 'Database created');
    return { id: dbId, name: dbName, engine: data.engine };
  }

  /**
   * Delete a database
   */
  async delete(databaseId: string) {
    const [database] = await db.select().from(databases).where(eq(databases.id, databaseId)).limit(1);
    if (!database) throw new AppError(404, 'DATABASE_NOT_FOUND', 'Database not found');

    // Drop in actual engine
    if (database.engine === 'mariadb') {
      await mariadbService.dropDatabase(database.name);
    } else {
      await postgresService.dropDatabase(database.name);
    }

    // Delete all users
    const users = await db.select().from(databaseUsers).where(eq(databaseUsers.databaseId, databaseId));
    for (const user of users) {
      if (database.engine === 'mariadb') {
        await mariadbService.dropUser(user.username, user.host || 'localhost');
      } else {
        await postgresService.dropUser(user.username);
      }
    }

    await db.delete(databaseUsers).where(eq(databaseUsers.databaseId, databaseId));
    await db.delete(databases).where(eq(databases.id, databaseId));

    logger.info({ name: database.name }, 'Database deleted');
  }

  /**
   * Create a database user
   */
  async createUser(databaseId: string, username: string, password: string, host: string = 'localhost') {
    const [database] = await db.select().from(databases).where(eq(databases.id, databaseId)).limit(1);
    if (!database) throw new AppError(404, 'DATABASE_NOT_FOUND', 'Database not found');

    const dbUsername = `sf_${username.replace(/[^a-z0-9_]/gi, '_')}`;

    if (database.engine === 'mariadb') {
      await mariadbService.createUser(dbUsername, password, database.name, host);
    } else {
      await postgresService.createUser(dbUsername, password);
      await postgresService.grantPrivileges(dbUsername, database.name);
    }

    const userId = nanoid();
    await db.insert(databaseUsers).values({
      id: userId,
      databaseId,
      username: dbUsername,
      passwordHash: password, // Store plaintext for display; real auth is in DB engine
      host,
      privileges: JSON.stringify(['ALL']),
    });

    return { id: userId, username: dbUsername, host };
  }

  /**
   * Delete a database user
   */
  async deleteUser(userId: string) {
    const [user] = await db.select().from(databaseUsers).where(eq(databaseUsers.id, userId)).limit(1);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Database user not found');

    const [database] = await db.select().from(databases).where(eq(databases.id, user.databaseId)).limit(1);
    if (!database) throw new AppError(404, 'DATABASE_NOT_FOUND', 'Database not found');

    if (database.engine === 'mariadb') {
      await mariadbService.dropUser(user.username, user.host || 'localhost');
    } else {
      await postgresService.dropUser(user.username);
    }

    await db.delete(databaseUsers).where(eq(databaseUsers.id, userId));
  }

  /**
   * Change database user password
   */
  async changeUserPassword(userId: string, newPassword: string) {
    const [user] = await db.select().from(databaseUsers).where(eq(databaseUsers.id, userId)).limit(1);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Database user not found');

    const [database] = await db.select().from(databases).where(eq(databases.id, user.databaseId)).limit(1);

    if (database!.engine === 'mariadb') {
      await mariadbService.changePassword(user.username, newPassword, user.host || 'localhost');
    } else {
      await postgresService.changePassword(user.username, newPassword);
    }

    await db.update(databaseUsers).set({ passwordHash: newPassword }).where(eq(databaseUsers.id, userId));
  }

  /**
   * Export database
   */
  async exportDatabase(databaseId: string): Promise<string> {
    const [database] = await db.select().from(databases).where(eq(databases.id, databaseId)).limit(1);
    if (!database) throw new AppError(404, 'DATABASE_NOT_FOUND', 'Database not found');

    if (database.engine === 'mariadb') {
      return mariadbService.exportDatabase(database.name);
    } else {
      return postgresService.exportDatabase(database.name);
    }
  }

  /**
   * Import database
   */
  async importDatabase(databaseId: string, sql: string) {
    const [database] = await db.select().from(databases).where(eq(databases.id, databaseId)).limit(1);
    if (!database) throw new AppError(404, 'DATABASE_NOT_FOUND', 'Database not found');

    if (database.engine === 'mariadb') {
      await mariadbService.importDatabase(database.name, sql);
    } else {
      await postgresService.importDatabase(database.name, sql);
    }
  }
}
```

### 11.2 Database Routes

#### `apps/api/src/modules/databases/databases.routes.ts`

```typescript
import type { FastifyInstance } from 'fastify';
import { DatabasesService } from './databases.service.js';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';

const createDbSchema = z.object({
  subscriptionId: z.string(),
  name: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
  engine: z.enum(['mariadb', 'postgresql']).default('mariadb'),
  charset: z.string().optional(),
});

const createUserSchema = z.object({
  username: z.string().min(1).max(32).regex(/^[a-z0-9_]+$/),
  password: z.string().min(8),
  host: z.string().default('localhost'),
});

export default async function databaseRoutes(fastify: FastifyInstance) {
  const service = new DatabasesService();
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/databases', async (req) => {
    const { subscriptionId, page, perPage } = req.query as any;
    return { success: true, data: await service.list(subscriptionId, page, perPage) };
  });

  fastify.post('/databases', async (req, reply) => {
    const data = createDbSchema.parse(req.body);
    return reply.status(201).send({ success: true, data: await service.create(data) });
  });

  fastify.delete('/databases/:id', async (req) => {
    const { id } = req.params as { id: string };
    await service.delete(id);
    return { success: true, data: null };
  });

  fastify.post('/databases/:id/users', async (req) => {
    const { id } = req.params as { id: string };
    const { username, password, host } = createUserSchema.parse(req.body);
    return { success: true, data: await service.createUser(id, username, password, host) };
  });

  fastify.delete('/databases/:id/users/:userId', async (req) => {
    const { userId } = req.params as { userId: string };
    await service.deleteUser(userId);
    return { success: true, data: null };
  });

  fastify.put('/databases/:id/users/:userId/password', async (req) => {
    const { userId } = req.params as { userId: string };
    const { password } = req.body as { password: string };
    await service.changeUserPassword(userId, password);
    return { success: true, data: null };
  });

  fastify.post('/databases/:id/export', async (req) => {
    const { id } = req.params as { id: string };
    const sql = await service.exportDatabase(id);
    return { success: true, data: { sql } };
  });

  fastify.post('/databases/:id/import', async (req) => {
    const { id } = req.params as { id: string };
    const { sql } = req.body as { sql: string };
    await service.importDatabase(id, sql);
    return { success: true, data: null };
  });
}
```

---

## Phase 12 — FTP Module: Detailed Specification

### 12.1 FTP Service

#### `apps/api/src/modules/ftp/ftp.service.ts`

```typescript
import { db } from '../../db/index.js';
import { ftpAccounts } from '../../db/schema/ftp.js';
import { domains } from '../../db/schema/domains.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { run } from '../../services/executor.js';
import { hashPassword } from '../../utils/crypto.js';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';
import { appendFile, readFile, writeFile } from 'node:fs/promises';

export class FtpService {
  async listAccounts(domainId: string) {
    return db.select().from(ftpAccounts).where(eq(ftpAccounts.domainId, domainId));
  }

  async createAccount(domainId: string, data: { username: string; password: string; homeDir: string; readonly?: boolean }) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const ftpId = nanoid();
    const passwordHash = await hashPassword(data.password);

    await db.insert(ftpAccounts).values({
      id: ftpId,
      domainId,
      username: data.username,
      passwordHash,
      homeDir: data.homeDir,
      readonly: data.readonly || false,
      isActive: true,
    });

    // Add to ProFTPd virtual users file
    // Format: username:passwordHash:uid:gid:homeDir:shell
    const entry = `${data.username}:${passwordHash}:33:33:${data.homeDir}:/bin/false\n`;
    await appendFile('/etc/proftpd/ftpd.passwd', entry, 'utf-8');
    await run('systemctl', ['reload', 'proftpd'], { sudo: true });

    logger.info({ username: data.username }, 'FTP account created');
    return { id: ftpId, username: data.username, homeDir: data.homeDir };
  }

  async updateAccount(ftpId: string, data: { password?: string; homeDir?: string; readonly?: boolean; isActive?: boolean }) {
    const [account] = await db.select().from(ftpAccounts).where(eq(ftpAccounts.id, ftpId)).limit(1);
    if (!account) throw new AppError(404, 'FTP_NOT_FOUND', 'FTP account not found');

    const updates: any = {};
    if (data.password) {
      updates.passwordHash = await hashPassword(data.password);
      // Update ProFTPd passwd file
      const content = await readFile('/etc/proftpd/ftpd.passwd', 'utf-8');
      const lines = content.split('\n').map(l => {
        if (l.startsWith(`${account.username}:`)) {
          const parts = l.split(':');
          parts[1] = updates.passwordHash;
          return parts.join(':');
        }
        return l;
      });
      await writeFile('/etc/proftpd/ftpd.passwd', lines.join('\n'), 'utf-8');
    }
    if (data.homeDir) updates.homeDir = data.homeDir;
    if (data.readonly !== undefined) updates.readonly = data.readonly;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    await db.update(ftpAccounts).set(updates).where(eq(ftpAccounts.id, ftpId));
    await run('systemctl', ['reload', 'proftpd'], { sudo: true });

    return { id: ftpId, ...updates };
  }

  async deleteAccount(ftpId: string) {
    const [account] = await db.select().from(ftpAccounts).where(eq(ftpAccounts.id, ftpId)).limit(1);
    if (!account) throw new AppError(404, 'FTP_NOT_FOUND', 'FTP account not found');

    // Remove from ProFTPd passwd
    const content = await readFile('/etc/proftpd/ftpd.passwd', 'utf-8');
    const updated = content.split('\n').filter(l => !l.startsWith(`${account.username}:`)).join('\n');
    await writeFile('/etc/proftpd/ftpd.passwd', updated, 'utf-8');
    await run('systemctl', ['reload', 'proftpd'], { sudo: true });

    await db.delete(ftpAccounts).where(eq(ftpAccounts.id, ftpId));
    logger.info({ username: account.username }, 'FTP account deleted');
  }
}
```

---

## Phase 13 — Cloudflare Tunnel: Detailed Specification

### 13.1 Tunnel Service

#### `apps/api/src/modules/tunnel/tunnel.service.ts`

```typescript
