import { run } from '../../services/executor.js';
import { logger } from '../../config/logger.js';

export interface SystemLogEntry {
  timestamp: string;
  level: string;
  message: string;
  source?: string;
}

/**
 * Read the last N lines from the system log file.
 * Tries /var/log/syslog first (Debian/Ubuntu), falls back to /var/log/messages (RHEL/CentOS).
 */
export async function getSystemLogs(lines: number = 100): Promise<{ log: string; entries: SystemLogEntry[] }> {
  const logPaths = ['/var/log/syslog', '/var/log/messages', '/var/log/dmesg'];

  for (const logPath of logPaths) {
    try {
      const result = await run('tail', ['-n', String(lines), logPath], { sudo: false });
      if (result.exitCode === 0 && result.stdout) {
        const entries = parseLogLines(result.stdout, logPath);
        return { log: result.stdout, entries };
      }
    } catch {
      // Try next file
    }
  }

  logger.warn('Could not read any system log file');
  return { log: '', entries: [] };
}

/**
 * Parse raw log lines into structured entries.
 * Handles syslog, messages, and dmesg formats.
 */
function parseLogLines(raw: string, source: string): SystemLogEntry[] {
  const lines = raw.split('\n').filter(Boolean);
  const entries: SystemLogEntry[] = [];

  for (const line of lines) {
    const entry = parseLine(line, source);
    if (entry) entries.push(entry);
  }

  return entries;
}

/**
 * Parse a single log line.
 * Syslog format: "Mon DD HH:MM:SS hostname program[pid]: message"
 * Dmesg format: "[  timestamp] message"
 * Messages format: "Mon DD HH:MM:SS hostname program[pid]: message"
 */
function parseLine(line: string, source: string): SystemLogEntry | null {
  if (!line.trim()) return null;

  // Try syslog/messages format
  const syslogMatch = line.match(/^(\w{3}\s+\d+\s+[\d:]+)\s+\S+\s+(\S+?)(?:\[\d+\])?:\s*(.*)$/);
  if (syslogMatch) {
    return {
      timestamp: syslogMatch[1],
      level: inferLevel(syslogMatch[3]),
      message: syslogMatch[3],
      source: syslogMatch[2],
    };
  }

  // Try dmesg format: "[  timestamp] message"
  const dmesgMatch = line.match(/^\[\s*([\d.]+)\]\s*(.*)$/);
  if (dmesgMatch) {
    return {
      timestamp: new Date(parseFloat(dmesgMatch[1]) * 1000).toISOString(),
      level: inferLevel(dmesgMatch[2]),
      message: dmesgMatch[2],
      source: 'kernel',
    };
  }

  // Fallback: treat entire line as message
  return {
    timestamp: new Date().toISOString(),
    level: inferLevel(line),
    message: line,
    source,
  };
}

/**
 * Infer log level from message content.
 */
function inferLevel(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('error') || lower.includes('fail') || lower.includes('critical')) return 'error';
  if (lower.includes('warn')) return 'warning';
  if (lower.includes('info')) return 'info';
  if (lower.includes('debug') || lower.includes('trace')) return 'debug';
  return 'info';
}