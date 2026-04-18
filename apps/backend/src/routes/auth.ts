import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { v4 as uuid } from 'uuid';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { encrypt, decrypt } from '../services/crypto.service.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  REFRESH_TTL_SECONDS,
} from '../services/auth-token.service.js';
import type { UserPayload } from '@novadash/shared';

function getUser(request: FastifyRequest): UserPayload {
  return request.user as unknown as UserPayload;
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().optional(),
});

const totpVerifySchema = z.object({
  code: z.string().length(6),
});

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth/refresh',
  maxAge: REFRESH_TTL_SECONDS,
};

function toUserPayload(user: { id: string; email: string; role: string; teamId: string }): UserPayload {
  return { sub: user.id, email: user.email, role: user.role as UserPayload['role'], teamId: user.teamId };
}

async function setRefreshCookie(reply: FastifyReply, app: FastifyInstance, userId: string) {
  const token = generateRefreshToken(app, userId);
  const decoded = verifyRefreshToken(app, token);
  await redis.set(`refresh:${userId}:${decoded.tid}`, '1', 'EX', REFRESH_TTL_SECONDS);
  reply.setCookie('refreshToken', token, REFRESH_COOKIE_OPTIONS);
  return token;
}

export async function authRoutes(app: FastifyInstance) {
  // ─── Register ───
  app.post('/api/v1/auth/register', async (request, reply) => {
    const body = registerSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: body.error.issues.map((i) => i.message).join(', ') });
    }
    const { email, password, name } = body.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ ok: false, error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const isFirstUser = (await prisma.user.count()) === 0;

    let teamId: string;
    if (isFirstUser) {
      const team = await prisma.team.create({
        data: { name: `${name}'s Team`, slug: `team-${uuid().slice(0, 8)}` },
      });
      teamId = team.id;
    } else {
      const defaultTeam = await prisma.team.findFirst();
      teamId = defaultTeam!.id;
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: isFirstUser ? 'admin' : 'developer',
        teamId,
      },
    });

    const payload = toUserPayload(user);
    const accessToken = generateAccessToken(app, payload);
    await setRefreshCookie(reply, app, user.id);

    return reply.code(201).send({
      ok: true,
      data: {
        user: { id: user.id, email: user.email, role: user.role, teamId: user.teamId, totpEnabled: user.totpEnabled },
        accessToken,
      },
    });
  });

  // ─── Login ───
  app.post('/api/v1/auth/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: body.error.issues.map((i) => i.message).join(', ') });
    }
    const { email, password, totpCode } = body.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.code(401).send({ ok: false, error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return reply.code(401).send({ ok: false, error: 'Invalid credentials' });
    }

    if (user.totpEnabled) {
      if (!totpCode) {
        return reply.code(200).send({ ok: true, data: { requiresTOTP: true } });
      }
      if (!user.totpSecretEncrypted) {
        return reply.code(500).send({ ok: false, error: 'TOTP not configured properly' });
      }
      const secret = decrypt(user.totpSecretEncrypted);
      const validTOTP = authenticator.check(totpCode, secret);
      if (!validTOTP) {
        return reply.code(401).send({ ok: false, error: 'Invalid TOTP code' });
      }
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const payload = toUserPayload(user);
    const accessToken = generateAccessToken(app, payload);
    await setRefreshCookie(reply, app, user.id);

    return reply.code(200).send({
      ok: true,
      data: {
        user: { id: user.id, email: user.email, role: user.role, teamId: user.teamId, totpEnabled: user.totpEnabled },
        accessToken,
      },
    });
  });

  // ─── Refresh ───
  app.post('/api/v1/auth/refresh', async (request, reply) => {
    const token = request.cookies.refreshToken;
    if (!token) {
      return reply.code(401).send({ ok: false, error: 'No refresh token' });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(app, token);
    } catch {
      return reply.code(401).send({ ok: false, error: 'Invalid refresh token' });
    }

    const exists = await redis.get(`refresh:${decoded.sub}:${decoded.tid}`);
    if (!exists) {
      return reply.code(401).send({ ok: false, error: 'Refresh token revoked' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user) {
      return reply.code(401).send({ ok: false, error: 'User not found' });
    }

    // Rotate: delete old, create new
    await redis.del(`refresh:${decoded.sub}:${decoded.tid}`);

    const payload = toUserPayload(user);
    const accessToken = generateAccessToken(app, payload);
    await setRefreshCookie(reply, app, user.id);

    return reply.code(200).send({
      ok: true,
      data: {
        user: { id: user.id, email: user.email, role: user.role, teamId: user.teamId, totpEnabled: user.totpEnabled },
        accessToken,
      },
    });
  });

  // ─── Logout ───
  app.post('/api/v1/auth/logout', async (request, reply) => {
    const token = request.cookies.refreshToken;
    if (token) {
      try {
        const decoded = verifyRefreshToken(app, token);
        await redis.del(`refresh:${decoded.sub}:${decoded.tid}`);
      } catch {
        // token already invalid, nothing to revoke
      }
    }

    reply.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' });
    return reply.code(200).send({ ok: true });
  });

  // ─── 2FA Setup ───
  app.post('/api/v1/auth/2fa/setup', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request);

    const dbUser = await prisma.user.findUnique({ where: { id: user.sub } });
    if (!dbUser) return reply.code(404).send({ ok: false, error: 'User not found' });

    const secret = authenticator.generateSecret();
    const encryptedSecret = encrypt(secret);

    await prisma.user.update({
      where: { id: user.sub },
      data: { totpSecretEncrypted: encryptedSecret },
    });

    const otpauth = authenticator.keyuri(dbUser.email, 'NovaDash', secret);
    const qrCodeDataUri = await QRCode.toDataURL(otpauth);

    return reply.code(200).send({ ok: true, data: { secret, qrCodeDataUri } });
  });

  // ─── 2FA Verify ───
  app.post('/api/v1/auth/2fa/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request);

    const body = totpVerifySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: 'Code must be 6 digits' });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.sub } });
    if (!dbUser || !dbUser.totpSecretEncrypted) {
      return reply.code(400).send({ ok: false, error: '2FA not set up. Call /2fa/setup first.' });
    }

    const secret = decrypt(dbUser.totpSecretEncrypted);
    const valid = authenticator.check(body.data.code, secret);
    if (!valid) {
      return reply.code(401).send({ ok: false, error: 'Invalid code' });
    }

    await prisma.user.update({
      where: { id: user.sub },
      data: { totpEnabled: true },
    });

    return reply.code(200).send({ ok: true, data: { enabled: true } });
  });
}
