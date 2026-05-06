import { readdir, stat, lstat, readFile, open, writeFile as fsWriteFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { run } from '../../services/executor.js';
import * as sudoFs from '../../services/sudo-fs.js';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';
import { auditService } from '../audit/audit.service.js';

interface FileItem {
  name: string;
  type: string;
  size: number;
  permissions: string;
  modifiedAt: string;
  isDirectory: boolean;
  uid: number;
  gid: number;
  owner?: string;
  group?: string;
}

interface DirectoryTreeNode {
  name: string;
  path: string;
  type: string;
  isDirectory: boolean;
  isExpanded?: boolean;
  children: DirectoryTreeNode[];
}

export class FilesService {
  /**
   * Validate and resolve a safe path within subscription home dir
   */
  safePath(homeDir: string, requestedPath: string): string {
    // Strip leading slash so path is resolved relative to homeDir
    const relativePath = requestedPath.startsWith('/') ? requestedPath.slice(1) : requestedPath;
    const resolved = path.resolve(homeDir, relativePath || '.');
    if (!resolved.startsWith(homeDir)) {
      throw new AppError(403, 'PATH_TRAVERSAL', 'Access denied: path outside home directory');
    }
    return resolved;
  }

  /**
   * List directory contents
   */
  async listDirectory(
    homeDir: string,
    relativePath: string = '/',
    options?: {
      showHidden?: boolean;
      sortBy?: 'name' | 'size' | 'modified' | 'type';
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<FileItem[]> {
    const { showHidden = false, sortBy = 'name', sortOrder = 'asc' } = options || {};
    const targetPath = this.safePath(homeDir, relativePath);

    try {
      const entries = await readdir(targetPath, { withFileTypes: true });
      let items = await Promise.all(
        entries
          .filter(entry => showHidden || !entry.name.startsWith('.'))
          .map(async (entry) => {
            const fullPath = path.join(targetPath, entry.name);
            try {
              const stats = await lstat(fullPath);
              return {
                name: entry.name,
                type: entry.isDirectory() ? 'directory' : this.getFileType(entry.name),
                size: stats.size,
                permissions: stats.mode.toString(8).slice(-3),
                modifiedAt: stats.mtime.toISOString(),
                isDirectory: entry.isDirectory(),
                uid: stats.uid,
                gid: stats.gid,
              };
            } catch {
              return null;
            }
          })
      );

      // Sort items
      const filtered = items.filter(Boolean) as FileItem[];
      filtered.sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'size':
            comparison = a.size - b.size;
            break;
          case 'modified':
            comparison = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
            break;
          case 'type':
            comparison = a.type.localeCompare(b.type);
            break;
        }
        
        return sortOrder === 'desc' ? -comparison : comparison;
      });

      return filtered;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new AppError(404, 'DIR_NOT_FOUND', 'Directory not found');
      }
      if (error.code === 'EACCES') {
        throw new AppError(403, 'ACCESS_DENIED', 'Permission denied');
      }
      throw error;
    }
  }

  /**
   * Get directory tree structure for left panel
   */
  async getDirectoryTree(homeDir: string, relativePath: string = '/', options?: { showHidden?: boolean }): Promise<DirectoryTreeNode> {
    const { showHidden = false } = options || {};
    const targetPath = this.safePath(homeDir, relativePath);

    try {
      const entries = await readdir(targetPath, { withFileTypes: true });
      const children = await Promise.all(
        entries
          .filter(entry => showHidden || !entry.name.startsWith('.'))
          .map(async (entry) => {
            const fullPath = path.join(targetPath, entry.name);
            const isDir = entry.isDirectory();
            
            if (isDir) {
              // Recursively get children for directories
              const childTree = await this.getDirectoryTree(homeDir, path.join(relativePath, entry.name), { showHidden });
              return {
                name: entry.name,
                type: 'directory' as const,
                path: path.join(relativePath, entry.name),
                children: childTree.children,
                isExpanded: false,
                isDirectory: true,
              };
            } else {
              return {
                name: entry.name,
                type: this.getFileType(entry.name),
                path: path.join(relativePath, entry.name),
                isDirectory: false,
                children: [],
              };
            }
          })
      );

      // Sort children by name, directories first
      children.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      return {
        name: relativePath === '/' ? 'Root' : path.basename(relativePath) || 'Root',
        type: 'directory' as const,
        path: relativePath,
        children,
        isExpanded: false,
        isDirectory: true,
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new AppError(404, 'DIR_NOT_FOUND', 'Directory not found');
      }
      if (error.code === 'EACCES') {
        throw new AppError(403, 'ACCESS_DENIED', 'Permission denied');
      }
      throw error;
    }
  }

  /**
   * Upload a file
   */
  async uploadFile(homeDir: string, relativePath: string, filename: string, content: Buffer, userId?: string, ipAddress?: string) {
    const targetDir = this.safePath(homeDir, relativePath);
    const targetPath = path.join(targetDir, filename);

    this.safePath(homeDir, path.join(relativePath, filename));

    // Write to temp file first (novapanel user can write to /tmp), then sudo mv to target
    const tempPath = `/tmp/novapanel-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      await fsWriteFile(tempPath, content);
      await sudoFs.rename(tempPath, targetPath);
    } catch (e: any) {
      // Clean up temp file if mv failed
      try { await sudoFs.remove(tempPath, { force: true }); } catch {}
      throw new AppError(500, 'UPLOAD_FAILED', `Failed to upload file: ${e.message}`);
    }
    logger.info({ path: targetPath, size: content.length }, 'File uploaded');

    auditService.log({
      userId,
      action: 'file.upload',
      resource: `file:${path.join(relativePath, filename)}`,
      details: JSON.stringify({ size: content.length }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { name: filename, size: content.length };
  }

  /**
   * Create a directory
   */
  async createDirectory(homeDir: string, relativePath: string, dirName: string, userId?: string, ipAddress?: string) {
    const targetPath = this.safePath(homeDir, path.join(relativePath, dirName));
    try {
      await sudoFs.mkdir(targetPath);

      auditService.log({
        userId,
        action: 'file.mkdir',
        resource: `dir:${path.join(relativePath, dirName)}`,
        ipAddress,
      }).catch(err => logger.error({ err }, 'Audit log failed'));

      return { name: dirName, created: true };
    } catch (error: any) {
      throw new AppError(500, 'MKDIR_FAILED', `Failed to create directory: ${error.message}`);
    }
  }

  /**
   * Delete a file or directory
   */
  async deleteItem(homeDir: string, relativePath: string, userId?: string, ipAddress?: string) {
    const targetPath = this.safePath(homeDir, relativePath);
    await sudoFs.remove(targetPath, { recursive: true, force: true });
    logger.info({ path: targetPath }, 'Item deleted');

    auditService.log({
      userId,
      action: 'file.delete',
      resource: `file:${relativePath}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  /**
   * Rename a file or directory
   */
  async renameItem(homeDir: string, oldRelativePath: string, newRelativePath: string, userId?: string, ipAddress?: string) {
    const oldPath = this.safePath(homeDir, oldRelativePath);
    const newPath = this.safePath(homeDir, newRelativePath);
    try {
      await sudoFs.rename(oldPath, newPath);

      auditService.log({
        userId,
        action: 'file.rename',
        resource: `file:${oldRelativePath}`,
        details: JSON.stringify({ newPath: newRelativePath }),
        ipAddress,
      }).catch(err => logger.error({ err }, 'Audit log failed'));

      return { oldPath: oldRelativePath, newPath: newRelativePath };
    } catch (error: any) {
      throw new AppError(500, 'RENAME_FAILED', `Failed to rename: ${error.message}`);
    }
  }

  /**
   * Update file permissions
   */
  async updatePermissions(homeDir: string, relativePath: string, mode: string, userId?: string, ipAddress?: string) {
    const targetPath = this.safePath(homeDir, relativePath);
    const modeNum = parseInt(mode, 8);
    if (isNaN(modeNum) || modeNum < 0 || modeNum > 0o777) {
      throw new AppError(400, 'INVALID_PERMISSIONS', 'Invalid permission mode');
    }
    try {
      await sudoFs.chmod(targetPath, mode);

      auditService.log({
        userId,
        action: 'file.chmod',
        resource: `file:${relativePath}`,
        details: JSON.stringify({ mode }),
        ipAddress,
      }).catch(err => logger.error({ err }, 'Audit log failed'));

      return { path: relativePath, mode };
    } catch (error: any) {
      throw new AppError(500, 'CHMOD_FAILED', `Failed to change permissions: ${error.message}`);
    }
  }

  /**
   * Archive files/directories into a tar.gz
   */
  async archiveItems(homeDir: string, paths: string[], archiveName: string, userId?: string, ipAddress?: string) {
    const archivePath = this.safePath(homeDir, archiveName);
    const targetPaths = paths.map(p => this.safePath(homeDir, p));

    const result = await run('tar', [
      '-czf', archivePath,
      '-C', homeDir,
      ...targetPaths.map(p => path.relative(homeDir, p)),
    ], { sudo: true, timeout: 120_000 });

    if (!result.success) {
      throw new AppError(422, 'ARCHIVE_FAILED', `Archive creation failed: ${result.stderr}`);
    }

    auditService.log({
      userId,
      action: 'file.archive',
      resource: `archive:${archiveName}`,
      details: JSON.stringify({ fileCount: paths.length }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { name: archiveName, size: (await stat(archivePath)).size };
  }

  /**
   * Extract an archive
   */
  async extractArchive(homeDir: string, archiveRelativePath: string, targetDir?: string, userId?: string, ipAddress?: string) {
    const archivePath = this.safePath(homeDir, archiveRelativePath);
    const extractDir = targetDir
      ? this.safePath(homeDir, targetDir)
      : path.dirname(archivePath);

    await sudoFs.mkdir(extractDir);

    // List archive contents first to check for path traversal (Zip Slip)
    const listResult = await run('tar', ['-tzf', archivePath], { sudo: true, timeout: 60_000 });
    const entries = listResult.stdout.trim().split('\n').filter(Boolean);

    // Verify no path traversal in archive entries
    for (const entry of entries) {
      const resolvedEntry = path.resolve(extractDir, entry);
      if (!resolvedEntry.startsWith(extractDir)) {
        throw new AppError(400, 'PATH_TRAVERSAL', 'Archive contains paths outside target directory');
      }
    }

    // Extract
    const result = await run('tar', [
      '-xzf', archivePath,
      '-C', extractDir,
    ], { sudo: true, timeout: 120_000 });

    if (!result.success) {
      throw new AppError(422, 'EXTRACT_FAILED', `Extraction failed: ${result.stderr}`);
    }

    auditService.log({
      userId,
      action: 'file.extract',
      resource: `archive:${archiveRelativePath}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: true, extractedFiles: entries };
  }

  /**
   * Get file content for text editing
   */
  async getFileContent(homeDir: string, relativePath: string): Promise<string> {
    const targetPath = this.safePath(homeDir, relativePath);
    const stats = await stat(targetPath);
    if (stats.isDirectory()) throw new AppError(400, 'IS_DIRECTORY', 'Cannot read directory as file');
    if (stats.size > 5 * 1024 * 1024) throw new AppError(422, 'FILE_TOO_LARGE', 'File too large for editing (max 5MB)');

    // Read first 8KB to check for binary content
    const buffer = Buffer.alloc(8192);
    const fd = await open(targetPath, 'r');
    const { bytesRead } = await fd.read(buffer, 0, 8192, 0);
    await fd.close();

    // Check for null bytes only in the actual bytes read (binary file indicator)
    const actualData = buffer.subarray(0, bytesRead);
    if (actualData.includes(0x00)) {
      throw new AppError(400, 'BINARY_FILE', 'Binary files cannot be edited in the text editor');
    }

    return readFile(targetPath, 'utf-8');
  }

  /**
   * Save file content from text editor
   */
  async saveFileContent(homeDir: string, relativePath: string, content: string, userId?: string, ipAddress?: string) {
    const targetPath = this.safePath(homeDir, relativePath);
    try {
      await sudoFs.writeFile(targetPath, content);

      auditService.log({
        userId,
        action: 'file.save',
        resource: `file:${relativePath}`,
        ipAddress,
      }).catch(err => logger.error({ err }, 'Audit log failed'));

      return { saved: true };
    } catch (error: any) {
      throw new AppError(500, 'SAVE_FAILED', `Failed to save file: ${error.message}`);
    }
  }

  /**
   * Copy a file or directory
   */
  async copyItem(homeDir: string, sourceRelativePath: string, targetRelativePath: string, userId?: string, ipAddress?: string) {
    const sourcePath = this.safePath(homeDir, sourceRelativePath);
    const targetPath = this.safePath(homeDir, targetRelativePath);

    try {
      // Check if source exists
      const sourceStats = await stat(sourcePath);
      
      // If target is a directory, append source name
      const targetStats = await stat(targetPath).catch(() => null);
      const finalTargetPath = targetStats?.isDirectory()
        ? path.join(targetPath, path.basename(sourcePath))
        : targetPath;

      await sudoFs.copy(sourcePath, finalTargetPath, { recursive: true });
      logger.info({ source: sourcePath, target: finalTargetPath }, 'Item copied');

      auditService.log({
        userId,
        action: 'file.copy',
        resource: `file:${sourceRelativePath}`,
        details: JSON.stringify({ targetPath: targetRelativePath }),
        ipAddress,
      }).catch(err => logger.error({ err }, 'Audit log failed'));

      return { sourcePath: sourceRelativePath, targetPath: finalTargetPath };
    } catch (error: any) {
      throw new AppError(500, 'COPY_FAILED', `Failed to copy: ${error.message}`);
    }
  }

  /**
   * Move a file or directory
   */
  async moveItem(homeDir: string, sourceRelativePath: string, targetRelativePath: string, userId?: string, ipAddress?: string) {
    const sourcePath = this.safePath(homeDir, sourceRelativePath);
    const targetPath = this.safePath(homeDir, targetRelativePath);

    try {
      // Check if source exists
      const sourceStats = await stat(sourcePath);
      
      // If target is a directory, append source name
      const targetStats = await stat(targetPath).catch(() => null);
      const finalTargetPath = targetStats?.isDirectory()
        ? path.join(targetPath, path.basename(sourcePath))
        : targetPath;

      await sudoFs.rename(sourcePath, finalTargetPath);
      logger.info({ source: sourcePath, target: finalTargetPath }, 'Item moved');

      auditService.log({
        userId,
        action: 'file.move',
        resource: `file:${sourceRelativePath}`,
        details: JSON.stringify({ targetPath: targetRelativePath }),
        ipAddress,
      }).catch(err => logger.error({ err }, 'Audit log failed'));

      return { sourcePath: sourceRelativePath, targetPath: finalTargetPath };
    } catch (error: any) {
      throw new AppError(500, 'MOVE_FAILED', `Failed to move: ${error.message}`);
    }
  }

  /**
   * Get directory size
   */
  async getDirectorySize(homeDir: string, relativePath: string): Promise<{ path: string; size: number; sizeHuman: string }> {
    const targetPath = this.safePath(homeDir, relativePath);

    // Use run() executor instead of execAsync to avoid shell injection (ISSUE-06)
    const result = await run('du', ['-sb', targetPath], { sudo: true, timeout: 60_000 });
    if (!result.success) {
      throw new AppError(422, 'DIRSIZE_FAILED', `Failed to get directory size: ${result.stderr}`);
    }

    const size = parseInt(result.stdout.trim().split('\t')[0], 10);

    const formatSize = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return { path: relativePath, size, sizeHuman: formatSize(size) };
  }

  /**
   * Get file ownership info
   */
  async getFileOwnership(homeDir: string, relativePath: string): Promise<{ path: string; uid: number; gid: number; user?: string; group?: string }> {
    const targetPath = this.safePath(homeDir, relativePath);
    const stats = await stat(targetPath);

    let user: string | undefined;
    let group: string | undefined;

    // Use run() executor instead of execAsync to avoid shell injection (ISSUE-06)
    try {
      const result = await run('getent', ['passwd', stats.uid.toString()], { sudo: true });
      if (result.success && result.stdout.trim()) {
        user = result.stdout.split(':')[0];
      }
    } catch {
      // User not found, keep undefined
    }

    try {
      const result = await run('getent', ['group', stats.gid.toString()], { sudo: true });
      if (result.success && result.stdout.trim()) {
        group = result.stdout.split(':')[0];
      }
    } catch {
      // Group not found, keep undefined
    }

    return {
      path: relativePath,
      uid: stats.uid,
      gid: stats.gid,
      user,
      group,
    };
  }

  /**
   * Get download stream for a file
   */
  getDownloadStream(homeDir: string, relativePath: string) {
    const targetPath = this.safePath(homeDir, relativePath);
    return createReadStream(targetPath);
  }

  private getFileType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const typeMap: Record<string, string> = {
      '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image', '.svg': 'image', '.webp': 'image',
      '.mp4': 'video', '.avi': 'video', '.mkv': 'video',
      '.mp3': 'audio', '.wav': 'audio', '.ogg': 'audio',
      '.pdf': 'document',
      '.doc': 'document', '.docx': 'document',
      '.xls': 'spreadsheet', '.xlsx': 'spreadsheet',
      '.zip': 'archive', '.tar': 'archive', '.gz': 'archive', '.rar': 'archive', '.7z': 'archive',
      '.php': 'code', '.js': 'code', '.ts': 'code', '.py': 'code', '.html': 'code', '.css': 'code',
      '.json': 'code', '.xml': 'code', '.yml': 'code', '.yaml': 'code',
      '.txt': 'text', '.md': 'text', '.log': 'text', '.csv': 'text',
      '.sql': 'database',
    };
    return typeMap[ext] || 'file';
  }
}
