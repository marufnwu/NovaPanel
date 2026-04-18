import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { config } from '../config.js';
import type { UserPayload, RefreshTokenPayload } from '@novadash/shared';

const ACCESS_TTL = '15m';
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export function generateAccessToken(app: FastifyInstance, payload: UserPayload): string {
  return app.jwt.sign(payload, { expiresIn: ACCESS_TTL });
}

export function generateRefreshToken(_app: FastifyInstance, userId: string): string {
  const tid = uuid();
  const payload: RefreshTokenPayload = { sub: userId, tid, type: 'refresh' };
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL_SECONDS });
}

export function verifyRefreshToken(_app: FastifyInstance, token: string): RefreshTokenPayload {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

export { REFRESH_TTL_SECONDS };
