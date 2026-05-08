import { execa } from 'execa';
import { logger } from '../config/logger.js';

// Strict allowlist of permitted commands
const ALLOWED_COMMANDS: ReadonlySet<string> = new Set([
  // User management
  'useradd', 'userdel', 'passwd', 'chpasswd', 'chown', 'chmod', 'chgrp',
  // File operations (for system-level, not file manager)
  'mkdir', 'ln', 'rm', 'cp', 'mv',
  // Nginx
  'nginx',
  // Apache
  'apache2ctl', 'a2ensite', 'a2dissite', 'a2enmod', 'a2dismod',
  // PHP-FPM
  'php-fpm8.1', 'php-fpm8.2', 'php-fpm8.3', 'php-fpm8.4', 'php',
  // Systemd
  'systemctl',
  // DNS
  'rndc', 'named-checkzone', 'dig',
  // Mail
  'postfix', 'postmap', 'doveadm', 'opendkim-genkey', 'opendkim-testkey',
  // Database
  'mysql', 'mysqladmin', 'mysqldump', 'mysqlcheck', 'psql', 'pg_dump', 'createuser', 'dropuser', 'createdb', 'dropdb',
  // SSL
  'certbot', 'openssl',
  // FTP
  'ftpasswd',
  // Firewall
  'ufw', 'fail2ban-client', 'sshd',
  // Cloudflare
  'cloudflared',
  // Cron
  'crontab',
  // Archive
  'tar', 'unzip', 'zip',
  // Checksum
  'sha256sum',
  // Disk
  'du', 'df', 'quota',
  // Process
  'kill', 'pgrep',
  // Process
  'su',
  // Network/Socket stats
  'ss',
  // HTTP client
  'curl',
  // Log reading
  'tail', 'wc', 'head',
  // Archive reading
  'zcat',
  // System logs
  'journalctl',
  // Package management
  'apt-get',
  // Misc
  'hostname', 'ip', 'cat', 'echo', 'test', 'id', 'which', 'tee', 'bash', 'sed', 'grep', 'timedatectl', 'uname', 'shutdown',
  // Directory listing
  'ls',
  // System info
  'nproc', 'free', 'lscpu',
]);

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  sudo?: boolean;
  /** When sudo is true, run the command as this user (e.g. 'postgres') via sudo -u */
  sudoUser?: string;
  input?: string;
}

/**
 * Sanitize a single argument to prevent shell injection.
 * Rejects arguments containing control characters.
 */
function sanitizeArg(arg: string): string {
  if (arg.includes('\0') || arg.includes('\n') || arg.includes('\r')) {
    throw new Error(`Invalid argument: contains control characters`);
  }
  return arg;
}

/**
 * Execute a system command safely via execa.
 * All commands are validated against an allowlist.
 * No shell interpolation is used.
 */
export async function run(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<ExecResult> {
  // Validate command against allowlist
  const baseCmd = command.split('/').pop()!; // Extract basename
  if (!ALLOWED_COMMANDS.has(baseCmd)) {
    logger.error({ command }, 'Blocked disallowed command');
    throw new Error(`Command not allowed: ${command}`);
  }

  // Sanitize all arguments
  const safeArgs = args.map(sanitizeArg);

  // Build final command array
  const finalCmd = options.sudo ? 'sudo' : command;
  const sudoFlags: string[] = [];
  if (options.sudo && options.sudoUser) {
    sudoFlags.push('-u', options.sudoUser);
  }
  const adjustedArgs = options.sudo ? [...sudoFlags, baseCmd, ...safeArgs] : safeArgs;

  logger.debug({ command: baseCmd, args: safeArgs }, 'Executing command');

  try {
    const result = await execa(finalCmd, adjustedArgs, {
      reject: false,
      timeout: options.timeout || 30_000,
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      input: options.input,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 0,
      success: (result.exitCode ?? 0) === 0,
    };
  } catch (error: any) {
    if (error.timedOut) {
      logger.error({ command: baseCmd, timeout: options.timeout }, 'Command timed out');
      throw new Error(`Command timed out: ${baseCmd}`);
    }
    throw error;
  }
}

/**
 * Run a command that is not in the allowlist.
 * ONLY for internal trusted operations. Always logged at WARN.
 */
export async function runTrusted(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<ExecResult> {
  logger.warn({ command, args }, 'Executing trusted/unlisted command');

  try {
    const result = await execa(command, args, {
      reject: false,
      timeout: options.timeout || 30_000,
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      input: options.input,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 0,
      success: (result.exitCode ?? 0) === 0,
    };
  } catch (error: any) {
    if (error.timedOut) {
      throw new Error(`Command timed out: ${command}`);
    }
    throw error;
  }
}
