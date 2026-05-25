import type { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from './auth.service.js';
import { tokensService } from '../tokens/tokens.service.js';
import { AppError } from '../../errors.js';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import type { User } from '../../db/schema/users.js';

// Extend FastifyRequest to include user and token auth metadata
declare module 'fastify' {
  interface FastifyRequest {
    user: User;
    sessionId: string;
    authMethod?: 'session' | 'token';
    tokenPermissions?: string[];
    orgId?: string;
  }
}

export async function requireAuth(req: FastifyRequest, _reply: FastifyReply) {
  let user: User | null = null;
  let sessionId: string | null = null;
  let authMethod: 'session' | 'token' | undefined;
  let tokenPermissions: string[] | undefined;

  // 1. Try session cookie
  const sessionCookie = req.cookies.sf_session;
  if (sessionCookie) {
    const result = await authService.validateSession(sessionCookie);
    if (result) {
      user = result.user;
      sessionId = result.session.id;
      authMethod = 'session';
    }
  }

  // 2. Try Bearer token
  if (!user) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);

      // 2a. Try the new token system first (dynamic API tokens stored in api_keys table)
      const tokenResult = await tokensService.validateToken(token);
      if (tokenResult && tokenResult.valid && tokenResult.user && tokenResult.token) {
        // Fetch the full user record so downstream code gets a complete User object.
        const [fullUser] = await db.select().from(users).where(eq(users.id, tokenResult.user.id)).limit(1);
        if (fullUser && fullUser.isActive) {
          user = fullUser;
          authMethod = 'token';
          tokenPermissions = JSON.parse(tokenResult.token.permissions || '[]');
        }
      }

      // 2b. Fall back to the legacy single-token check (users.apiTokenHash) for backward compat
      if (!user) {
        user = await authService.validateApiKey(token);
        if (user) {
          authMethod = 'token';
          tokenPermissions = undefined;
        }
      }
    }
  }

  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  }

  req.user = user;
  req.authMethod = authMethod;
  req.tokenPermissions = tokenPermissions;

  req.orgId = (req.headers['x-organization-id'] as string) || undefined;

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
