import { Client } from 'ssh2';
import type { Stats } from 'ssh2';
import { decrypt } from './crypto.service.js';

interface SftpEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'link';
  size: number;
  modifiedAt: string | null;
  permissions: string;
}

export function getSftpConnection(server: {
  host: string;
  port: number;
  username: string;
  authType: string;
  passwordEncrypted: string | null;
  sshKey: { privateKeyEncrypted: string } | null;
}): Promise<{ client: Client; sftp: import('ssh2').SFTPWrapper }> {
  return new Promise((resolve, reject) => {
    const client = new Client();

    const config: Record<string, unknown> = {
      host: server.host,
      port: server.port,
      username: server.username,
      readyTimeout: 10000,
    };

    if (server.authType === 'key' && server.sshKey) {
      config.privateKey = decrypt(server.sshKey.privateKeyEncrypted);
    } else if (server.authType === 'password' && server.passwordEncrypted) {
      config.password = decrypt(server.passwordEncrypted);
    }

    client.on('ready', () => {
      client.sftp((err, sftp) => {
        if (err) {
          client.end();
          reject(err);
          return;
        }
        resolve({ client, sftp });
      });
    });

    client.on('error', (err) => reject(err));
    client.connect(config);
  });
}

export function listDirectory(
  sftp: import('ssh2').SFTPWrapper,
  dirPath: string,
): Promise<SftpEntry[]> {
  return new Promise((resolve, reject) => {
    sftp.readdir(dirPath, (err, list) => {
      if (err) {
        reject(err);
        return;
      }

      const entries: SftpEntry[] = list.map((item) => {
        const attrs = item.attrs as Stats;
        const isDir = attrs.isDirectory();
        const isLink = attrs.isSymbolicLink();

        return {
          name: item.filename,
          path: dirPath === '/' ? `/${item.filename}` : `${dirPath}/${item.filename}`,
          type: isDir ? 'directory' : isLink ? 'link' : 'file',
          size: attrs.size,
          modifiedAt: attrs.mtime ? new Date(attrs.mtime * 1000).toISOString() : null,
          permissions: modeToPermissions(attrs.mode),
        };
      });

      // Sort: directories first, then alphabetical
      entries.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });

      resolve(entries);
    });
  });
}

export function readFileContent(
  sftp: import('ssh2').SFTPWrapper,
  filePath: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = sftp.createReadStream(filePath, { highWaterMark: 64 * 1024 });

    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', (err: Error) => reject(err));
  });
}

export function writeFileContent(
  sftp: import('ssh2').SFTPWrapper,
  filePath: string,
  content: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = sftp.createWriteStream(filePath);
    stream.on('finish', () => resolve());
    stream.on('error', (err: Error) => reject(err));
    stream.write(content);
    stream.end();
  });
}

export function deleteFile(
  sftp: import('ssh2').SFTPWrapper,
  filePath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.unlink(filePath, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function deleteDirectory(
  sftp: import('ssh2').SFTPWrapper,
  dirPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.rmdir(dirPath, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function createDirectory(
  sftp: import('ssh2').SFTPWrapper,
  dirPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.mkdir(dirPath, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function rename(
  sftp: import('ssh2').SFTPWrapper,
  oldPath: string,
  newPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.rename(oldPath, newPath, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function downloadFile(
  sftp: import('ssh2').SFTPWrapper,
  filePath: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = sftp.createReadStream(filePath);

    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (err: Error) => reject(err));
  });
}

function modeToPermissions(mode: number | undefined): string {
  if (!mode) return '---------';
  const perms = mode & 0o777;
  const chars = ['r', 'w', 'x'];
  let result = '';
  for (let i = 2; i >= 0; i--) {
    const bits = (perms >> (i * 3)) & 0o7;
    result += chars[0] + ((bits & 4) ? chars[0] : '-');
    result = result.slice(0, -1);
    result += (bits & 4) ? 'r' : '-';
    result += (bits & 2) ? 'w' : '-';
    result += (bits & 1) ? 'x' : '-';
  }
  return result;
}
