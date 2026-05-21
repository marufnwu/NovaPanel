export * from './sites.js';
export * from './domains.js';
export * from './auth.js';

export const permissions = [
  'sites:read', 'sites:write', 'sites:delete',
  'domains:read', 'domains:write', 'domains:delete',
  'databases:read', 'databases:write', 'databases:delete',
  'containers:read', 'containers:write', 'containers:delete',
  'files:read', 'files:write', 'files:delete',
  'settings:read', 'settings:write',
  'billing:read', 'billing:write',
  'members:read', 'members:write',
] as const;