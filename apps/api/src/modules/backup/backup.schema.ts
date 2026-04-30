import { z } from 'zod';

export const createBackupSchema = z.object({
  type: z.enum(['full', 'files', 'database', 'dns', 'mail', 'config']).default('full'),
  /** Enable encryption for the backup */
  encryptionEnabled: z.boolean().default(false),
  /** Password used to encrypt the backup (required if encryptionEnabled is true) */
  encryptionPassword: z.string().min(8).optional(),
  /** Encryption algorithm */
  encryptionAlgorithm: z.enum(['aes-256-cbc', 'aes-256-gcm']).default('aes-256-cbc'),
}).refine(
  (data) => !data.encryptionEnabled || data.encryptionPassword,
  { message: 'encryptionPassword is required when encryptionEnabled is true', path: ['encryptionPassword'] }
);

export const restoreBackupSchema = z.object({
  files: z.boolean().default(true),
  databases: z.boolean().default(true),
  dns: z.boolean().default(true),
  /** Password to decrypt the backup (required if backup is encrypted) */
  encryptionPassword: z.string().optional(),
});

export const createScheduleSchema = z.object({
  cronExpression: z.string().default('0 2 * * *'),
  scope: z.string().default('full'),
  retentionCount: z.number().min(1).max(90).default(7),
  storageType: z.enum(['local', 's3', 'sftp', 'b2']).default('local'),
  storageConfig: z.record(z.string()).optional(),
  /** Enable encryption for scheduled backups */
  encryptionEnabled: z.boolean().default(false),
  /** Password used to encrypt scheduled backups (required if encryptionEnabled is true) */
  encryptionPassword: z.string().min(8).optional(),
  /** Encryption algorithm */
  encryptionAlgorithm: z.enum(['aes-256-cbc', 'aes-256-gcm']).default('aes-256-cbc'),
}).refine(
  (data) => !data.encryptionEnabled || data.encryptionPassword,
  { message: 'encryptionPassword is required when encryptionEnabled is true', path: ['encryptionPassword'] }
);

export const updateStorageConfigSchema = z.object({
  type: z.enum(['local', 's3', 'sftp', 'b2']),
  s3: z.record(z.string()).optional(),
  sftp: z.record(z.string()).optional(),
});
