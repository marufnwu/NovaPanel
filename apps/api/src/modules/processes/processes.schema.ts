import { z } from 'zod';

export const processStatusSchema = z.enum(['online', 'stopped', 'errored', 'launching']);

export const processStatusResponseSchema = z.object({
  running: z.boolean(),
  pid: z.number().optional(),
  uptime: z.number().optional(),
  memoryMb: z.number().optional(),
  cpuPercent: z.number().optional(),
  restartCount: z.number(),
  status: processStatusSchema,
});

export const processInfoSchema = z.object({
  name: z.string(),
  status: processStatusResponseSchema,
});

export const listProcessesResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(processInfoSchema),
});

export const getProcessResponseSchema = z.object({
  success: z.literal(true),
  data: processInfoSchema.nullable(),
});

export const processConfigSchema = z.object({
  name: z.string().min(1).max(255),
  command: z.string().min(1).max(10000),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
  replicas: z.number().optional(),
  healthCheckPath: z.string().optional(),
  logFile: z.string().optional(),
  errorFile: z.string().optional(),
});

export const startProcessSchema = z.object({
  config: processConfigSchema,
});

export const processActionResponseSchema = z.object({
  success: z.literal(true),
});

export const processLogsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    logs: z.string(),
  }),
});

export const processNameParamsSchema = z.object({
  name: z.string().min(1),
});

export const processLogsQuerySchema = z.object({
  lines: z.coerce.number().min(1).max(10000).default(100),
});