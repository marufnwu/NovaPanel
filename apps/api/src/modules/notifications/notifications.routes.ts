import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/auth.middleware.js';
import { notificationsService } from './notifications.service.js';

export default async function notificationsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // GET /notifications/preferences
  fastify.get('/notifications/preferences', async (req) => {
    const prefs = await notificationsService.getPreferences(req.user.id);
    return { success: true, data: prefs };
  });

  // PUT /notifications/preferences
  fastify.put('/notifications/preferences', async (req) => {
    const data = req.body as any;
    const prefs = await notificationsService.updatePreferences(req.user.id, data);
    return { success: true, data: prefs };
  });

  // GET /notifications
  fastify.get('/notifications', async (req, reply) => {
    try {
      const { limit = 50, offset = 0 } = req.query as any;
      const result = await notificationsService.listNotifications(req.user.id, Number(limit), Number(offset));
      return { success: true, data: result };
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message || 'Failed to list notifications' });
    }
  });

  // GET /notifications/unread-count
  fastify.get('/notifications/unread-count', async (req, reply) => {
    try {
      const count = await notificationsService.getUnreadCount(req.user.id);
      return { success: true, data: { count } };
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message || 'Failed to get unread count' });
    }
  });

  // POST /notifications/:id/read
  fastify.post('/notifications/:id/read', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      await notificationsService.markAsRead(id, req.user.id);
      return { success: true };
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message || 'Failed to mark as read' });
    }
  });

  // POST /notifications/read-all
  fastify.post('/notifications/read-all', async (req, reply) => {
    try {
      await notificationsService.markAllAsRead(req.user.id);
      return { success: true };
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message || 'Failed to mark all as read' });
    }
  });

  // DELETE /notifications/:id
  fastify.delete('/notifications/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      await notificationsService.deleteNotification(id, req.user.id);
      return { success: true };
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message || 'Failed to delete notification' });
    }
  });
}

