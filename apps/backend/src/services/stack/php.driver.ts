import { exec } from '../ssh.service.js';
import { prisma } from '../../lib/prisma.js';
import type { StackDriver, ProvisioningContext } from './stack.interface.js';

export class PhpDriver implements StackDriver {
  protected phpVersion: string;

  constructor(phpVersion: string = '8.2') {
    this.phpVersion = phpVersion;
  }

  async install(ctx: ProvisioningContext): Promise<void> {
    ctx.log('install', `Checking PHP ${this.phpVersion}...`);

    // Install PHP + FPM + common extensions
    try {
      await exec(ctx.serverId, `php${this.phpVersion} -v 2>/dev/null`);
    } catch {
      ctx.log('install', `Installing PHP ${this.phpVersion} + FPM...`);
      await exec(ctx.serverId, [
        'sudo add-apt-repository -y ppa:ondrej/php 2>/dev/null || true',
        'sudo apt-get update -qq',
        `sudo apt-get install -y php${this.phpVersion} php${this.phpVersion}-fpm php${this.phpVersion}-cli php${this.phpVersion}-common`,
        `sudo apt-get install -y php${this.phpVersion}-mysql php${this.phpVersion}-mbstring php${this.phpVersion}-xml php${this.phpVersion}-curl php${this.phpVersion}-zip php${this.phpVersion}-gd php${this.phpVersion}-bcmath`,
      ].join(' && '));
    }
    ctx.log('install', `PHP ${this.phpVersion} ready`);

    // Clone repo or create directory
    if (ctx.gitUrl) {
      ctx.log('install', `Cloning ${ctx.gitUrl}...`);
      await exec(ctx.serverId, `rm -rf ${ctx.rootPath}`);
      const branch = ctx.gitBranch ? `-b ${ctx.gitBranch}` : '';
      await exec(ctx.serverId, `git clone ${branch} ${ctx.gitUrl} ${ctx.rootPath}`);
    } else {
      await exec(ctx.serverId, `mkdir -p ${ctx.rootPath}/public`);
      // Create index.php if no git repo
      await exec(ctx.serverId, `cat << 'PHPEOF' > ${ctx.rootPath}/public/index.php\n<?php phpinfo(); ?>\nPHPEOF`);
    }

    // Set permissions
    await exec(ctx.serverId, `sudo chown -R www-data:www-data ${ctx.rootPath}`);
    await exec(ctx.serverId, `sudo chmod -R 755 ${ctx.rootPath}`);

    // Write env vars
    if (Object.keys(ctx.envVars).length > 0) {
      const envContent = Object.entries(ctx.envVars).map(([k, v]) => `${k}=${v}`).join('\n');
      await exec(ctx.serverId, `cat << 'ENVEOF' > ${ctx.rootPath}/.env\n${envContent}\nENVEOF`);
    }
  }

  async configure(ctx: ProvisioningContext): Promise<void> {
    // Create PHP-FPM pool
    const poolName = ctx.siteId.replace(/-/g, '_');
    ctx.log('configure', `Creating PHP-FPM pool ${poolName}...`);

    const poolConfig = `[${poolName}]
user = www-data
group = www-data
listen = /run/php/${poolName}.sock
listen.owner = www-data
listen.group = www-data
pm = dynamic
pm.max_children = 20
pm.start_servers = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 5
php_admin_value[docroot] = ${ctx.rootPath}/public
php_admin_value[error_log] = /var/log/php-fpm/${poolName}-error.log
env[PATH] = /usr/local/bin:/usr/bin:/bin`;

    await exec(ctx.serverId, `cat << 'FPMEOF' | sudo tee /etc/php/${this.phpVersion}/fpm/pool.d/${poolName}.conf\n${poolConfig}\nFPMEOF`);
    await exec(ctx.serverId, `sudo systemctl restart php${this.phpVersion}-fpm`);
    ctx.log('configure', 'PHP-FPM pool configured');

    // Nginx config with fastcgi_pass
    ctx.log('configure', 'Configuring Nginx...');
    const nginxConf = this.generateNginxConfig(ctx.domain, ctx.rootPath, poolName);
    await exec(ctx.serverId, `cat << 'NGINXEOF' | sudo tee /etc/nginx/sites-available/${ctx.domain}\n${nginxConf}\nNGINXEOF`);
    await exec(ctx.serverId, `sudo ln -sf /etc/nginx/sites-available/${ctx.domain} /etc/nginx/sites-enabled/${ctx.domain}`);
    await exec(ctx.serverId, 'sudo nginx -t && sudo nginx -s reload');
    ctx.log('configure', 'Nginx configured');
  }

  async start(ctx: ProvisioningContext): Promise<void> {
    // PHP-FPM is already running from configure step
    const poolName = ctx.siteId.replace(/-/g, '_');
    await exec(ctx.serverId, `sudo systemctl restart php${this.phpVersion}-fpm`);
    ctx.log('start', 'PHP-FPM started');
  }

  async stop(ctx: ProvisioningContext): Promise<void> {
    const poolName = ctx.siteId.replace(/-/g, '_');
    try {
      await exec(ctx.serverId, `sudo rm -f /etc/php/${this.phpVersion}/fpm/pool.d/${poolName}.conf`);
      await exec(ctx.serverId, `sudo systemctl restart php${this.phpVersion}-fpm`);
    } catch {
      // ignore
    }
  }

  async restart(ctx: ProvisioningContext): Promise<void> {
    await exec(ctx.serverId, `sudo systemctl restart php${this.phpVersion}-fpm`);
  }

  async getLogs(ctx: ProvisioningContext): Promise<string> {
    try {
      const poolName = ctx.siteId.replace(/-/g, '_');
      return await exec(ctx.serverId, `sudo tail -100 /var/log/php-fpm/${poolName}-error.log 2>/dev/null || sudo tail -100 /var/log/php${this.phpVersion}-fpm.log 2>/dev/null || echo 'No logs'`);
    } catch {
      return 'No logs available';
    }
  }

  async getStatus(ctx: ProvisioningContext): Promise<'running' | 'stopped' | 'error'> {
    try {
      const poolName = ctx.siteId.replace(/-/g, '_');
      const output = await exec(ctx.serverId, `sudo systemctl is-active php${this.phpVersion}-fpm && ls /run/php/${poolName}.sock 2>/dev/null && echo 'running' || echo 'stopped'`);
      return output.includes('running') ? 'running' : 'stopped';
    } catch {
      return 'stopped';
    }
  }

  async deploy(ctx: ProvisioningContext): Promise<void> {
    if (ctx.gitUrl) {
      ctx.log('deploy', 'Pulling latest code...');
      await exec(ctx.serverId, `cd ${ctx.rootPath} && git pull origin ${ctx.gitBranch || 'main'}`);
    }

    // Update env vars
    if (Object.keys(ctx.envVars).length > 0) {
      const envContent = Object.entries(ctx.envVars).map(([k, v]) => `${k}=${v}`).join('\n');
      await exec(ctx.serverId, `cat << 'ENVEOF' > ${ctx.rootPath}/.env\n${envContent}\nENVEOF`);
    }

    await exec(ctx.serverId, `sudo chown -R www-data:www-data ${ctx.rootPath}`);
    await exec(ctx.serverId, `sudo systemctl reload php${this.phpVersion}-fpm`);
    ctx.log('deploy', 'Deploy complete');
  }

  async uninstall(ctx: ProvisioningContext): Promise<void> {
    const poolName = ctx.siteId.replace(/-/g, '_');
    try {
      await exec(ctx.serverId, `sudo rm -f /etc/php/${this.phpVersion}/fpm/pool.d/${poolName}.conf`);
      await exec(ctx.serverId, `sudo systemctl restart php${this.phpVersion}-fpm`);
    } catch { /* ignore */ }
    try {
      await exec(ctx.serverId, `sudo rm -f /etc/nginx/sites-enabled/${ctx.domain}`);
      await exec(ctx.serverId, `sudo rm -f /etc/nginx/sites-available/${ctx.domain}`);
      await exec(ctx.serverId, 'sudo nginx -s reload');
    } catch { /* ignore */ }
    try {
      await exec(ctx.serverId, `rm -rf ${ctx.rootPath}`);
    } catch { /* ignore */ }
  }

  protected generateNginxConfig(domain: string, rootPath: string, poolName: string): string {
    return `server {
    listen 80;
    server_name ${domain};
    root ${rootPath}/public;
    index index.php index.html;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \\.php$ {
        fastcgi_pass unix:/run/php/${poolName}.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_hide_header X-Powered-By;
    }

    location ~ /\\.ht {
        deny all;
    }
}`;
  }
}
