import type { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from './auth.service.js';
import { AppError } from '../../errors.js';
import type { User } from '../../db/schema/users.js';

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user: User;
    sessionId: string;
  }
}

export async function requireAuth(req: FastifyRequest, _reply: FastifyReply) {
  let user: User | null = null;
  let sessionId: string | null = null;

  // 1. Try session cookie
  const sessionCookie = req.cookies.sf_session;
  if (sessionCookie) {
    const result = await authService.validateSession(sessionCookie);
    if (result) {
      user = result.user;
      sessionId = result.session.id;
    }
  }

  // 2. Try Bearer token
  if (!user) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      user = await authService.validateApiToken(token);
    }
  }

  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  }

  req.user = user;
  if (sessionId) {
    req.sessionId = sessionId;
    // Update session activity timestamp (fire-and-forget)
    authService.updateSessionActivity(sessionId).catch(err =>
      req.log.error({ err }, 'Failed to update session activity')
    );
  }
}

/**
 * Require a specific role. In single-admin mode, the only role is 'admin'.
 * Kept for backward compatibility with existing route definitions.
 */
export function requireRole(..._roles: string[]) {
  return async (_req: FastifyRequest) => {
    // In single-admin mode, if the user is authenticated, they are the admin.
    // No role check needed — requireAuth already ensures authentication.
  };
}

export async function optionalAuth(req: FastifyRequest, _reply: FastifyReply) {
  try {
    await requireAuth(req, _reply);
  } catch {
    // Ignore — user is optional
  }
}
