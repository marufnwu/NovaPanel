import { z } from 'zod';

const phpVersionSchema = z.string().regex(/^\d+\.\d+$/, 'Invalid PHP version format');

export const createWebsiteSchema = z.object({
  name: z.string().min(1).max(255),
  phpVersion: phpVersionSchema.default('8.1'),
  phpHandler: z.enum(['php-fpm', 'cgi', 'disabled']).default('php-fpm'),
  webServer: z.enum(['nginx', 'apache', 'nginx+apache']).default('nginx+apache'),
});

export const updateWebsiteSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  phpVersion: phpVersionSchema.optional(),
  phpHandler: z.enum(['php-fpm', 'cgi', 'disabled']).optional(),
  webServer: z.enum(['nginx', 'apache', 'nginx+apache']).optional(),
});

export const attachDomainSchema = z.object({
  domainId: z.string().min(1),
});

export const detachDomainSchema = z.object({
  domainId: z.string().min(1),
  action: z.enum(['redirect', 'parked', 'delete']).default('parked'),
});

export type CreateWebsiteInput = z.infer<typeof createWebsiteSchema>;
export type UpdateWebsiteInput = z.infer<typeof updateWebsiteSchema>;
export type AttachDomainInput = z.infer<typeof attachDomainSchema>;
export type DetachDomainInput = z.infer<typeof detachDomainSchema>;
