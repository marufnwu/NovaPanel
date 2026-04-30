import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import { logger } from './config/logger.js';
import { env } from './config/env.js';
import { AppError } from './errors.js';
import { registerRoutes } from './routes.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createServer() {
  const fastify = Fastify({
    logger: false,
    requestIdHeader: 'x-request-id',
    ignoreTrailingSlash: true,
  });

  // Security plugins
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Will be configured per environment
  });

  await fastify.register(cors, {
    origin: env.NODE_ENV === 'development' ? true : env.PANEL_URL,
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
      wildcard: false,
    });

    // SPA fallback
    fastify.setNotFoundHandler(async (req, reply) => {
      if (!req.url.startsWith('/api/') && !req.url.startsWith('/ws/')) {
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
