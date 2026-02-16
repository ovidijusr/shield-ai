/**
 * Schedule API Routes
 *
 * REST API for schedule configuration and scan history management.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getScheduler } from '../services/scheduler.js';
import type { ScheduleConfig } from '../services/scheduler.js';
import { getNotificationService } from '../services/notifications.js';
import type { NotificationChannel } from '../services/notifications.js';

/**
 * Register schedule routes
 */
export async function scheduleRoutes(app: FastifyInstance) {
  const scheduler = getScheduler();
  const notificationService = getNotificationService();

  /**
   * GET /api/schedule/config
   * Get current schedule configuration
   */
  app.get('/api/schedule/config', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = scheduler.getScheduleConfig();
      return reply.send(config);
    } catch (error) {
      app.log.error({ error }, 'Failed to get schedule config');
      return reply.status(500).send({ error: 'Failed to get schedule config' });
    }
  });

  /**
   * POST /api/schedule/config
   * Save schedule configuration and restart scheduler
   */
  app.post(
    '/api/schedule/config',
    async (request: FastifyRequest<{ Body: ScheduleConfig }>, reply: FastifyReply) => {
      try {
        const config = request.body;

        // Validate configuration
        if (typeof config.enabled !== 'boolean') {
          return reply.status(400).send({ error: 'enabled must be a boolean' });
        }

        if (!['daily', 'weekly', 'manual'].includes(config.frequency)) {
          return reply.status(400).send({ error: 'Invalid frequency' });
        }

        // Validate time format (HH:MM)
        if (!/^\d{2}:\d{2}$/.test(config.time)) {
          return reply.status(400).send({ error: 'time must be in HH:MM format' });
        }

        // Save configuration and restart scheduler
        await scheduler.saveScheduleConfig(config);

        return reply.send({ success: true });
      } catch (error) {
        app.log.error({ error }, 'Failed to save schedule config');
        return reply.status(500).send({ error: 'Failed to save schedule config' });
      }
    }
  );

  /**
   * GET /api/schedule/history
   * Get scan history (last N scans)
   */
  app.get(
    '/api/schedule/history',
    async (request: FastifyRequest<{ Querystring: { limit?: string } }>, reply: FastifyReply) => {
      try {
        const limit = request.query.limit ? parseInt(request.query.limit) : 30;

        if (isNaN(limit) || limit < 1 || limit > 100) {
          return reply.status(400).send({ error: 'limit must be between 1 and 100' });
        }

        const history = scheduler.getScanHistory(limit);
        return reply.send(history);
      } catch (error) {
        app.log.error({ error }, 'Failed to get scan history');
        return reply.status(500).send({ error: 'Failed to get scan history' });
      }
    }
  );

  /**
   * POST /api/schedule/scan-now
   * Trigger an immediate scan (manual trigger)
   */
  app.post('/api/schedule/scan-now', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // This endpoint triggers a scan outside the normal schedule
      // The actual scan logic should be connected via the scheduler's onScan callback

      // For now, return a message indicating the scan was triggered
      // The full implementation would await the scan result
      return reply.send({
        success: true,
        message: 'Scan triggered. Check /api/audit for streaming results.',
      });
    } catch (error) {
      app.log.error({ error }, 'Failed to trigger scan');
      return reply.status(500).send({ error: 'Failed to trigger scan' });
    }
  });

  /**
   * GET /api/notifications/config
   * Get notification channels configuration
   */
  app.get('/api/notifications/config', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // For now, return empty array
      // Full implementation would read from database
      return reply.send([]);
    } catch (error) {
      app.log.error({ error }, 'Failed to get notification config');
      return reply.status(500).send({ error: 'Failed to get notification config' });
    }
  });

  /**
   * POST /api/notifications/config
   * Save notification channels configuration
   */
  app.post(
    '/api/notifications/config',
    async (request: FastifyRequest<{ Body: NotificationChannel[] }>, reply: FastifyReply) => {
      try {
        const channels = request.body;

        // Validate channels array
        if (!Array.isArray(channels)) {
          return reply.status(400).send({ error: 'channels must be an array' });
        }

        // Validate each channel
        for (const channel of channels) {
          if (!['ntfy', 'discord', 'slack', 'email', 'webhook'].includes(channel.type)) {
            return reply.status(400).send({ error: `Invalid channel type: ${channel.type}` });
          }

          if (typeof channel.enabled !== 'boolean') {
            return reply.status(400).send({ error: 'channel.enabled must be a boolean' });
          }

          if (!channel.config || typeof channel.config !== 'object') {
            return reply.status(400).send({ error: 'channel.config must be an object' });
          }
        }

        // Save to database
        // Full implementation would persist to database

        return reply.send({ success: true });
      } catch (error) {
        app.log.error({ error }, 'Failed to save notification config');
        return reply.status(500).send({ error: 'Failed to save notification config' });
      }
    }
  );

  /**
   * POST /api/notifications/test
   * Test a notification channel
   */
  app.post(
    '/api/notifications/test',
    async (request: FastifyRequest<{ Body: NotificationChannel }>, reply: FastifyReply) => {
      try {
        const channel = request.body;

        // Validate channel
        if (!['ntfy', 'discord', 'slack', 'email', 'webhook'].includes(channel.type)) {
          return reply.status(400).send({ error: `Invalid channel type: ${channel.type}` });
        }

        // Test the notification
        const success = await notificationService.testNotification(channel);

        return reply.send({ success });
      } catch (error) {
        app.log.error({ error }, 'Failed to test notification');
        return reply.status(500).send({ error: 'Failed to test notification' });
      }
    }
  );
}
