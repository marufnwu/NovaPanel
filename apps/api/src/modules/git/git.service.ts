import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';

function execAsync(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${cmd} ${args.join(' ')} failed: ${stderr || stdout}`));
    });
    child.on('error', reject);
  });
}

export class GitService {
  async cloneRepo(repo: string, branch: string, targetDir: string): Promise<void> {
    await execAsync('git', ['clone', '--branch', branch, '--single-branch', repo, targetDir]);
    logger.info({ repo, branch, targetDir }, 'Repository cloned');
  }

  async pullLatest(targetDir: string, branch: string): Promise<void> {
    await execAsync('git', ['-C', targetDir, 'checkout', branch]);
    await execAsync('git', ['-C', targetDir, 'pull', 'origin', branch]);
    logger.info({ targetDir, branch }, 'Repository pulled');
  }

  async getCurrentCommit(targetDir: string): Promise<string> {
    const hash = await execAsync('git', ['-C', targetDir, 'rev-parse', 'HEAD']);
    return hash.trim();
  }

  async getCommitMessage(targetDir: string): Promise<string> {
    const msg = await execAsync('git', ['-C', targetDir, 'log', '-1', '--format=%B']);
    return msg.trim();
  }

  validateWebhook(secret: string, payload: string, signature: string): boolean {
    if (!secret || !signature) return false;
    const expected = 'sha256=' + createHash('sha256').update(secret + payload).digest('hex');
    try {
      const diff = Buffer.compare(Buffer.from(signature), Buffer.from(expected));
      return diff === 0;
    } catch {
      return false;
    }
  }

  async checkoutRef(targetDir: string, ref: string): Promise<void> {
    await execAsync('git', ['-C', targetDir, 'fetch', 'origin', ref]);
    await execAsync('git', ['-C', targetDir, 'checkout', ref]);
  }
}

export const gitService = new GitService();