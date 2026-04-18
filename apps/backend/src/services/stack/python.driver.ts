import { exec } from '../ssh.service.js';
import type { StackDriver, ProvisioningContext } from './stack.interface.js';

export class PythonDriver implements StackDriver {
  async install(ctx: ProvisioningContext): Promise<void> {
    // Check Python
    ctx.log('install', 'Checking Python 3...');
    let pythonCmd = 'python3';
    try {
      await exec(ctx.serverId, 'python3 --version');
    } catch {
      ctx.log('install', 'Installing Python 3...');
      await exec(ctx.serverId, 'sudo apt-get update -qq && sudo apt-get install -y python3 python3-pip python3-venv');
    }

    // Clone repo or create directory
    if (ctx.gitUrl) {
      ctx.log('install', `Cloning ${ctx.gitUrl}...`);
      await exec(ctx.serverId, `rm -rf ${ctx.rootPath}`);
      const branch = ctx.gitBranch ? `-b ${ctx.gitBranch}` : '';
      await exec(ctx.serverId, `git clone ${branch} ${ctx.gitUrl} ${ctx.rootPath}`);
    } else {
      await exec(ctx.serverId, `mkdir -p ${ctx.rootPath}`);
      // Create a minimal Flask app
      await exec(ctx.serverId, `cat << 'PYEOF' > ${ctx.rootPath}/app.py
from flask import Flask
app = Flask(__name__)

@app.route('/')
def hello():
    return 'Hello from NovaDash!'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=${ctx.port})
PYEOF`);
      await exec(ctx.serverId, `echo 'flask>=3.0' > ${ctx.rootPath}/requirements.txt`);
    }

    // Create virtual environment
    ctx.log('install', 'Creating virtual environment...');
    await exec(ctx.serverId, `${pythonCmd} -m venv ${ctx.rootPath}/venv`);

    // Install dependencies
    ctx.log('install', 'Installing dependencies...');
    await exec(ctx.serverId, `${ctx.rootPath}/venv/bin/pip install --upgrade pip`);
    await exec(ctx.serverId, `cd ${ctx.rootPath} && if [ -f requirements.txt ]; then ${ctx.rootPath}/venv/bin/pip install -r requirements.txt; fi`);

    // Write env vars
    if (Object.keys(ctx.envVars).length > 0) {
      const envContent = Object.entries(ctx.envVars).map(([k, v]) => `${k}=${v}`).join('\n');
      await exec(ctx.serverId, `cat << 'ENVEOF' > ${ctx.rootPath}/.env\n${envContent}\nENVEOF`);
    }

    // Install Supervisor if not present
    try {
      await exec(ctx.serverId, 'supervisorctl version');
    } catch {
      ctx.log('install', 'Installing Supervisor...');
      await exec(ctx.serverId, 'sudo apt-get install -y supervisor');
    }
  }

  async configure(ctx: ProvisioningContext): Promise<void> {
    // Nginx reverse proxy
    ctx.log('configure', 'Configuring Nginx...');
    const nginxConf = `server {
    listen 80;
    server_name ${ctx.domain};

    location / {
        proxy_pass http://127.0.0.1:${ctx.port};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}`;
    await exec(ctx.serverId, `cat << 'NGINXEOF' | sudo tee /etc/nginx/sites-available/${ctx.domain}\n${nginxConf}\nNGINXEOF`);
    await exec(ctx.serverId, `sudo ln -sf /etc/nginx/sites-available/${ctx.domain} /etc/nginx/sites-enabled/${ctx.domain}`);
    await exec(ctx.serverId, 'sudo nginx -t && sudo nginx -s reload');
    ctx.log('configure', 'Nginx configured');
  }

  async start(ctx: ProvisioningContext): Promise<void> {
    const workerName = `python-${ctx.siteId.substring(0, 12)}`;

    // Detect app type (Flask/FastAPI/Django) and set entrypoint
    const entrypoint = await this.detectEntrypoint(ctx);

    // Build env vars string for supervisor
    const envLines = Object.entries(ctx.envVars).map(([k, v]) => `${k}="${v}"`).join(',',);

    const supervisorConfig = `[program:${workerName}]
command=${ctx.rootPath}/venv/bin/${entrypoint}
directory=${ctx.rootPath}
user=www-data
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
stderr_logfile=/var/log/${workerName}-error.log
stdout_logfile=/var/log/${workerName}-out.log
environment=PORT="${ctx.port}",HOST="0.0.0.0"${envLines ? ',' + envLines : ''}`;

    await exec(ctx.serverId, `cat << 'SUPEOF' | sudo tee /etc/supervisor/conf.d/${workerName}.conf\n${supervisorConfig}\nSUPEOF`);
    await exec(ctx.serverId, 'sudo supervisorctl reread && sudo supervisorctl update');
    ctx.log('start', 'Application started via Supervisor');
  }

  async stop(ctx: ProvisioningContext): Promise<void> {
    const workerName = `python-${ctx.siteId.substring(0, 12)}`;
    try {
      await exec(ctx.serverId, `sudo supervisorctl stop ${workerName} 2>/dev/null || true`);
      await exec(ctx.serverId, `sudo rm -f /etc/supervisor/conf.d/${workerName}.conf`);
      await exec(ctx.serverId, 'sudo supervisorctl reread && sudo supervisorctl update');
    } catch { /* ignore */ }
  }

  async restart(ctx: ProvisioningContext): Promise<void> {
    const workerName = `python-${ctx.siteId.substring(0, 12)}`;
    try {
      await exec(ctx.serverId, `sudo supervisorctl restart ${workerName} 2>/dev/null || true`);
    } catch { /* ignore */ }
  }

  async getLogs(ctx: ProvisioningContext): Promise<string> {
    const workerName = `python-${ctx.siteId.substring(0, 12)}`;
    try {
      const out = await exec(ctx.serverId, `sudo tail -100 /var/log/${workerName}-out.log 2>/dev/null || echo ''`);
      const err = await exec(ctx.serverId, `sudo tail -50 /var/log/${workerName}-error.log 2>/dev/null || echo ''`);
      return out + '\n--- STDERR ---\n' + err;
    } catch {
      return 'No logs available';
    }
  }

  async getStatus(ctx: ProvisioningContext): Promise<'running' | 'stopped' | 'error'> {
    const workerName = `python-${ctx.siteId.substring(0, 12)}`;
    try {
      const output = await exec(ctx.serverId, `sudo supervisorctl status ${workerName} 2>/dev/null || echo 'STOPPED'`);
      if (output.includes('RUNNING')) return 'running';
      if (output.includes('STOPPED') || output.includes('EXITED')) return 'stopped';
      return 'error';
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
    await exec(ctx.serverId, `${ctx.rootPath}/venv/bin/pip install -r ${ctx.rootPath}/requirements.txt`);

    // Update env
    if (Object.keys(ctx.envVars).length > 0) {
      const envContent = Object.entries(ctx.envVars).map(([k, v]) => `${k}=${v}`).join('\n');
      await exec(ctx.serverId, `cat << 'ENVEOF' > ${ctx.rootPath}/.env\n${envContent}\nENVEOF`);
    }

    // Restart via supervisor
    const workerName = `python-${ctx.siteId.substring(0, 12)}`;
    await exec(ctx.serverId, `sudo supervisorctl restart ${workerName} 2>/dev/null || true`);
    ctx.log('deploy', 'Deploy complete');
  }

  async uninstall(ctx: ProvisioningContext): Promise<void> {
    await this.stop(ctx);
    try {
      await exec(ctx.serverId, `sudo rm -f /etc/nginx/sites-enabled/${ctx.domain}`);
      await exec(ctx.serverId, `sudo rm -f /etc/nginx/sites-available/${ctx.domain}`);
      await exec(ctx.serverId, 'sudo nginx -s reload');
    } catch { /* ignore */ }
    try {
      await exec(ctx.serverId, `rm -rf ${ctx.rootPath}`);
    } catch { /* ignore */ }
  }

  private async detectEntrypoint(ctx: ProvisioningContext): Promise<string> {
    // Check for common Python app entrypoints
    try {
      const hasGunicorn = await exec(ctx.serverId, `${ctx.rootPath}/venv/bin/pip show gunicorn 2>/dev/null`);
      const hasUvicorn = await exec(ctx.serverId, `${ctx.rootPath}/venv/bin/pip show uvicorn 2>/dev/null`);

      if (hasUvicorn.includes('Name: uvicorn')) {
        // FastAPI / ASGI app
        try {
          await exec(ctx.serverId, `test -f ${ctx.rootPath}/main.py`);
          return `uvicorn main:app --host 0.0.0.0 --port ${ctx.port}`;
        } catch {
          return `uvicorn app:app --host 0.0.0.0 --port ${ctx.port}`;
        }
      }

      if (hasGunicorn.includes('Name: gunicorn')) {
        // Django / WSGI app
        try {
          await exec(ctx.serverId, `test -f ${ctx.rootPath}/wsgi.py`);
          return `gunicorn wsgi:application --bind 0.0.0.0:${ctx.port}`;
        } catch {
          return `gunicorn app:app --bind 0.0.0.0:${ctx.port}`;
        }
      }
    } catch { /* fallback */ }

    // Default: run app.py with python
    return `python app.py`;
  }
}
