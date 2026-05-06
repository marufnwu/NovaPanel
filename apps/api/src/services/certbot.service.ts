import { run } from './executor.js';
import { logger } from '../config/logger.js';
import * as sudoFs from './sudo-fs.js';
import { createSslError } from '../utils/error-messages.js';

export class CertbotService {
  /**
   * Issue a Let's Encrypt certificate using certbot
   */
  async issueCertificate(
    domain: string,
    email: string,
    webroot?: string
  ): Promise<{ certPath: string; keyPath: string; chainPath: string }> {
    const args = ['certonly', '--non-interactive', '--agree-tos', '-m', email, '-d', domain];

    if (webroot) {
      args.push('--webroot', '-w', webroot);
    } else {
      args.push('--standalone');
    }

    const result = await run('certbot', args, { sudo: true, timeout: 120_000 });

    if (!result.success) {
      throw createSslError(result.stderr, 'CERTBOT_FAILED');
    }

    logger.info({ domain }, 'SSL certificate issued via Let\'s Encrypt');

    return {
      certPath: `/etc/letsencrypt/live/${domain}/cert.pem`,
      keyPath: `/etc/letsencrypt/live/${domain}/privkey.pem`,
      chainPath: `/etc/letsencrypt/live/${domain}/fullchain.pem`,
    };
  }

  /**
   * Check if the Cloudflare DNS plugin for certbot is installed
   */
  async hasCloudflareDnsPlugin(): Promise<boolean> {
    const result = await run('certbot', ['plugins', '--text'], { sudo: true, timeout: 30_000 });
    return result.stdout.includes('dns-cloudflare');
  }

  /**
   * Issue a Let's Encrypt certificate using DNS-01 challenge via Cloudflare
   * Requires the python3-certbot-dns-cloudflare package to be installed.
   *
   * @param params.domain - The primary domain for the certificate (e.g., example.com)
   * @param params.email - Email for Let's Encrypt notifications
   * @param params.wildcard - Whether to include *.domain in the certificate
   * @param params.cloudflareApiToken - Cloudflare API token with DNS edit permissions
   * @returns Certificate paths on success
   * @throws Error if certbot fails or credentials file cannot be written
   */
  async issueCertificateDns01(params: {
    domain: string;
    email: string;
    wildcard: boolean;
    cloudflareApiToken: string;
  }): Promise<{ certPath: string; keyPath: string; fullChainPath: string }> {
    // Check if Cloudflare DNS plugin is installed
    const hasPlugin = await this.hasCloudflareDnsPlugin();
    if (!hasPlugin) {
      throw new Error(
        'python3-certbot-dns-cloudflare is not installed. ' +
        'Install it with: apt install python3-certbot-dns-cloudflare'
      );
    }

    const credentialsPath = '/etc/letsencrypt/cloudflare-credentials.ini';
    let credentialsCreated = false;

    try {
      // Write credentials file with restricted permissions
      const credentialsContent = `dns_cloudflare_api_token = ${params.cloudflareApiToken}\n`;
      await sudoFs.writeFile(credentialsPath, credentialsContent);
      await sudoFs.chmod(credentialsPath, '600');
      credentialsCreated = true;

      // Build certbot arguments
      const args = [
        'certonly',
        '--non-interactive',
        '--agree-tos',
        '-m', params.email,
        '-d', params.domain,
      ];

      // Add wildcard domain if requested
      if (params.wildcard) {
        args.push('-d', `*.${params.domain}`);
      }

      // DNS-01 challenge via Cloudflare
      args.push(
        '--dns-cloudflare',
        '--dns-cloudflare-credentials', credentialsPath,
      );

      logger.info({ domain: params.domain, wildcard: params.wildcard }, 'Issuing SSL certificate via DNS-01 challenge (Cloudflare)');

      const result = await run('certbot', args, { sudo: true, timeout: 180_000 });

      if (!result.success) {
        throw createSslError(result.stderr, 'CERTBOT_DNS01_FAILED');
      }

      logger.info({ domain: params.domain }, 'SSL certificate issued via Let\'s Encrypt DNS-01 (Cloudflare)');

      return {
        certPath: `/etc/letsencrypt/live/${params.domain}/cert.pem`,
        keyPath: `/etc/letsencrypt/live/${params.domain}/privkey.pem`,
        fullChainPath: `/etc/letsencrypt/live/${params.domain}/fullchain.pem`,
      };
    } finally {
      // Always clean up the credentials file, even on failure
      if (credentialsCreated) {
        try {
          await sudoFs.unlink(credentialsPath);
        } catch (cleanupError) {
          logger.warn({ path: credentialsPath, error: cleanupError }, 'Failed to clean up Cloudflare credentials file');
        }
      }
    }
  }

  /**
   * Renew all certificates that are due for renewal
   */
  async renewAll(): Promise<{ renewed: string[]; failed: string[] }> {
    const result = await run('certbot', ['renew', '--non-interactive'], { sudo: true, timeout: 300_000 });

    const renewed: string[] = [];
    const failed: string[] = [];

    // Parse output for renewed/failed domains
    const lines = result.stdout.split('\n');
    for (const line of lines) {
      if (line.includes('successfully renewed')) {
        const match = line.match(/(\S+\.\S+)/);
        if (match) renewed.push(match[1]);
      }
      if (line.includes('failed to renew')) {
        const match = line.match(/(\S+\.\S+)/);
        if (match) failed.push(match[1]);
      }
    }

    logger.info({ renewed, failed }, 'Certificate renewal completed');
    return { renewed, failed };
  }

  /**
   * Renew a single domain's certificate
   */
  async renew(domain: string): Promise<boolean> {
    const result = await run('certbot', ['renew', '--cert-name', domain, '--non-interactive'], {
      sudo: true,
      timeout: 120_000,
    });
    return result.success;
  }

  /**
   * Revoke and delete a certificate
   */
  async deleteCertificate(domain: string): Promise<void> {
    await run('certbot', ['delete', '--cert-name', domain, '--non-interactive'], { sudo: true });
    logger.info({ domain }, 'SSL certificate deleted');
  }

  /**
   * Get certificate expiry date from a PEM file using openssl
   */
  async getCertExpiry(certPath: string): Promise<Date> {
    const result = await run('openssl', [
      'x509', '-enddate', '-noout', '-in', certPath,
    ], { sudo: true });
    // Output format: notAfter=Mon DD HH:MM:SS YYYY GMT
    const match = result.stdout.match(/notAfter=(.+)/);
    if (!match) throw new Error('Could not parse certificate expiry date');
    return new Date(match[1].trim());
  }

  /**
   * Generate a self-signed certificate using openssl
   */
  async generateSelfSigned(
    domain: string,
    outputDir: string,
    days: number = 365
  ): Promise<{ certPath: string; keyPath: string }> {
    await sudoFs.mkdir(outputDir);

    const certPath = `${outputDir}/selfsigned.crt`;
    const keyPath = `${outputDir}/selfsigned.key`;

    await run('openssl', [
      'req', '-x509', '-nodes',
      '-days', String(days),
      '-newkey', 'rsa:2048',
      '-keyout', keyPath,
      '-out', certPath,
      '-subj', `/CN=${domain}`,
    ], { sudo: true });

    logger.info({ domain, days }, 'Self-signed certificate generated');
    return { certPath, keyPath };
  }
}

export const certbotService = new CertbotService();
