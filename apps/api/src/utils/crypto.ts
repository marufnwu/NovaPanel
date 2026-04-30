import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Hash a password using Argon2id
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

/**
 * Verify a password against an Argon2id hash
 */
export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}

/**
 * Generate a SHA-256 hash of a string
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Hash a token for storage (SHA-256)
 */
export function hashToken(token: string): string {
  return sha256(token);
}

/**
 * Generate a random token (hex)
 */
export function generateToken(prefix?: string): string {
  const bytes = randomBytes(32).toString('hex');
  return prefix ? `${prefix}${bytes}` : bytes;
}

/**
 * Generate an API token with prefix
 */
export function generateApiToken(): string {
  return `sf_${randomBytes(32).toString('hex')}`;
}

/**
 * Encrypt a string using AES-256-GCM
 */
export function encrypt(plaintext: string): string {
  const key = Buffer.from(env.SF_ENCRYPTION_KEY, 'hex');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt a string using AES-256-GCM
 */
export function decrypt(ciphertext: string): string {
  const key = Buffer.from(env.SF_ENCRYPTION_KEY, 'hex');
  const parts = ciphertext.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
