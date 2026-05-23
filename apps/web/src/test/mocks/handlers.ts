import { http, HttpResponse } from 'msw';
import { createMockUser, createMockSite, createMockServerStats, createMockServiceStatus } from '../factories';

const mockUser = createMockUser();
const mockSite = createMockSite();
const mockStats = createMockServerStats();
const mockServices = createMockServiceStatus();

export const handlers = [
  http.get('/api/v1/auth/session', () => {
    return HttpResponse.json({
      success: true,
      data: {
        user: mockUser,
        isAuthenticated: true,
      },
    });
  }),

  http.get('/api/v1/stats/server', () => {
    return HttpResponse.json({
      success: true,
      data: mockStats,
    });
  }),

  http.get('/api/v1/stats/services', () => {
    return HttpResponse.json({
      success: true,
      data: mockServices,
    });
  }),

  http.get('/api/v1/sites', () => {
    return HttpResponse.json({
      success: true,
      data: [mockSite],
    });
  }),

  http.get('/api/v1/sites/:id', ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: { ...mockSite, id: params.id },
    });
  }),

  http.post('/api/v1/sites', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      data: { ...mockSite, ...body, id: 'new-site-id' },
    });
  }),

  http.get('/api/v1/domains', () => {
    return HttpResponse.json({
      success: true,
      data: [],
    });
  }),

  http.get('/api/v1/databases', () => {
    return HttpResponse.json({
      success: true,
      data: [],
    });
  }),

  http.get('/api/v1/backups', () => {
    return HttpResponse.json({
      success: true,
      data: [],
    });
  }),

  http.get('/api/v1/monitoring', () => {
    return HttpResponse.json({
      success: true,
      data: { stats: mockStats, services: mockServices },
    });
  }),

  http.get('/api/v1/logs', () => {
    return HttpResponse.json({
      success: true,
      data: [],
    });
  }),

  http.get('/api/v1/services', () => {
    return HttpResponse.json({
      success: true,
      data: mockServices,
    });
  }),

  http.get('/api/v1/php/status', () => {
    return HttpResponse.json({
      success: true,
      data: { installed: true, version: '8.2' },
    });
  }),

  http.get('/api/v1/webserver/status', () => {
    return HttpResponse.json({
      success: true,
      data: { installed: true, type: 'nginx' },
    });
  }),

  http.get('/api/v1/firewall/rules', () => {
    return HttpResponse.json({
      success: true,
      data: [],
    });
  }),

  http.get('/api/v1/cron/jobs', () => {
    return HttpResponse.json({
      success: true,
      data: [],
    });
  }),

  http.get('/api/v1/mail/domains', () => {
    return HttpResponse.json({
      success: true,
      data: [],
    });
  }),

  http.get('/api/v1/files', () => {
    return HttpResponse.json({
      success: true,
      data: { files: [], directories: [] },
    });
  }),

  http.get('/api/v1/containers', () => {
    return HttpResponse.json({
      success: true,
      data: [],
    });
  }),

  http.get('/api/v1/registries', () => {
    return HttpResponse.json({
      success: true,
      data: [],
    });
  }),

  http.get('/api/v1/webhooks', () => {
    return HttpResponse.json({
      success: true,
      data: [],
    });
  }),

  http.get('/api/v1/audit/logs', () => {
    return HttpResponse.json({
      success: true,
      data: [],
    });
  }),

  http.get('/api/v1/billing/invoices', () => {
    return HttpResponse.json({
      success: true,
      data: [],
    });
  }),

  http.get('/api/v1/plugins', () => {
    return HttpResponse.json({
      success: true,
      data: [],
    });
  }),

  http.get('/api/v1/security/status', () => {
    return HttpResponse.json({
      success: true,
      data: { sshKeyInstalled: true, firewallEnabled: true },
    });
  }),

  http.get('/api/v1/jobs', () => {
    return HttpResponse.json({
      success: true,
      data: [],
    });
  }),

  http.get('/api/v1/ftp/accounts', () => {
    return HttpResponse.json({
      success: true,
      data: [],
    });
  }),

  http.get('/api/v1/organizations', () => {
    return HttpResponse.json({
      success: true,
      data: [],
    });
  }),

  http.get('/api/v1/settings', () => {
    return HttpResponse.json({
      success: true,
      data: { serverName: 'NovaPanel Server', timezone: 'UTC' },
    });
  }),

  http.get('/api/v1/profile', () => {
    return HttpResponse.json({
      success: true,
      data: mockUser,
    });
  }),

  http.get('/api/v1/notifications', () => {
    return HttpResponse.json({
      success: true,
      data: [],
    });
  }),
];