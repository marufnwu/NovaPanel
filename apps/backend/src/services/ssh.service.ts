import { Client } from 'ssh2';
import { decrypt } from './crypto.service.js';

interface ConnectionEntry {
  client: Client;
  connected: boolean;
  failCount: number;
}

const connections = new Map<string, ConnectionEntry>();

interface SshConnectOptions {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}

export function connect(serverId: string, options: SshConnectOptions): Promise<Client> {
  return new Promise((resolve, reject) => {
    const existing = connections.get(serverId);
    if (existing?.connected) {
      resolve(existing.client);
      return;
    }

    const client = new Client();

    const config: Record<string, unknown> = {
      host: options.host,
      port: options.port,
      username: options.username,
      readyTimeout: 10000,
    };

    if (options.privateKey) {
      config.privateKey = options.privateKey;
    } else if (options.password) {
      config.password = options.password;
    }

    client.on('ready', () => {
      const entry = connections.get(serverId);
      if (entry) {
        entry.connected = true;
        entry.failCount = 0;
      } else {
        connections.set(serverId, { client, connected: true, failCount: 0 });
      }
      resolve(client);
    });

    client.on('error', (err) => {
      const entry = connections.get(serverId);
      if (entry) {
        entry.connected = false;
        entry.failCount++;
      }
      reject(err);
    });

    client.on('close', () => {
      const entry = connections.get(serverId);
      if (entry) {
        entry.connected = false;
      }
    });

    client.on('end', () => {
      const entry = connections.get(serverId);
      if (entry) {
        entry.connected = false;
      }
    });

    client.connect(config);
  });
}

export function exec(serverId: string, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const entry = connections.get(serverId);
    if (!entry?.connected) {
      reject(new Error(`No active SSH connection for server ${serverId}`));
      return;
    }

    entry.client.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      let stdout = '';
      let stderr = '';

      stream.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      stream.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      stream.on('close', () => {
        resolve(stdout);
      });
    });
  });
}

export function disconnect(serverId: string) {
  const entry = connections.get(serverId);
  if (entry) {
    entry.client.end();
    connections.delete(serverId);
  }
}

export function isConnected(serverId: string): boolean {
  const entry = connections.get(serverId);
  return entry?.connected ?? false;
}

export function getFailCount(serverId: string): number {
  const entry = connections.get(serverId);
  return entry?.failCount ?? 0;
}

export function getAllConnectedIds(): string[] {
  const ids: string[] = [];
  for (const [id, entry] of connections) {
    if (entry.connected) ids.push(id);
  }
  return ids;
}

export async function testConnection(options: SshConnectOptions): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client();

    const config: Record<string, unknown> = {
      host: options.host,
      port: options.port,
      username: options.username,
      readyTimeout: 10000,
    };

    if (options.privateKey) {
      config.privateKey = options.privateKey;
    } else if (options.password) {
      config.password = options.password;
    }

    client.on('ready', () => {
      resolve(client);
    });

    client.on('error', (err) => {
      reject(err);
    });

    client.connect(config);
  });
}

export function decryptAndConnect(
  serverId: string,
  server: {
    host: string;
    port: number;
    username: string;
    authType: string;
    passwordEncrypted: string | null;
    sshKey: { privateKeyEncrypted: string } | null;
  },
): Promise<Client> {
  const options: SshConnectOptions = {
    host: server.host,
    port: server.port,
    username: server.username,
  };

  if (server.authType === 'key' && server.sshKey) {
    options.privateKey = decrypt(server.sshKey.privateKeyEncrypted);
  } else if (server.authType === 'password' && server.passwordEncrypted) {
    options.password = decrypt(server.passwordEncrypted);
  }

  return connect(serverId, options);
}
