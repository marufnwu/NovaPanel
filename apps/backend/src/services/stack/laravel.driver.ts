import { exec } from '../ssh.service.js';
import { PhpDriver } from './php.driver.js';
import type { ProvisioningContext } from './stack.interface.js';

export class LaravelDriver extends PhpDriver {
  constructor(phpVersion: string = '8.2') {
    super(phpVersion);
  }

  override async install(ctx: ProvisioningContext): Promise<void> {
    await super.install(ctx);

    // Install Composer if not present
    ctx.log('install', 'Checking Composer...');
    try {
      await exec(ctx.serverId, 'composer --version');
    } catch {
      ctx.log('install', 'Installing Composer...');
      await exec(ctx.serverId, [
        'cd /tmp',
        'curl -sS https://getcomposer.org/installer | php',
        'sudo mv composer.phar /usr/local/bin/composer',
        'sudo chmod +x /usr/local/bin/composer',
      ].join(' && '));
    }

    // If no git repo, create fresh Laravel project
    if (!ctx.gitUrl) {
      ctx.log('install', 'Creating new Laravel project...');
      await exec(ctx.serverId, `cd /var/www && composer create-project laravel/laravel ${ctx.rootPath.split('/').pop()} --prefer-dist`);
      const projectName = ctx.rootPath.split('/').pop();
      await exec(ctx.serverId, `mv /var/www/${projectName}/* ${ctx.rootPath}/ 2>/dev/null || true`);
      await exec(ctx.serverId, `mv /var/www/${projectName}/.* ${ctx.rootPath}/ 2>/dev/null || true`);
      await exec(ctx.serverId, `rm -rf /var/www/${projectName}`);
    } else {
      // Install dependencies
      ctx.log('install', 'Running composer install...');
      await exec(ctx.serverId, `cd ${ctx.rootPath} && composer install --no-interaction --optimize-autoloader --no-dev`);
    }

    // Laravel-specific setup
    ctx.log('install', 'Setting up Laravel...');

    // Write .env
    const envContent = Object.entries(ctx.envVars).length > 0
      ? Object.entries(ctx.envVars).map(([k, v]) => `${k}=${v}`).join('\n')
      : `APP_NAME=Laravel\nAPP_ENV=production\nAPP_KEY=\nAPP_DEBUG=false\nAPP_URL=https://${ctx.domain}`;
    await exec(ctx.serverId, `cat << 'ENVEOF' > ${ctx.rootPath}/.env\n${envContent}\nENVEOF`);

    // Generate app key
    try {
      await exec(ctx.serverId, `cd ${ctx.rootPath} && php artisan key:generate --force`);
    } catch { /* may fail if no artisan */ }

    // Run migrations
    try {
      await exec(ctx.serverId, `cd ${ctx.rootPath} && php artisan migrate --force 2>&1 || true`);
    } catch { /* migrations may fail without DB */ }

    // Storage link
    try {
      await exec(ctx.serverId, `cd ${ctx.rootPath} && php artisan storage:link 2>&1 || true`);
    } catch { /* ignore */ }

    // Permissions
    await exec(ctx.serverId, `sudo chown -R www-data:www-data ${ctx.rootPath}`);
    await exec(ctx.serverId, `sudo chmod -R 775 ${ctx.rootPath}/storage ${ctx.rootPath}/bootstrap/cache`);
  }

  override async configure(ctx: ProvisioningContext): Promise<void> {
    await super.configure(ctx);

    // Install Supervisor if not present
    try {
      await exec(ctx.serverId, 'supervisorctl version');
    } catch {
      ctx.log('configure', 'Installing Supervisor...');
      await exec(ctx.serverId, 'sudo apt-get install -y supervisor');
    }

    // Create Supervisor config for Laravel queue worker
    const workerName = `laravel-worker-${ctx.siteId.substring(0, 12)}`;
    const supervisorConfig = `[program:${workerName}]
process_name=%(program_name)s_%(process_num)02d
command=php ${ctx.rootPath}/artisan queue:work sqs --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=1
redirect_stderr=true
stdout_logfile=${ctx.rootPath}/storage/logs/worker.log
stopwaitsecs=3600`;

    await exec(ctx.serverId, `cat << 'SUPEOF' | sudo tee /etc/supervisor/conf.d/${workerName}.conf\n${supervisorConfig}\nSUPEOF`);
    await exec(ctx.serverId, 'sudo supervisorctl reread && sudo supervisorctl update');
    ctx.log('configure', 'Queue worker configured');

    // Add Laravel scheduler cron
    const cronEntry = `* * * * * cd ${ctx.rootPath} && php artisan schedule:run >> /dev/null 2>&1 # novadash:${ctx.siteId}`;
    try {
      const existing = await exec(ctx.serverId, 'crontab -l 2>/dev/null || true');
      if (!existing.includes(ctx.siteId)) {
        await exec(ctx.serverId, `(crontab -l 2>/dev/null; echo "${cronEntry}") | crontab -`);
        ctx.log('configure', 'Scheduler cron added');
      }
    } catch { /* ignore */ }
  }

  override async start(ctx: ProvisioningContext): Promise<void> {
    await super.start(ctx);
    try {
      const workerName = `laravel-worker-${ctx.siteId.substring(0, 12)}`;
      await exec(ctx.serverId, `sudo supervisorctl start ${workerName}:* 2>/dev/null || true`);
    } catch { /* ignore */ }
  }

  override async stop(ctx: ProvisioningContext): Promise<void> {
    try {
      const workerName = `laravel-worker-${ctx.siteId.substring(0, 12)}`;
      await exec(ctx.serverId, `sudo supervisorctl stop ${workerName}:* 2>/dev/null || true`);
    } catch { /* ignore */ }
    await super.stop(ctx);
  }

  override async restart(ctx: ProvisioningContext): Promise<void> {
    await super.restart(ctx);
    try {
      const workerName = `laravel-worker-${ctx.siteId.substring(0, 12)}`;
      await exec(ctx.serverId, `sudo supervisorctl restart ${workerName}:* 2>/dev/null || true`);
    } catch { /* ignore */ }
  }

  override async getLogs(ctx: ProvisioningContext): Promise<string> {
    try {
      const laravelLog = await exec(ctx.serverId, `sudo tail -100 ${ctx.rootPath}/storage/logs/laravel.log 2>/dev/null || echo ''`);
      const phpLog = await super.getLogs(ctx);
      return laravelLog + '\n--- PHP-FPM ---\n' + phpLog;
    } catch {
      return super.getLogs(ctx);
    }
  }

  override async deploy(ctx: ProvisioningContext): Promise<void> {
    if (ctx.gitUrl) {
      ctx.log('deploy', 'Pulling latest code...');
      await exec(ctx.serverId, `cd ${ctx.rootPath} && git pull origin ${ctx.gitBranch || 'main'}`);
    }

    ctx.log('deploy', 'Installing dependencies...');
    await exec(ctx.serverId, `cd ${ctx.rootPath} && composer install --no-interaction --optimize-autoloader --no-dev`);

    // Update env
    if (Object.keys(ctx.envVars).length > 0) {
      const envContent = Object.entries(ctx.envVars).map(([k, v]) => `${k}=${v}`).join('\n');
      await exec(ctx.serverId, `cat << 'ENVEOF' > ${ctx.rootPath}/.env\n${envContent}\nENVEOF`);
    }

    ctx.log('deploy', 'Running migrations...');
    await exec(ctx.serverId, `cd ${ctx.rootPath} && php artisan migrate --force 2>&1 || true`);

    // Cache optimization
    await exec(ctx.serverId, `cd ${ctx.rootPath} && php artisan config:cache && php artisan route:cache && php artisan view:cache 2>&1 || true`);

    // Permissions
    await exec(ctx.serverId, `sudo chown -R www-data:www-data ${ctx.rootPath}`);
    await exec(ctx.serverId, `sudo chmod -R 775 ${ctx.rootPath}/storage ${ctx.rootPath}/bootstrap/cache`);

    // Reload PHP-FPM + restart workers
    await exec(ctx.serverId, `sudo systemctl reload php${this.phpVersion}-fpm`);
    try {
      const workerName = `laravel-worker-${ctx.siteId.substring(0, 12)}`;
      await exec(ctx.serverId, `sudo supervisorctl restart ${workerName}:* 2>/dev/null || true`);
    } catch { /* ignore */ }

    ctx.log('deploy', 'Deploy complete');
  }

  override async uninstall(ctx: ProvisioningContext): Promise<void> {
    // Remove supervisor config
    try {
      const workerName = `laravel-worker-${ctx.siteId.substring(0, 12)}`;
      await exec(ctx.serverId, `sudo rm -f /etc/supervisor/conf.d/${workerName}.conf`);
      await exec(ctx.serverId, 'sudo supervisorctl reread && sudo supervisorctl update');
    } catch { /* ignore */ }

    // Remove cron entry
    try {
      const crontab = await exec(ctx.serverId, 'crontab -l 2>/dev/null || true');
      const cleaned = crontab.split('\n').filter((line: string) => !line.includes(ctx.siteId)).join('\n');
      await exec(ctx.serverId, `echo "${cleaned}" | crontab -`);
    } catch { /* ignore */ }

    await super.uninstall(ctx);
  }
}
