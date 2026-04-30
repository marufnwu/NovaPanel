import { run } from './executor.js';
import { logger } from '../config/logger.js';
import * as sudoFs from './sudo-fs.js';

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
      throw new Error(`Certbot failed: ${result.stderr}`);
    }

    logger.info({ domain }, 'SSL certificate issued via Let\'s Encrypt');

    return {
      certPath: `/etc/letsencrypt/live/${domain}/cert.pem`,
      keyPath: `/etc/letsencrypt/live/${domain}/privkey.pem`,
      chainPath: `/etc/letsencrypt/live/${domain}/fullchain.pem`,
    };
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
    ]);
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
