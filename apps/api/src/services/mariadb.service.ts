import { run } from './executor.js';
import type { SystemService, ServiceInfo, ServiceStatus } from './types.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * Escape a string for safe interpolation into SQL single-quoted values.
 * Replaces ' → '' and \ → \\
 */
function escapeSqlString(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/'/g, "''");
}

export class MariaDbService implements SystemService {
  readonly name = 'mariadb';
  readonly displayName = 'MariaDB';

  async start(): Promise<void> {
    await run('systemctl', ['start', 'mariadb'], { sudo: true });
  }

  async stop(): Promise<void> {
    await run('systemctl', ['stop', 'mariadb'], { sudo: true });
  }

  async restart(): Promise<void> {
    await run('systemctl', ['restart', 'mariadb'], { sudo: true });
  }

  async reload(): Promise<void> {
    await run('systemctl', ['reload', 'mariadb'], { sudo: true });
  }

  async status(): Promise<ServiceInfo> {
    const result = await run('systemctl', ['is-active', 'mariadb'], { sudo: true });
    const status: ServiceStatus = result.stdout.trim() === 'active' ? 'running' : 'stopped';
    return { name: this.name, displayName: this.displayName, status };
  }

  async isInstalled(): Promise<boolean> {
    const result = await run('which', ['mysql']);
    return result.success;
  }

  /**
   * Create a database
   */
  async createDatabase(name: string): Promise<void> {
    await run('mysql', ['-u', 'root', '-e', `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`], { sudo: true });
    logger.info({ database: name }, 'MariaDB database created');
  }

  /**
   * Drop a database
   */
  async dropDatabase(name: string): Promise<void> {
    await run('mysql', ['-u', 'root', '-e', `DROP DATABASE IF EXISTS \`${name}\`;`], { sudo: true });
    logger.info({ database: name }, 'MariaDB database dropped');
  }

  /**
   * Create a database user
   */
  async createUser(username: string, password: string, host: string = 'localhost'): Promise<void> {
    await run('mysql', ['-u', 'root', '-e', `CREATE USER '${escapeSqlString(username)}'@'${escapeSqlString(host)}' IDENTIFIED BY '${escapeSqlString(password)}';`], { sudo: true });
    logger.info({ username, host }, 'MariaDB user created');
  }

  /**
   * Grant privileges to a user on a database
   */
  async grantPrivileges(username: string, database: string, host: string = 'localhost'): Promise<void> {
    await run('mysql', ['-u', 'root', '-e', `GRANT ALL PRIVILEGES ON \`${database}\`.* TO '${escapeSqlString(username)}'@'${escapeSqlString(host)}'; FLUSH PRIVILEGES;`], { sudo: true });
    logger.info({ username, database }, 'MariaDB privileges granted');
  }

  /**
   * Drop a user
   */
  async dropUser(username: string, host: string = 'localhost'): Promise<void> {
    await run('mysql', ['-u', 'root', '-e', `DROP USER IF EXISTS '${escapeSqlString(username)}'@'${escapeSqlString(host)}'; FLUSH PRIVILEGES;`], { sudo: true });
    logger.info({ username }, 'MariaDB user dropped');
  }

  /**
   * Dump a database to SQL
   */
  async dumpDatabase(name: string, outputPath: string): Promise<void> {
    await run('mysqldump', ['-u', 'root', name], { sudo: true });
    logger.info({ database: name, outputPath }, 'MariaDB database dumped');
  }

  /**
   * Change a user's password
   */
  async changePassword(username: string, password: string, host: string = 'localhost'): Promise<void> {
    await run('mysql', ['-u', 'root', '-e', `ALTER USER '${escapeSqlString(username)}'@'${escapeSqlString(host)}' IDENTIFIED BY '${escapeSqlString(password)}'; FLUSH PRIVILEGES;`], { sudo: true });
    logger.info({ username }, 'MariaDB user password changed');
  }

  /**
   * Export a database to SQL string
   */
  async exportDatabase(name: string): Promise<string> {
    const result = await run('mysqldump', ['-u', 'root', name], { sudo: true });
    return result.stdout;
  }

  /**
   * Import SQL into a database
   */
  async importDatabase(name: string, sql: string): Promise<void> {
    const { writeFile: writeTmp, unlink } = await import('node:fs/promises');
    const tmpPath = `/tmp/sf_import_${Date.now()}.sql`;
    await writeTmp(tmpPath, sql, 'utf-8');
    await run('mysql', ['-u', 'root', name, '-e', `source ${tmpPath}`], { sudo: true });
    await unlink(tmpPath).catch(() => {});
    logger.info({ database: name }, 'MariaDB database imported');
  }

  /**
   * Get database size in bytes
   */
  async getDatabaseSize(name: string): Promise<number> {
    const result = await run('mysql', ['-u', 'root', '-N', '-e',
      `SELECT COALESCE(SUM(data_length + index_length), 0) FROM information_schema.tables WHERE table_schema = '${escapeSqlString(name)}';`
    ], { sudo: true });
    const size = parseInt(result.stdout.trim(), 10);
    return isNaN(size) ? 0 : size;
  }

  /**
   * Repair database tables
   */
  async repairDatabase(name: string): Promise<{ success: boolean; output: string }> {
    const result = await run('mysqlcheck', ['-u', 'root', '--repair', name], { sudo: true });
    return { success: result.success, output: result.stdout };
  }

  /**
   * Optimize database tables
   */
  async optimizeDatabase(name: string): Promise<{ success: boolean; output: string }> {
    const result = await run('mysqlcheck', ['-u', 'root', '--optimize', name], { sudo: true });
    return { success: result.success, output: result.stdout };
  }

  /**
   * Clone database to a new name
   */
  async cloneDatabase(sourceName: string, targetName: string): Promise<void> {
    const dumpResult = await run('mysqldump', ['-u', 'root', sourceName], { sudo: true });
    await run('mysql', ['-u', 'root', '-e', `CREATE DATABASE IF NOT EXISTS \`${targetName}\`;`], { sudo: true });
    await run('mysql', ['-u', 'root', targetName], { sudo: true, input: dumpResult.stdout });
    logger.info({ source: sourceName, target: targetName }, 'MariaDB database cloned');
  }

  /**
   * Run a read-only SQL query
   */
  async runQuery(name: string, sql: string): Promise<{ columns: string[]; rows: Record<string, unknown>[]; rowCount: number }> {
    const result = await run('mysql', ['-u', 'root', '-N', '-e', sql, name], { sudo: true });
    const lines = result.stdout.split('\n').filter(l => l.trim());
    if (lines.length === 0) return { columns: [], rows: [], rowCount: 0 };

    const rows = lines.map(line => {
      const cols = line.split('\t');
      return cols;
    });

    return {
      columns: [],
      rows: rows.map(cols => {
        const obj: Record<string, unknown> = {};
        cols.forEach((v, i) => { obj[`col_${i}`] = v; });
        return obj;
      }),
      rowCount: rows.length,
    };
  }
}

export const mariadbService = new MariaDbService();
