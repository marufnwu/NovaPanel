import { z } from 'zod';

export const mkdirSchema = z.object({ path: z.string(), name: z.string(), websiteId: z.string().optional(), domainId: z.string().optional() });
export const renameSchema = z.object({ oldPath: z.string(), newPath: z.string(), websiteId: z.string().optional(), domainId: z.string().optional() });
export const chmodSchema = z.object({ path: z.string(), mode: z.string(), websiteId: z.string().optional(), domainId: z.string().optional() });
export const archiveSchema = z.object({ paths: z.array(z.string()), name: z.string(), websiteId: z.string().optional(), domainId: z.string().optional() });
export const extractSchema = z.object({ archivePath: z.string(), targetDir: z.string().optional(), websiteId: z.string().optional(), domainId: z.string().optional() });
export const saveContentSchema = z.object({ path: z.string(), content: z.string(), websiteId: z.string().optional(), domainId: z.string().optional() });
export const copySchema = z.object({ sourcePath: z.string(), targetPath: z.string(), websiteId: z.string().optional(), domainId: z.string().optional() });
export const moveSchema = z.object({ sourcePath: z.string(), targetPath: z.string(), websiteId: z.string().optional(), domainId: z.string().optional() });
