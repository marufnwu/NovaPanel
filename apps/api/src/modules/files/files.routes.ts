import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { FilesService } from './files.service.js';
import { mkdirSchema, renameSchema, chmodSchema, archiveSchema, extractSchema, saveContentSchema, copySchema, moveSchema } from './files.schema.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { db } from '../../db/index.js';
import { domains } from '../../db/schema/domains.js';
import { websites } from '../../db/schema/websites.js';
import { eq } from 'drizzle-orm';
import { run } from '../../services/executor.js';
import { AppError } from '../../errors.js';

const DEFAULT_HOME_DIR = '/var/www/vhosts';

const DANGEROUS_EXTENSIONS = [
  '.php', '.php5', '.phtml', '.phar', '.phps',
  '.sh', '.bash', '.cgi', '.pl', '.py', '.rb', '.asp', '.aspx', '.jsp', '.jspx',
  '.exe', '.bat', '.cmd', '.msi', '.dll', '.so',
  '.htaccess', '.htpasswd',
  '.sql', '.db', '.sqlite',
  '.pem', '.key', '.crt', '.csr',
];

/**
 * Resolve a context (websiteId or domainId) to a home directory path.
 *
 * Priority:
 * 1. If websiteId is provided → look up website, return its documentRoot
 * 2. If domainId is provided → look up domain, return its documentRoot parent
 * 3. Otherwise → return DEFAULT_HOME_DIR
 */
async function resolveHomeDir(domainId?: string, websiteId?: string): Promise<string> {
  // Website-scoped: use the website's documentRoot directly
  if (websiteId) {
    try {
      const [website] = await db.select().from(websites).where(eq(websites.id, websiteId)).limit(1);
      if (website) {
        return website.documentRoot.replace(/\/+$/, '');
      }
    } catch {
      // Fall through to default
    }
    return `/var/www/sites/${websiteId}`;
  }

  // Domain-scoped (legacy): resolve from domain's documentRoot
  if (domainId) {
    try {
      const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
      if (domain) {
        // Use the domain's documentRoot parent as the home dir
        // e.g., documentRoot = /var/www/vhosts/example.com/httpdocs → homeDir = /var/www/vhosts/example.com
        const docRoot = domain.documentRoot;
        // Strip trailing slash and take parent if it ends with /httpdocs or similar
        const trimmed = docRoot.replace(/\/+$/, '');
        const lastSegment = trimmed.split('/').pop();
        if (lastSegment && ['httpdocs', 'public_html', 'htdocs', 'web'].includes(lastSegment)) {
          return trimmed.substring(0, trimmed.lastIndexOf('/'));
        }
        return trimmed;
      }
    } catch {
      // Fall through to default
    }

    // Fallback: use domainId as-is (legacy behavior)
    return `/var/www/vhosts/${domainId}`;
  }

  return DEFAULT_HOME_DIR;
}

export default async function fileRoutes(fastify: FastifyInstance) {
  const service = new FilesService();
  fastify.addHook('preHandler', requireAuth);

  // GET /files?path=... — list directory
  fastify.get('/files', async (req) => {
    const { path: relativePath = '/', domainId, websiteId, showHidden, sortBy, sortOrder } = req.query as {
      path?: string;
      domainId?: string;
      websiteId?: string;
      showHidden?: string;
      sortBy?: string;
      sortOrder?: string;
    };
    const homeDir = await resolveHomeDir(domainId, websiteId);
    const items = await service.listDirectory(homeDir, relativePath, {
      showHidden: showHidden === 'true',
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
    });
    return { success: true, data: { path: relativePath, items, homeDir } };
  });

  // GET /files/tree — Get directory tree structure
  fastify.get('/files/tree', async (req) => {
    const { path: relativePath = '/', showHidden, domainId, websiteId } = req.query as {
      path?: string;
      showHidden?: string;
      domainId?: string;
      websiteId?: string;
    };
    const homeDir = await resolveHomeDir(domainId, websiteId);
    const tree = await service.getDirectoryTree(homeDir, relativePath, {
      showHidden: showHidden === 'true',
    });
    return { success: true, data: tree };
  });

  // POST /files/upload — upload file (streamed, no buffering)
  fastify.post('/files/upload', async (req) => {
    const data = await req.file();
    if (!data) throw new Error('No file uploaded');

    const { path: relativePath = '/', domainId, websiteId } = req.query as { path?: string; domainId?: string; websiteId?: string };
    const homeDir = await resolveHomeDir(domainId, websiteId);

    // Block dangerous extensions
    const ext = path.extname(data.filename).toLowerCase();
    if (DANGEROUS_EXTENSIONS.includes(ext)) {
      throw new AppError(400, 'FORBIDDEN_EXTENSION', `Files with extension ${ext} cannot be uploaded`);
    }

    // Validate target directory and full target path
    const targetDir = service.safePath(homeDir, relativePath);
    const targetPath = path.join(targetDir, data.filename);
    // Ensure full target path stays within home directory
    service.safePath(homeDir, path.join(relativePath, data.filename));

    // Stream to temp file first to avoid buffering entire file in memory
    const tempFile = path.join(tmpdir(), `upload-${nanoid()}`);
    const writeStream = createWriteStream(tempFile);
    await pipeline(data.file, writeStream);

    // Move to target using sudo (handles permissions)
    await run('mv', [tempFile, targetPath], { sudo: true });

    return { success: true, data: { name: data.filename } };
  });

  // POST /files/mkdir
  fastify.post('/files/mkdir', async (req) => {
    const parsed = mkdirSchema.parse(req.body);
    const { domainId, websiteId } = req.body as { path: string; name: string; domainId?: string; websiteId?: string };
    const homeDir = await resolveHomeDir(domainId, websiteId);
    return { success: true, data: await service.createDirectory(homeDir, parsed.path, parsed.name, req.user.id, req.ip) };
  });

  // DELETE /files
  fastify.delete('/files', async (req) => {
    const { path: relativePath, domainId, websiteId } = req.query as { path: string; domainId?: string; websiteId?: string };
    if (!relativePath) throw new Error('Path is required');
    const homeDir = await resolveHomeDir(domainId, websiteId);
    await service.deleteItem(homeDir, relativePath, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // POST /files/rename
  fastify.post('/files/rename', async (req) => {
    const parsed = renameSchema.parse(req.body);
    const { domainId, websiteId } = req.body as { oldPath: string; newPath: string; domainId?: string; websiteId?: string };
    const homeDir = await resolveHomeDir(domainId, websiteId);
    return { success: true, data: await service.renameItem(homeDir, parsed.oldPath, parsed.newPath, req.user.id, req.ip) };
  });

  // PUT /files/permissions
  fastify.put('/files/permissions', async (req) => {
    const parsed = chmodSchema.parse(req.body);
    const { domainId, websiteId } = req.body as { path: string; mode: string; domainId?: string; websiteId?: string };
    const homeDir = await resolveHomeDir(domainId, websiteId);
    return { success: true, data: await service.updatePermissions(homeDir, parsed.path, parsed.mode, req.user.id, req.ip) };
  });

  // POST /files/archive
  fastify.post('/files/archive', async (req) => {
    const parsed = archiveSchema.parse(req.body);
    const { domainId, websiteId } = req.body as { paths: string[]; name: string; domainId?: string; websiteId?: string };
    const homeDir = await resolveHomeDir(domainId, websiteId);
    return { success: true, data: await service.archiveItems(homeDir, parsed.paths, parsed.name, req.user.id, req.ip) };
  });

  // POST /files/extract
  fastify.post('/files/extract', async (req) => {
    const parsed = extractSchema.parse(req.body);
    const { domainId, websiteId } = req.body as { archivePath: string; targetDir?: string; domainId?: string; websiteId?: string };
    const homeDir = await resolveHomeDir(domainId, websiteId);
    return { success: true, data: await service.extractArchive(homeDir, parsed.archivePath, parsed.targetDir, req.user.id, req.ip) };
  });

  // GET /files/content
  fastify.get('/files/content', async (req) => {
    const { path: relativePath, domainId, websiteId } = req.query as { path: string; domainId?: string; websiteId?: string };
    const homeDir = await resolveHomeDir(domainId, websiteId);
    const content = await service.getFileContent(homeDir, relativePath);
    return { success: true, data: { path: relativePath, content } };
  });

  // PUT /files/content
  fastify.put('/files/content', async (req) => {
    const parsed = saveContentSchema.parse(req.body);
    const { domainId, websiteId } = req.body as { path: string; content: string; domainId?: string; websiteId?: string };
    const homeDir = await resolveHomeDir(domainId, websiteId);
    return { success: true, data: await service.saveFileContent(homeDir, parsed.path, parsed.content, req.user.id, req.ip) };
  });

  // POST /files/copy — Copy file/folder
  fastify.post('/files/copy', async (req) => {
    const parsed = copySchema.parse(req.body);
    const { domainId, websiteId } = req.body as {
      sourcePath: string;
      targetPath: string;
      domainId?: string;
      websiteId?: string;
    };
    const homeDir = await resolveHomeDir(domainId, websiteId);
    return { success: true, data: await service.copyItem(homeDir, parsed.sourcePath, parsed.targetPath, req.user.id, req.ip) };
  });

  // POST /files/move — Move file/folder
  fastify.post('/files/move', async (req) => {
    const parsed = moveSchema.parse(req.body);
    const { domainId, websiteId } = req.body as {
      sourcePath: string;
      targetPath: string;
      domainId?: string;
      websiteId?: string;
    };
    const homeDir = await resolveHomeDir(domainId, websiteId);
    return { success: true, data: await service.moveItem(homeDir, parsed.sourcePath, parsed.targetPath, req.user.id, req.ip) };
  });

  // GET /files/size — Get directory size
  fastify.get('/files/size', async (req) => {
    const { path: relativePath = '/', domainId, websiteId } = req.query as {
      path?: string;
      domainId?: string;
      websiteId?: string;
    };
    const homeDir = await resolveHomeDir(domainId, websiteId);
    return { success: true, data: await service.getDirectorySize(homeDir, relativePath) };
  });

  // GET /files/owner — Get file ownership info
  fastify.get('/files/owner', async (req) => {
    const { path: relativePath, domainId, websiteId } = req.query as {
      path?: string;
      domainId?: string;
      websiteId?: string;
    };
    const homeDir = await resolveHomeDir(domainId, websiteId);
    return { success: true, data: await service.getFileOwnership(homeDir, relativePath || '/') };
  });

  // GET /files/download
  fastify.get('/files/download', async (req, reply: FastifyReply) => {
    const { path: relativePath, domainId, websiteId } = req.query as { path: string; domainId?: string; websiteId?: string };
    const homeDir = await resolveHomeDir(domainId, websiteId);
    const stream = service.getDownloadStream(homeDir, relativePath);
    const filename = relativePath.split('/').pop() || 'file';
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(stream);
  });
}
