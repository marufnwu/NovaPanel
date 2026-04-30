import type { FastifyInstance } from 'fastify';
import { StatsService } from './stats.service.js';
import { requireAuth } from '../auth/auth.middleware.js';

export default async function statsRoutes(fastify: FastifyInstance) {
  const statsService = new StatsService();

  // GET /api/v1/stats/server
  fastify.get('/server', {
    preHandler: [requireAuth],
    handler: async () => {
      const stats = await statsService.getServerStats();
      return { success: true, data: stats };
    },
  });

  // GET /api/v1/stats/services
  fastify.get('/services', {
    preHandler: [requireAuth],
    handler: async () => {
      const statuses = await statsService.getServiceStatuses();
      return { success: true, data: statuses };
    },
  });

  // POST /api/v1/stats/services/:name/restart
  fastify.post('/services/:name/restart', {
    preHandler: [requireAuth],
    handler: async (req) => {
      const { name } = req.params as { name: string };
      const result = await statsService.restartService(name, req.user.id);
      return { success: true, data: result };
    },
  });

  // GET /api/v1/stats/summary
  fastify.get('/summary', {
    preHandler: [requireAuth],
    handler: async () => {
      const summary = await statsService.getDashboardSummary();
      return { success: true, data: summary };
    },
  });

  // GET /api/v1/stats/network
  fastify.get('/network', {
    preHandler: [requireAuth],
    handler: async () => {
      const stats = await statsService.getNetworkStats();
      return { success: true, data: stats };
    },
  });

  // GET /api/v1/stats/disk
  fastify.get('/disk', {
    preHandler: [requireAuth],
    handler: async () => {
      const disks = await statsService.getDiskDetails();
      return { success: true, data: disks };
    },
  });

  // GET /api/v1/stats/expiring-ssl
  fastify.get('/expiring-ssl', {
    preHandler: [requireAuth],
    handler: async () => {
      const certs = await statsService.getExpiringSslCerts(30);
      return { success: true, data: certs };
    },
  });

  // GET /api/v1/stats/domains/:id
  fastify.get('/domains/:id', {
    preHandler: [requireAuth],
    handler: async (req) => {
      const { id } = req.params as { id: string };
      const stats = await statsService.getDomainStats(id);
      return { success: true, data: stats };
    },
  });

  // GET /api/v1/stats/processes
  fastify.get('/processes', {
    preHandler: [requireAuth],
    handler: async (req) => {
      const sortBy = (req.query as any).sortBy === 'memory' ? 'memory' : 'cpu';
      const limit = parseInt((req.query as any).limit) || 10;
      const processes = await statsService.getProcessList(sortBy, limit);
      return { success: true, data: processes };
    },
  });

  // GET /api/v1/stats/tcp-connections
  fastify.get('/tcp-connections', {
    preHandler: [requireAuth],
    handler: async () => {
      try {
        const data = await statsService.getTcpConnections();
        return { success: true, data };
      } catch (error: any) {
        return { success: true, data: { established: 0, timeWait: 0, closeWait: 0, total: 0 } };
      }
    },
  });

  // GET /api/v1/stats/fd
  fastify.get('/fd', {
    preHandler: [requireAuth],
    handler: async () => {
      try {
        const data = await statsService.getFdStats();
        return { success: true, data };
      } catch (error: any) {
        return { success: true, data: { openFd: 0, maxFd: 65536, usagePercent: 0 } };
      }
    },
  });

  // GET /api/v1/stats/disk-io
  fastify.get('/disk-io', {
    preHandler: [requireAuth],
    handler: async () => {
      try {
        const data = await statsService.getDiskIOStats();
        return { success: true, data };
      } catch (error: any) {
        return { success: true, data: { readBytesSec: 0, writeBytesSec: 0, readOpsSec: 0, writeOpsSec: 0 } };
      }
    },
  });

  // GET /api/v1/stats/domain-bandwidth
  fastify.get('/domain-bandwidth', {
    preHandler: [requireAuth],
    handler: async () => {
      try {
        const data = await statsService.getDomainBandwidth();
        return { success: true, data };
      } catch (error: any) {
        return { success: true, data: [] };
      }
    },
  });
}
