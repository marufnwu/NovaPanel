import { exec, decryptAndConnect } from './ssh.service.js';
import { prisma } from '../lib/prisma.js';
import { decrypt } from './crypto.service.js';

const CLOUDFLARED_BINARY_PATH = '/usr/local/bin/cloudflared';
const CLOUDFLARED_CONFIG_DIR = '/etc/cloudflared';
const CLOUDFLARED_SERVICE_NAME = 'cloudflared';

interface TunnelConfig {
  tunnelId: string;
  credentialsFile: string;
  ingress: Array<{ hostname: string; service: string }>;
}

export async function detectCloudflared(serverId: string): Promise<boolean> {
  try {
    const output = await exec(serverId, `which ${CLOUDFLARED_BINARY_PATH} 2>/dev/null || which cloudflared 2>/dev/null`);
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

export async function installCloudflared(serverId: string): Promise<string> {
  const commands = [
    `curl -L --output /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb`,
    `sudo dpkg -i /tmp/cloudflared.deb || sudo yum install -y /tmp/cloudflared.deb 2>/dev/null || (curl -L --output /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && sudo chmod +x /usr/local/bin/cloudflared)`,
    `rm -f /tmp/cloudflared.deb`,
    `${CLOUDFLARED_BINARY_PATH} --version || cloudflared --version`,
  ];

  let output = '';
  for (const cmd of commands) {
    output = await exec(serverId, cmd);
  }
  return output;
}

export async function writeTunnelCredentials(
  serverId: string,
  tunnelId: string,
  credentialsJson: string,
): Promise<string> {
  const credPath = `${CLOUDFLARED_CONFIG_DIR}/${tunnelId}-credentials.json`;

  const commands = [
    `sudo mkdir -p ${CLOUDFLARED_CONFIG_DIR}`,
    `echo '${credentialsJson.replace(/'/g, "'\\''")}' | sudo tee ${credPath}`,
    `sudo chmod 600 ${credPath}`,
  ];

  for (const cmd of commands) {
    await exec(serverId, cmd);
  }

  return credPath;
}

export async function writeTunnelConfig(
  serverId: string,
  config: TunnelConfig,
): Promise<void> {
  const configPath = `${CLOUDFLARED_CONFIG_DIR}/${config.tunnelId}.yml`;

  const ingressLines = config.ingress
    .map((r) => `  - hostname: ${r.hostname}\n    service: ${r.service}`)
    .join('\n');

  const catchAll = `  - service: http_status:404`;

  const yaml = `tunnel: ${config.tunnelId}
credentials-file: ${config.credentialsFile}

ingress:
${ingressLines}
${catchAll}
`;

  const commands = [
    `sudo mkdir -p ${CLOUDFLARED_CONFIG_DIR}`,
    `cat << 'CFCONFIG' | sudo tee ${configPath}
${yaml}CFCONFIG`,
  ];

  for (const cmd of commands) {
    await exec(serverId, cmd);
  }
}

export async function installTunnelService(
  serverId: string,
  tunnelId: string,
): Promise<void> {
  const configPath = `${CLOUDFLARED_CONFIG_DIR}/${tunnelId}.yml`;

  const commands = [
    `sudo ${CLOUDFLARED_BINARY_PATH} service install ${configPath} 2>/dev/null || true`,
    `sudo systemctl enable ${CLOUDFLARED_SERVICE_NAME}`,
    `sudo systemctl start ${CLOUDFLARED_SERVICE_NAME}`,
  ];

  for (const cmd of commands) {
    await exec(serverId, cmd);
  }
}

export async function restartCloudflared(serverId: string): Promise<string> {
  return exec(serverId, `sudo systemctl restart ${CLOUDFLARED_SERVICE_NAME}`);
}

export async function stopCloudflared(serverId: string): Promise<string> {
  return exec(serverId, `sudo systemctl stop ${CLOUDFLARED_SERVICE_NAME}`);
}

export async function getCloudflaredStatus(serverId: string): Promise<{
  running: boolean;
  activeSince: string | null;
}> {
  try {
    const output = await exec(
      serverId,
      `systemctl is-active ${CLOUDFLARED_SERVICE_NAME} 2>/dev/null && systemctl show ${CLOUDFLARED_SERVICE_NAME} --property=ActiveEnterTimestamp --value`,
    );
    const lines = output.trim().split('\n');
    const running = lines[0]?.trim() === 'active';
    const activeSince = lines[1]?.trim() || null;
    return { running, activeSince };
  } catch {
    return { running: false, activeSince: null };
  }
}

export async function uninstallCloudflared(serverId: string, tunnelId: string): Promise<void> {
  const commands = [
    `sudo systemctl stop ${CLOUDFLARED_SERVICE_NAME} 2>/dev/null || true`,
    `sudo systemctl disable ${CLOUDFLARED_SERVICE_NAME} 2>/dev/null || true`,
    `sudo rm -f /etc/systemd/system/${CLOUDFLARED_SERVICE_NAME}.service`,
    `sudo systemctl daemon-reload`,
    `sudo rm -f ${CLOUDFLARED_CONFIG_DIR}/${tunnelId}.yml`,
    `sudo rm -f ${CLOUDFLARED_CONFIG_DIR}/${tunnelId}-credentials.json`,
  ];

  for (const cmd of commands) {
    await exec(serverId, cmd);
  }
}
