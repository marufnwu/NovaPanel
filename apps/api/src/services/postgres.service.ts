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

/** Shared exec options for running commands as the postgres OS user */
const pgSudo = { sudo: true as const, sudoUser: 'postgres' };

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
    await run('createdb', [name], pgSudo);
    logger.info({ database: name }, 'PostgreSQL database created');
  }

  async dropDatabase(name: string): Promise<void> {
    await run('dropdb', ['--if-exists', name], pgSudo);
    logger.info({ database: name }, 'PostgreSQL database dropped');
  }

  async createUser(username: string, password: string): Promise<void> {
    await run('psql', ['-c', `CREATE USER "${escapeSqlString(username)}" WITH PASSWORD '${escapeSqlString(password)}';`], pgSudo);
    logger.info({ username }, 'PostgreSQL user created');
  }

  async dropUser(username: string): Promise<void> {
    await run('dropuser', ['--if-exists', username], pgSudo);
    logger.info({ username }, 'PostgreSQL user dropped');
  }

  async grantPrivileges(username: string, database: string): Promise<void> {
    await run('psql', ['-c', `GRANT ALL PRIVILEGES ON DATABASE "${escapeSqlString(database)}" TO "${escapeSqlString(username)}";`], pgSudo);
    logger.info({ username, database }, 'PostgreSQL privileges granted');
  }

  /**
   * Change a user's password
   */
  async changePassword(username: string, password: string): Promise<void> {
    await run('psql', ['-c', `ALTER USER "${escapeSqlString(username)}" WITH PASSWORD '${escapeSqlString(password)}';`], pgSudo);
    logger.info({ username }, 'PostgreSQL user password changed');
  }

  /**
   * Export a database to SQL string
   */
  async exportDatabase(name: string): Promise<string> {
    const result = await run('pg_dump', [name], pgSudo);
    return result.stdout;
  }

  /**
   * Import SQL into a database
   */
  async importDatabase(name: string, sql: string): Promise<void> {
    await run('psql', [name], { ...pgSudo, input: sql });
    logger.info({ database: name }, 'PostgreSQL database imported');
  }

  /**
   * Get database size in bytes
   */
  async getDatabaseSize(name: string): Promise<number> {
    const result = await run('psql', ['-d', name, '-t', '-c',
      `SELECT pg_database_size('${escapeSqlString(name)}');`
    ], pgSudo);
    const size = parseInt(result.stdout.trim(), 10);
    return isNaN(size) ? 0 : size;
  }

  /**
   * Repair is not applicable for PostgreSQL (VACUUM reclaims space)
   */
  async repairDatabase(name: string): Promise<{ success: boolean; output: string }> {
    // PostgreSQL doesn't need repair; instead we run VACUUM ANALYZE
    const result = await run('psql', ['-d', name, '-c', 'VACUUM ANALYZE;'], pgSudo);
    return { success: result.success, output: result.stdout };
  }

  /**
   * Optimize database (VACUUM FULL to reclaim space)
   */
  async optimizeDatabase(name: string): Promise<{ success: boolean; output: string }> {
    const result = await run('psql', ['-d', name, '-c', 'VACUUM FULL ANALYZE;'], pgSudo);
    return { success: result.success, output: result.stdout };
  }

  /**
   * Clone database using pg_dump + createdb + psql
   */
  async cloneDatabase(sourceName: string, targetName: string): Promise<void> {
    // Drop target if it exists, then create it
    await run('dropdb', ['--if-exists', targetName], pgSudo);
    await run('createdb', [targetName], pgSudo);
    // Dump source and pipe into target
    const dumpResult = await run('pg_dump', [sourceName], pgSudo);
    await run('psql', ['-d', targetName], { ...pgSudo, input: dumpResult.stdout });
    logger.info({ source: sourceName, target: targetName }, 'PostgreSQL database cloned');
  }

  /**
   * Run a read-only SQL query (SELECT, SHOW, DESCRIBE)
   * Returns proper column names by omitting -t flag and disabling footer.
   */
  async runQuery(name: string, sql: string): Promise<{ columns: string[]; rows: Record<string, unknown>[]; rowCount: number }> {
    // -A = unaligned, -F '\t' = tab separator, -P footer=off = no "(N rows)" line
    // Omit -t so the first row is column headers
    const result = await run('psql', ['-d', name, '-A', '-F', '\t', '-P', 'footer=off', '-c', sql], pgSudo);
    const lines = result.stdout.split('\n').filter(l => l.trim());
    if (lines.length === 0) return { columns: [], rows: [], rowCount: 0 };

    // First line is column headers
    const columns = lines[0].split('\t');
    const rows = lines.slice(1).map(line => {
      const values = line.split('\t');
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => { obj[col] = values[i] ?? null; });
      return obj;
    });

    return { columns, rows, rowCount: rows.length };
  }
}

export const postgresService = new PostgresService();
