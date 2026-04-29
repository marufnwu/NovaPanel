import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authService } from './auth.service.js';
import { requireAuth } from './auth.middleware.js';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().default(false),
});

const verify2faSchema = z.object({
  tempToken: z.string().min(1, 'Temp token is required'),
  code: z.string().min(1, '2FA code is required'),
  rememberMe: z.boolean().default(false),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const changeEmailSchema = z.object({
  newEmail: z.string().email(),
  password: z.string().min(1),
});

const updateProfileSchema = z.object({
  displayName: z.string().optional(),
});

const generateApiTokenSchema = z.object({
  name: z.string().min(1),
  expiresAt: z.string().optional(),
});

const disable2faSchema = z.object({
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

const verifyResetTokenSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
});

const regenerateBackupCodesSchema = z.object({
  password: z.string().min(1, 'Current password is required'),
});

export { loginSchema, generateApiTokenSchema };

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /api/v1/auth/login
  fastify.post('/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const { username, password, rememberMe } = loginSchema.parse(req.body);
      const result = await authService.login(username, password, rememberMe, req.ip);

      if ('requiresTwoFactor' in result) {
        return reply.send({
          success: true,
          data: { requiresTwoFactor: true, tempToken: result.tempToken },
        });
      }

      // Set session cookie
      const isRemember = rememberMe || false;
      reply.setCookie('sf_session', result.sessionId, {
        httpOnly: true,
        secure: req.protocol === 'https',
        sameSite: 'lax',
        path: '/',
        maxAge: isRemember ? 30 * 24 * 60 * 60 : 2 * 60 * 60, // 30 days or 2 hours
      });

      return reply.send({ success: true, data: result });
    },
  });

  // POST /api/v1/auth/verify-2fa
  fastify.post('/verify-2fa', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const { tempToken, code, rememberMe } = verify2faSchema.parse(req.body);
      const result = await authService.verify2FA(tempToken, code, rememberMe, req.ip);

      // Set session cookie
      const isRemember = rememberMe || false;
      reply.setCookie('sf_session', result.sessionId, {
        httpOnly: true,
        secure: req.protocol === 'https',
        sameSite: 'lax',
        path: '/',
        maxAge: isRemember ? 30 * 24 * 60 * 60 : 2 * 60 * 60,
      });

      return reply.send({ success: true, data: result });
    },
  });

  // POST /api/v1/auth/logout
  fastify.post('/logout', {
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      const sessionId = req.cookies.sf_session;
      if (sessionId) await authService.logout(sessionId, req.user.id, req.ip);
      reply.clearCookie('sf_session', { path: '/' });
      return reply.send({ success: true, data: null });
    },
  });

  // GET /api/v1/auth/me
  fastify.get('/me', {
    preHandler: [requireAuth],
    handler: async (req) => {
      const user = await authService.getMe(req.user.id);
      return { success: true, data: user };
    },
  });

  // --- 2FA Endpoints ---

  // POST /api/v1/auth/2fa/enable
  fastify.post('/2fa/enable', {
    preHandler: [requireAuth],
    handler: async (req) => {
      const result = await authService.enable2FA(req.user.id);
      return { success: true, data: result };
    },
  });

  // POST /api/v1/auth/2fa/verify
  fastify.post('/2fa/verify', {
    preHandler: [requireAuth],
    handler: async (req) => {
      const { code } = z.object({ code: z.string().min(1) }).parse(req.body);
      const { secret } = req.body as { secret: string };
      const result = await authService.verifyAndEnable2FA(req.user.id, secret, code, req.ip);
      return { success: true, data: result };
    },
  });

  // POST /api/v1/auth/2fa/disable
  fastify.post('/2fa/disable', {
    preHandler: [requireAuth],
    handler: async (req) => {
      const { password } = disable2faSchema.parse(req.body);
      const result = await authService.disable2FA(req.user.id, password, req.ip);
      return { success: true, data: result };
    },
  });

  // GET /api/v1/auth/backup-codes
  fastify.get('/backup-codes', {
    preHandler: [requireAuth],
    handler: async (req) => {
      const codes = await authService.getBackupCodes(req.user.id);
      return { success: true, data: codes };
    },
  });

  // POST /api/v1/auth/regenerate-backup-codes
  fastify.post('/regenerate-backup-codes', {
    preHandler: [requireAuth],
    handler: async (req) => {
      const { password } = regenerateBackupCodesSchema.parse(req.body);
      const backupCodes = await authService.regenerateBackupCodes(req.user.id, password, req.ip);
      return { success: true, data: { backupCodes } };
    },
  });

  // --- Profile Endpoints ---

  // PUT /api/v1/auth/password
  fastify.put('/password', {
    preHandler: [requireAuth],
    handler: async (req) => {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      const result = await authService.changePassword(req.user.id, currentPassword, newPassword, req.ip);
      return { success: true, data: result };
    },
  });

  // PUT /api/v1/auth/email
  fastify.put('/email', {
    preHandler: [requireAuth],
    handler: async (req) => {
      const { newEmail, password } = changeEmailSchema.parse(req.body);
      const result = await authService.changeEmail(req.user.id, newEmail, password);
      return { success: true, data: result };
    },
  });

  // PUT /api/v1/auth/profile
  fastify.put('/profile', {
    preHandler: [requireAuth],
    handler: async (req) => {
      const data = updateProfileSchema.parse(req.body);
      const result = await authService.updateProfile(req.user.id, data);
      return { success: true, data: result };
    },
  });

  // --- Session Endpoints ---

  // GET /api/v1/auth/sessions
  fastify.get('/sessions', {
    preHandler: [requireAuth],
    handler: async (req) => {
      const sessions = await authService.listSessions(req.user.id);
      return { success: true, data: sessions };
    },
  });

  // DELETE /api/v1/auth/sessions/:id
  fastify.delete('/sessions/:id', {
    preHandler: [requireAuth],
    handler: async (req) => {
      const { id } = req.params as { id: string };
      const result = await authService.revokeSession(req.user.id, id, req.ip);
      return { success: true, data: result };
    },
  });

  // DELETE /api/v1/auth/sessions
  fastify.delete('/sessions', {
    preHandler: [requireAuth],
    handler: async (req) => {
      const currentSessionId = req.cookies.sf_session;
      const result = await authService.revokeAllOtherSessions(req.user.id, currentSessionId || '');
      return { success: true, data: result };
    },
  });

  // --- Password Reset ---

  // POST /api/v1/auth/forgot-password
  fastify.post('/forgot-password', {
    config: { rateLimit: { max: 3, timeWindow: '15 minutes' } },
    handler: async (req) => {
      const { email } = forgotPasswordSchema.parse(req.body);
      const result = await authService.forgotPassword(email, req.ip);
      return { success: true, data: result };
    },
  });

  // POST /api/v1/auth/verify-reset-token
  fastify.post('/verify-reset-token', {
    handler: async (req) => {
      const { token } = verifyResetTokenSchema.parse(req.body);
      const result = await authService.verifyResetToken(token);
      return { success: true, data: result };
    },
  });

  // POST /api/v1/auth/reset-password
  fastify.post('/reset-password', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    handler: async (req) => {
      const { token, newPassword } = resetPasswordSchema.parse(req.body);
      const result = await authService.resetPassword(token, newPassword, req.ip);
      return { success: true, data: result };
    },
  });

  // --- API Token ---

  // POST /api/v1/auth/token
  fastify.post('/token', {
    preHandler: [requireAuth],
    handler: async (req) => {
      const { name, expiresAt } = generateApiTokenSchema.parse(req.body);
      const result = await authService.generateApiToken(
        req.user.id,
        name,
        expiresAt ? new Date(expiresAt) : undefined,
        req.ip,
      );
      return { success: true, data: result };
    },
  });
}
