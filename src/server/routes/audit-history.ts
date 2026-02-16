/**
 * Audit History Routes
 *
 * API endpoints for managing audit history and retrieval.
 */

import type { FastifyInstance } from 'fastify';
import {
  listAuditSummaries,
  getAudit,
  deleteAudit,
  getAuditStats,
  saveAudit,
  type AuditRecord,
} from '../services/database.js';

export async function auditHistoryRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/audits - List all audit summaries
   */
  fastify.get('/api/audits', async (request) => {
    const { limit = 50, offset = 0 } = request.query as any;
    const summaries = listAuditSummaries(Number(limit), Number(offset));
    return summaries;
  });

  /**
   * GET /api/audits/stats - Get audit statistics
   */
  fastify.get('/api/audits/stats', async () => {
    const stats = getAuditStats();
    return stats;
  });

  /**
   * GET /api/audits/:id - Get specific audit by ID
   */
  fastify.get<{ Params: { id: string } }>('/api/audits/:id', async (request, reply) => {
    const { id } = request.params;
    const audit = getAudit(id);

    if (!audit) {
      return reply.status(404).send({ error: 'Audit not found' });
    }

    return audit;
  });

  /**
   * POST /api/audits - Save new audit result
   */
  fastify.post<{ Body: AuditRecord }>('/api/audits', async (request, reply) => {
    const audit = request.body;

    try {
      saveAudit(audit);
      return { success: true, id: audit.id };
    } catch (err) {
      request.log.error({ err }, 'Failed to save audit');
      return reply.status(500).send({ error: 'Failed to save audit' });
    }
  });

  /**
   * DELETE /api/audits/:id - Delete audit by ID
   */
  fastify.delete<{ Params: { id: string } }>('/api/audits/:id', async (request, reply) => {
    const { id } = request.params;
    const success = deleteAudit(id);

    if (!success) {
      return reply.status(404).send({ error: 'Audit not found' });
    }

    return { success: true };
  });
}
