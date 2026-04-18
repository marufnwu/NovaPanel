import { exec } from '../ssh.service.js';
import { encrypt } from '../crypto.service.js';
import { prisma } from '../../lib/prisma.js';
import type { StackDriver, ProvisioningContext } from './stack.interface.js';

export class NodeJsDriver implements StackDriver {
  async install(ctx: ProvisioningContext): Promise<void> {
    ctx.log('install', 'Checking Node.js runtime...');

    // Check if Node.js is installed
    let nodeVersion = '';
    try {
      nodeVersion = await exec(ctx.serverId, 'node --version');
    } catch {
      ctx.log('install', 'Installing Node.js via nvm...');
      await exec(ctx.serverId, 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash');
      await exec(ctx.serverId, 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm install 20');
      nodeVersion = await exec(ctx.serverId, 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && node --version');
    }

    ctx.log('install', `Node.js ${nodeVersion.trim()} ready`);

    // Clone repo if provided
    if (ctx.gitUrl) {
      ctx.log('install', `Cloning ${ctx.gitUrl}...`);
      await exec(ctx.serverId, `rm -rf ${ctx.rootPath}`);
      const branch = ctx.gitBranch ? `-b ${ctx.gitBranch}` : '';
      await exec(ctx.serverId, `git clone ${branch} ${ctx.gitUrl} ${ctx.rootPath}`);
    } else {
      await exec(ctx.serverId, `mkdir -p ${ctx.rootPath}`);
    }

    // Write env vars
    if (Object.keys(ctx.envVars).length > 0) {
      ctx.log('install', 'Writing environment variables...');
      const envContent = Object.entries(ctx.envVars)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
      await exec(ctx.serverId, `cat << 'ENVEOF' > ${ctx.rootPath}/.env\n${envContent}\nENVEOF`);
    }

    // Install dependencies
    ctx.log('install', 'Installing dependencies...');
    await exec(ctx.serverId, `cd ${ctx.rootPath} && npm install --production 2>&1 || yarn install --production 2>&1 || pnpm install --prod 2>&1`);
  }

  async configure(ctx: ProvisioningContext): Promise<void> {
    ctx.log('configure', 'Generating Nginx config...');
    const nginxConf = generateNginxConfig(ctx.domain, ctx.port, ctx.rootPath);
    await exec(ctx.serverId, `cat << 'NGINXEOF' | sudo tee /etc/nginx/sites-available/${ctx.domain}\n${nginxConf}\nNGINXEOF`);
    await exec(ctx.serverId, `sudo ln -sf /etc/nginx/sites-available/${ctx.domain} /etc/nginx/sites-enabled/${ctx.domain}`);
    await exec(ctx.serverId, 'sudo nginx -t');
    await exec(ctx.serverId, 'sudo nginx -s reload');
    ctx.log('configure', 'Nginx configured');
  }

  async start(ctx: ProvisioningContext): Promise<void> {
    ctx.log('start', 'Starting with PM2...');

    // Check if PM2 is installed
    try {
      await exec(ctx.serverId, 'pm2 --version');
    } catch {
      ctx.log('start', 'Installing PM2...');
      await exec(ctx.serverId, 'sudo npm install -g pm2');
    }

    // Generate ecosystem file
    const ecosystem = {
      apps: [{
        name: ctx.siteId,
        script: 'index.js',
        cwd: ctx.rootPath,
        env: { PORT: ctx.port, NODE_ENV: 'production' },
      }],
    };

    await exec(ctx.serverId, `cat << 'PM2EOF' > ${ctx.rootPath}/ecosystem.config.js\nmodule.exports = ${JSON.stringify(ecosystem, null, 2)}\nPM2EOF`);

    await exec(ctx.serverId, `cd ${ctx.rootPath} && pm2 start ecosystem.config.js || pm2 restart ${ctx.siteId}`);
    await exec(ctx.serverId, 'pm2 save');
    ctx.log('start', 'Application started');
  }

  async stop(ctx: ProvisioningContext): Promise<void> {
    try {
      await exec(ctx.serverId, `pm2 stop ${ctx.siteId} || true`);
    } catch {
      // PM2 might not be running
    }
  }

  async restart(ctx: ProvisioningContext): Promise<void> {
    await exec(ctx.serverId, `pm2 restart ${ctx.siteId} || true`);
  }

  async getLogs(ctx: ProvisioningContext): Promise<string> {
    try {
      return await exec(ctx.serverId, `pm2 logs ${ctx.siteId} --lines 100 --nostream`);
    } catch {
      return 'No logs available';
    }
  }

  async getStatus(ctx: ProvisioningContext): Promise<'running' | 'stopped' | 'error'> {
    try {
      const output = await exec(ctx.serverId, `pm2 jlist`);
      const processes = JSON.parse(output);
      const proc = processes.find((p: any) => p.name === ctx.siteId);
      if (!proc) return 'stopped';
      return proc.pm2_env.status === 'online' ? 'running' : proc.pm2_env.status === 'stopped' ? 'stopped' : 'error';
    } catch {
      return 'stopped';
    }
  }

  async deploy(ctx: ProvisioningContext): Promise<void> {
    if (ctx.gitUrl) {
      ctx.log('deploy', 'Pulling latest code...');
      await exec(ctx.serverId, `cd ${ctx.rootPath} && git pull origin ${ctx.gitBranch || 'main'}`);
    }

    ctx.log('deploy', 'Installing dependencies...');
    await exec(ctx.serverId, `cd ${ctx.rootPath} && npm install 2>&1 || yarn install 2>&1 || pnpm install 2>&1`);

    // Build step
    ctx.log('deploy', 'Running build...');
    try {
      await exec(ctx.serverId, `cd ${ctx.rootPath} && npm run build 2>&1 || true`);
    } catch {
      // Build step may not exist
    }

    ctx.log('deploy', 'Restarting application...');
    await exec(ctx.serverId, `pm2 restart ${ctx.siteId} || cd ${ctx.rootPath} && pm2 start ecosystem.config.js`);

    ctx.log('deploy', 'Deploy complete');
  }

  async uninstall(ctx: ProvisioningContext): Promise<void> {
    try {
      await exec(ctx.serverId, `pm2 delete ${ctx.siteId} || true`);
      await exec(ctx.serverId, 'pm2 save');
    } catch {
      // ignore
    }
    try {
      await exec(ctx.serverId, `sudo rm -f /etc/nginx/sites-enabled/${ctx.domain}`);
      await exec(ctx.serverId, `sudo rm -f /etc/nginx/sites-available/${ctx.domain}`);
      await exec(ctx.serverId, 'sudo nginx -s reload');
    } catch {
      // ignore
    }
    try {
      await exec(ctx.serverId, `rm -rf ${ctx.rootPath}`);
    } catch {
      // ignore
    }
  }
}

function generateNginxConfig(domain: string, port: number, rootPath: string): string {
  return `server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}`;
}
