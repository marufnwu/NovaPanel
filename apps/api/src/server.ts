import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { logger } from './config/logger.js';
import { env } from './config/env.js';
import { AppError } from './errors.js';
import { registerRoutes } from './routes.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createServer() {
  const fastify = Fastify({
    logger: false,
    requestIdHeader: 'x-request-id',
    ignoreTrailingSlash: true,
  });

  // Security plugins
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    referrerPolicy: false,
    strictTransportSecurity: false,
    xContentTypeOptions: false,
    xDnsPrefetchControl: false,
    xDownloadOptions: false,
    xFrameOptions: false,
    xPermittedCrossDomainPolicies: false,
    xXssProtection: false,
  });

  await fastify.register(cors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-side, etc.)
      if (!origin) return callback(null, true);
      // For a self-hosted single-admin panel, allow any valid origin
      // This ensures CORS works regardless of how the panel is accessed
      // (localhost, IP address, domain name, etc.)
      try {
        new URL(origin);
        callback(null, true);
      } catch {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
  });

  await fastify.register(cookie, {
    secret: env.SESSION_SECRET,
    hook: 'onRequest',
  });

  await fastify.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024,
      files: 10,
    },
  });

  await fastify.register(websocket);

  // Swagger API documentation
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'NovaPanel API',
        description: 'Self-hosted server control panel API',
        version: '1.0.0',
      },
      servers: [
        { url: `http://localhost:${env.PORT}`, description: 'Local' },
        { url: env.PANEL_URL || `http://localhost:${env.PORT}`, description: 'Production' },
      ],
      tags: [
        { name: 'auth', description: 'Authentication' },
        { name: 'sites', description: 'Sites & Deployments' },
        { name: 'domains', description: 'Domains & SSL' },
        { name: 'databases', description: 'Databases' },
        { name: 'docker', description: 'Docker & Containers' },
        { name: 'cron', description: 'Cron Jobs' },
        { name: 'monitoring', description: 'Monitoring & Alerts' },
        { name: 'backups', description: 'Backups' },
        { name: 'settings', description: 'Server Settings' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/api/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Handle empty JSON bodies (Content-Type: application/json with Content-Length: 0)
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    const bodyStr = typeof body === 'string' ? body : body.toString();
    console.error('[JSON PARSER] Raw body:', JSON.stringify(bodyStr));
    if (!bodyStr || bodyStr.trim() === '') {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(bodyStr));
    } catch (err) {
      const error = err as Error;
      console.error('[JSON PARSER] Parse error:', error.message);
      done(error);
    }
  });

  // Auto-wrap JSON responses for API routes with consistent format
  fastify.addHook('onSend', async (request, reply, payload) => {
    if (!request.url.startsWith('/api/')) return payload;
    const contentType = reply.getHeader('content-type');
    if (typeof contentType === 'string' && contentType.includes('application/json')) {
      try {
        const body = typeof payload === 'string' ? JSON.parse(payload) : payload;
        if (body && typeof body === 'object' && !('success' in body)) {
          const wrapped = { success: true, data: body };
          return JSON.stringify(wrapped);
        }
      } catch {
        return payload;
      }
    }
    return payload;
  });

  // Global error handler
  fastify.setErrorHandler((error, req, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          field: error.field,
        },
      });
    }

    // Zod validation errors
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      });
    }

    // Fastify validation errors
    const errRecord = error as Record<string, unknown>;
    if (errRecord.validation && Array.isArray(errRecord.validation)) {
      const validationArr = errRecord.validation as Array<{ instancePath?: string }>;
      const field = validationArr[0]?.instancePath?.replace('/', '') || undefined;
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: typeof errRecord.message === 'string' ? errRecord.message : 'Validation error',
          field,
        },
      });
    }

    // Rate limit errors
    if (errRecord.statusCode === 429) {
      return reply.status(429).send({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests' },
      });
    }

    // Unexpected errors
    const err = error as Error;
    console.error('[SERVER] Unexpected error type:', err?.constructor?.name, 'message:', err?.message, 'stack:', err?.stack);
    console.error('[SERVER] Error keys:', Object.keys(error || {}));
    logger.error({ error, url: req.url, method: req.method }, 'Unhandled error');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  });

  // Register all API routes
  await registerRoutes(fastify);

  // Serve React SPA in production
  if (env.NODE_ENV === 'production') {
    const webDist = path.resolve(__dirname, '../../web/dist');
    const { default: staticPlugin } = await import('@fastify/static');
    await fastify.register(staticPlugin, {
      root: webDist,
      prefix: '/',
    });

    // SPA fallback
    fastify.setNotFoundHandler(async (req, reply) => {
      if (!req.url.startsWith('/api/') && !req.url.startsWith('/ws/') && !req.url.startsWith('/api/docs')) {
        return reply.sendFile('index.html');
      }
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
      });
    });
  }

  return fastify;
}
