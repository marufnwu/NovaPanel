import { run } from './executor.js';
import type { SystemService, ServiceInfo, ServiceStatus } from './types.js';
import { logger } from '../config/logger.js';

/**
 * Escape a string for safe interpolation into SQL values.
 * Replaces ' → '' and \ → \\
 */
function escapeSqlString(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/'/g, "''");
}

export class PostgresService implements SystemService {
  readonly name = 'postgresql';
  readonly displayName = 'PostgreSQL';

  async start(): Promise<void> {
    await run('systemctl', ['start', 'postgresql'], { sudo: true });
  }

  async stop(): Promise<void> {
    await run('systemctl', ['stop', 'postgresql'], { sudo: true });
  }

  async restart(): Promise<void> {
    await run('systemctl', ['restart', 'postgresql'], { sudo: true });
  }

  async reload(): Promise<void> {
    await run('systemctl', ['reload', 'postgresql'], { sudo: true });
  }

  async status(): Promise<ServiceInfo> {
    const result = await run('systemctl', ['is-active', 'postgresql'], { sudo: true });
    const status: ServiceStatus = result.stdout.trim() === 'active' ? 'running' : 'stopped';
    return { name: this.name, displayName: this.displayName, status };
  }

  async isInstalled(): Promise<boolean> {
    const result = await run('which', ['psql']);
    return result.success;
  }

  async createDatabase(name: string): Promise<void> {
    await run('createdb', ['-U', 'postgres', name], { sudo: true });
    logger.info({ database: name }, 'PostgreSQL database created');
  }

  async dropDatabase(name: string): Promise<void> {
    await run('dropdb', ['-U', 'postgres', '--if-exists', name], { sudo: true });
    logger.info({ database: name }, 'PostgreSQL database dropped');
  }

  async createUser(username: string, password: string): Promise<void> {
    await run('psql', ['-U', 'postgres', '-c', `CREATE USER "${escapeSqlString(username)}" WITH PASSWORD '${escapeSqlString(password)}';`], { sudo: true });
    logger.info({ username }, 'PostgreSQL user created');
  }

  async dropUser(username: string): Promise<void> {
    await run('dropuser', ['-U', 'postgres', '--if-exists', username], { sudo: true });
    logger.info({ username }, 'PostgreSQL user dropped');
  }

  async grantPrivileges(username: string, database: string): Promise<void> {
    await run('psql', ['-U', 'postgres', '-c', `GRANT ALL PRIVILEGES ON DATABASE "${escapeSqlString(database)}" TO "${escapeSqlString(username)}";`], { sudo: true });
    logger.info({ username, database }, 'PostgreSQL privileges granted');
  }

  /**
   * Change a user's password
   */
  async changePassword(username: string, password: string): Promise<void> {
    await run('psql', ['-U', 'postgres', '-c', `ALTER USER "${escapeSqlString(username)}" WITH PASSWORD '${escapeSqlString(password)}';`], { sudo: true });
    logger.info({ username }, 'PostgreSQL user password changed');
  }

  /**
   * Export a database to SQL string
   */
  async exportDatabase(name: string): Promise<string> {
    const result = await run('pg_dump', ['-U', 'postgres', name], { sudo: true });
    return result.stdout;
  }

  /**
   * Import SQL into a database
   */
  async importDatabase(name: string, sql: string): Promise<void> {
    await run('psql', ['-U', 'postgres', name], { sudo: true, input: sql });
    logger.info({ database: name }, 'PostgreSQL database imported');
  }

  /**
   * Get database size in bytes
   */
  async getDatabaseSize(name: string): Promise<number> {
    const result = await run('psql', ['-U', 'postgres', '-d', name, '-t', '-c', 
      `SELECT pg_database_size('${escapeSqlString(name)}');`
    ], { sudo: true });
    const size = parseInt(result.stdout.trim(), 10);
    return isNaN(size) ? 0 : size;
  }

  /**
   * Repair is not applicable for PostgreSQL (VACUUM reclaims space)
   */
  async repairDatabase(name: string): Promise<{ success: boolean; output: string }> {
    // PostgreSQL doesn't need repair; instead we run VACUUM ANALYZE
    const result = await run('psql', ['-U', 'postgres', '-d', name, '-c', 'VACUUM ANALYZE;'], { sudo: true });
    return { success: result.success, output: result.stdout };
  }

  /**
   * Optimize database (VACUUM FULL to reclaim space)
   */
  async optimizeDatabase(name: string): Promise<{ success: boolean; output: string }> {
    const result = await run('psql', ['-U', 'postgres', '-d', name, '-c', 'VACUUM FULL ANALYZE;'], { sudo: true });
    return { success: result.success, output: result.stdout };
  }

  /**
   * Clone database using pg_dump + createdb + psql
   */
  async cloneDatabase(sourceName: string, targetName: string): Promise<void> {
    // Check if target exists, if so drop it
    await run('dropdb', ['-U', 'postgres', '--if-exists', targetName], { sudo: true });
    await run('createdb', ['-U', 'postgres', targetName], { sudo: true });
    const dumpResult = await run('pg_dump', ['-U', 'postgres', sourceName], { sudo: true });
    await run('psql', ['-U', 'postgres', '-d', targetName], { sudo: true, input: dumpResult.stdout });
    logger.info({ source: sourceName, target: targetName }, 'PostgreSQL database cloned');
  }

  /**
   * Run a read-only SQL query (SELECT, SHOW, DESCRIBE)
   */
  async runQuery(name: string, sql: string): Promise<{ columns: string[]; rows: Record<string, unknown>[]; rowCount: number }> {
    const result = await run('psql', ['-U', 'postgres', '-d', name, '-t', '-A', '-F', '\t', '-c', sql], { sudo: true });
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

export const postgresService = new PostgresService();
