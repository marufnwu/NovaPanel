import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/auth.middleware.js';
import { processesService } from './processes.service.js';
import {
  processConfigSchema,
  processNameParamsSchema,
  processLogsQuerySchema,
} from './processes.schema.js';

export default async function processesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // GET /processes - List all processes
  fastify.get('/processes', async (req, reply) => {
    try {
      const processes = await processesService.listProcesses();
      return { success: true, data: processes };
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message || 'Failed to list processes' });
    }
  });

  // GET /processes/:name - Get process details
  fastify.get('/processes/:name', async (req, reply) => {
    try {
      const { name } = req.params as { name: string };
      const process = await processesService.getProcess(name);
      return { success: true, data: process };
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message || 'Failed to get process' });
    }
  });

  // POST /processes/:name/start - Start a process
  fastify.post<{ Params: { name: string }; Body: { config: any } }>(
    '/processes/:name/start',
    async (req, reply) => {
      try {
        const { name } = req.params;

        // If config is provided, use it to start; otherwise just restart
        if (req.body && req.body.config) {
          const config = processConfigSchema.parse(req.body.config);
          await processesService.startProcess({ ...config, name });
        } else {
          // Try to start the process
          const manager = await import('../../services/process-manager/index.js').then(m => m.getProcessManager());
          const status = await manager.getStatus(name);
          if (status.running) {
            return { success: true }; // Already running
          }
          // Would need command to restart - return error
          return reply.status(400).send({ success: false, error: 'Process not found. Provide config to create.' });
        }

        return { success: true };
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.status(400).send({ success: false, error: 'Invalid process config', details: error.errors });
        }
        return reply.status(500).send({ success: false, error: error.message || 'Failed to start process' });
      }
    }
  );

  // POST /processes/:name/stop - Stop a process
  fastify.post('/processes/:name/stop', async (req, reply) => {
    try {
      const { name } = req.params as { name: string };
      await processesService.stopProcess(name);
      return { success: true };
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message || 'Failed to stop process' });
    }
  });

  // POST /processes/:name/restart - Restart a process
  fastify.post('/processes/:name/restart', async (req, reply) => {
    try {
      const { name } = req.params as { name: string };
      await processesService.restartProcess(name);
      return { success: true };
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message || 'Failed to restart process' });
    }
  });

  // DELETE /processes/:name - Delete a process
  fastify.delete('/processes/:name', async (req, reply) => {
    try {
      const { name } = req.params as { name: string };
      await processesService.deleteProcess(name);
      return { success: true };
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message || 'Failed to delete process' });
    }
  });

  // GET /processes/:name/logs - Get process logs
  fastify.get('/processes/:name/logs', async (req, reply) => {
    try {
      const { name } = req.params as { name: string };
      const { lines = 100 } = req.query as { lines?: number };
      const logs = await processesService.getProcessLogs(name, lines);
      return { success: true, data: { logs } };
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message || 'Failed to get process logs' });
    }
  });
}