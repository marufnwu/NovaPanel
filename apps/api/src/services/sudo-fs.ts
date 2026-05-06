/**
 * Sudo-aware file system operations.
 *
 * The NovaPanel API process runs as the `novapanel` user inside Docker,
 * but many config files live under /etc/ which is owned by root.
 * These helpers wrap the executor to perform fs operations via sudo.
 */
import { run } from './executor.js';
import { logger } from '../config/logger.js';

/**
 * Write a file atomically using write-to-temp-then-rename pattern.
 * This ensures the target file is either the old version or the new version,
 * never a partial/corrupt file if the write is interrupted.
 *
 * 1. Writes content to a temp file (/tmp/novapanel-{random}.tmp)
 * 2. Uses mv (rename) to atomically replace the target file
 */
export async function atomicWrite(path: string, content: string): Promise<void> {
  try {
    // Generate unique temp file path
    const tempPath = `/tmp/novapanel-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;

    // Write content to temp file via tee
    const result = await run('tee', [tempPath], { sudo: true, input: content });
    if (!result.success) {
      throw new Error(`Failed to write temp file ${tempPath}: ${result.stderr || result.stdout}`);
    }

    // Atomically move temp file to target (mv is atomic on same filesystem)
    const mvResult = await run('mv', ['-f', tempPath, path], { sudo: true });
    if (!mvResult.success) {
      throw new Error(`Failed to move ${tempPath} to ${path}: ${mvResult.stderr || mvResult.stdout}`);
    }
  } catch (error: any) {
    logger.error({ path, error: error.message }, 'sudo-fs atomicWrite failed');
    throw new Error(`Failed to write file ${path}: ${error.message}`);
  }
}

/**
 * Write a file using sudo (via tee).
 * Content is piped through stdin to avoid shell injection.
 */
export async function writeFile(path: string, content: string): Promise<void> {
  try {
    const result = await run('tee', [path], { sudo: true, input: content });
    if (!result.success) {
      throw new Error(`Failed to write ${path}: ${result.stderr || result.stdout}`);
    }
  } catch (error: any) {
    logger.error({ path, error: error.message }, 'sudo-fs writeFile failed');
    throw new Error(`Failed to write file ${path}: ${error.message}`);
  }
}

/**
 * Append to a file using sudo (via tee -a).
 */
export async function appendFile(path: string, content: string): Promise<void> {
  try {
    const result = await run('tee', ['-a', path], { sudo: true, input: content });
    if (!result.success) {
      throw new Error(`Failed to append to ${path}: ${result.stderr || result.stdout}`);
    }
  } catch (error: any) {
    logger.error({ path, error: error.message }, 'sudo-fs appendFile failed');
    throw new Error(`Failed to append to file ${path}: ${error.message}`);
  }
}

/**
 * Read a file using sudo (via cat).
 * Returns the file content as a string.
 * Throws if the file cannot be read.
 */
export async function readFile(path: string): Promise<string> {
  try {
    const result = await run('cat', [path], { sudo: true });
    if (!result.success) {
      throw new Error(`Failed to read ${path}: ${result.stderr || result.stdout}`);
    }
    return result.stdout;
  } catch (error: any) {
    logger.error({ path, error: error.message }, 'sudo-fs readFile failed');
    throw new Error(`Failed to read file ${path}: ${error.message}`);
  }
}

/**
 * Create a directory (with -p) using sudo.
 */
export async function mkdir(path: string): Promise<void> {
  try {
    const result = await run('mkdir', ['-p', path], { sudo: true });
    if (!result.success) {
      throw new Error(`Failed to create directory ${path}: ${result.stderr || result.stdout}`);
    }
  } catch (error: any) {
    logger.error({ path, error: error.message }, 'sudo-fs mkdir failed');
    throw new Error(`Failed to create directory ${path}: ${error.message}`);
  }
}

/**
 * Remove a file using sudo.
 */
export async function unlink(path: string): Promise<void> {
  try {
    const result = await run('rm', ['-f', path], { sudo: true });
    if (!result.success) {
      throw new Error(`Failed to remove ${path}: ${result.stderr || result.stdout}`);
    }
  } catch (error: any) {
    logger.error({ path, error: error.message }, 'sudo-fs unlink failed');
    throw new Error(`Failed to remove file ${path}: ${error.message}`);
  }
}

/**
 * Create a symbolic link using sudo (ln -sf).
 */
export async function symlink(target: string, linkPath: string): Promise<void> {
  try {
    const result = await run('ln', ['-sf', target, linkPath], { sudo: true });
    if (!result.success) {
      throw new Error(`Failed to create symlink ${linkPath}: ${result.stderr || result.stdout}`);
    }
  } catch (error: any) {
    logger.error({ target, linkPath, error: error.message }, 'sudo-fs symlink failed');
    throw new Error(`Failed to create symlink ${linkPath}: ${error.message}`);
  }
}

/**
 * Change file permissions using sudo chmod.
 */
export async function chmod(path: string, mode: string): Promise<void> {
  try {
    const result = await run('chmod', [mode, path], { sudo: true });
    if (!result.success) {
      throw new Error(`Failed to chmod ${path}: ${result.stderr || result.stdout}`);
    }
  } catch (error: any) {
    logger.error({ path, mode, error: error.message }, 'sudo-fs chmod failed');
    throw new Error(`Failed to chmod ${path}: ${error.message}`);
  }
}

/**
 * Rename / move a file or directory using sudo mv.
 */
export async function rename(oldPath: string, newPath: string): Promise<void> {
  try {
    const result = await run('mv', ['-f', oldPath, newPath], { sudo: true });
    if (!result.success) {
      throw new Error(`Failed to rename ${oldPath} to ${newPath}: ${result.stderr || result.stdout}`);
    }
  } catch (error: any) {
    logger.error({ oldPath, newPath, error: error.message }, 'sudo-fs rename failed');
    throw new Error(`Failed to rename ${oldPath} to ${newPath}: ${error.message}`);
  }
}

/**
 * Remove a file or directory using sudo rm.
 * Supports recursive removal for directories.
 */
export async function remove(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
  try {
    const args: string[] = [];
    if (options?.recursive) args.push('-r');
    if (options?.force) args.push('-f');
    args.push(path);

    const result = await run('rm', args, { sudo: true });
    if (!result.success) {
      throw new Error(`Failed to remove ${path}: ${result.stderr || result.stdout}`);
    }
  } catch (error: any) {
    logger.error({ path, error: error.message }, 'sudo-fs remove failed');
    throw new Error(`Failed to remove ${path}: ${error.message}`);
  }
}

/**
 * Copy a file or directory using sudo cp.
 * Supports recursive copying for directories.
 */
export async function copy(source: string, destination: string, options?: { recursive?: boolean }): Promise<void> {
  try {
    const args: string[] = [];
    if (options?.recursive) args.push('-r');
    args.push(source, destination);

    const result = await run('cp', args, { sudo: true });
    if (!result.success) {
      throw new Error(`Failed to copy ${source} to ${destination}: ${result.stderr || result.stdout}`);
    }
  } catch (error: any) {
    logger.error({ source, destination, error: error.message }, 'sudo-fs copy failed');
    throw new Error(`Failed to copy ${source} to ${destination}: ${error.message}`);
  }
}
