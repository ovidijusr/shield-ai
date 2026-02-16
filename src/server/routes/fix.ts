/**
 * Fix Routes
 *
 * Provides endpoints to preview and apply security fixes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { previewFix, applyFix } from '../services/fix-engine.js';
import type { Finding, DiffPreview, FixResult } from '@shared/types.js';

/**
 * Request body for fix operations
 */
interface FixRequestBody {
  findingId: string;
}

/**
 * Type guard for fix request body
 */
function isFixRequestBody(body: unknown): body is FixRequestBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'findingId' in body &&
    typeof (body as FixRequestBody).findingId === 'string'
  );
}

/**
 * In-memory cache of findings from the last audit
 * In production, this should be stored in a database or Redis
 */
const findingsCache = new Map<string, Finding>();

/**
 * Helper to get finding by ID from cache or re-run audit
 */
async function getFindingById(findingId: string): Promise<Finding | null> {
  // Check cache first
  if (findingsCache.has(findingId)) {
    return findingsCache.get(findingId) || null;
  }

  // If not in cache, the finding might be from an old audit
  // In a production system, you'd query a database here
  return null;
}

/**
 * Helper to update findings cache (called after audit)
 * This would be called from the audit route in production
 */
export function updateFindingsCache(findings: Finding[]): void {
  findingsCache.clear();
  for (const finding of findings) {
    findingsCache.set(finding.id, finding);
  }
}

/**
 * Register fix routes
 */
export async function fixRoutes(app: FastifyInstance) {
  /**
   * POST /api/fix/preview
   * Preview a fix before applying it
   * Body: { findingId: string }
   */
  app.post(
    '/api/fix/preview',
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<DiffPreview | void> => {
      try {
        // Validate request body
        if (!isFixRequestBody(request.body)) {
          return reply.code(400).send({
            error: 'Invalid request body',
            details: 'Request body must include findingId',
            statusCode: 400,
          });
        }

        const { findingId } = request.body;

        // Get finding
        const finding = await getFindingById(findingId);
        if (!finding) {
          return reply.code(404).send({
            error: 'Finding not found',
            details: `No finding found with ID: ${findingId}`,
            statusCode: 404,
          });
        }

        // Generate preview
        try {
          const preview = await previewFix(finding);
          return reply.send(preview);
        } catch (error) {
          app.log.error({ error, findingId }, 'Failed to generate fix preview');
          return reply.code(500).send({
            error: 'Failed to generate fix preview',
            details: error instanceof Error ? error.message : String(error),
            statusCode: 500,
          });
        }
      } catch (error) {
        app.log.error({ error }, 'Unexpected error in fix preview endpoint');
        return reply.code(500).send({
          error: 'Internal server error',
          details: error instanceof Error ? error.message : String(error),
          statusCode: 500,
        });
      }
    }
  );

  /**
   * POST /api/fix/apply
   * Apply a fix
   * Body: { findingId: string }
   */
  app.post(
    '/api/fix/apply',
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<FixResult | void> => {
      try {
        // Validate request body
        if (!isFixRequestBody(request.body)) {
          return reply.code(400).send({
            error: 'Invalid request body',
            details: 'Request body must include findingId',
            statusCode: 400,
          });
        }

        const { findingId } = request.body;

        // Get finding
        const finding = await getFindingById(findingId);
        if (!finding) {
          return reply.code(404).send({
            error: 'Finding not found',
            details: `No finding found with ID: ${findingId}`,
            statusCode: 404,
          });
        }

        // Apply fix
        try {
          const result = await applyFix(finding);
          return reply.send(result);
        } catch (error) {
          app.log.error({ error, findingId }, 'Failed to apply fix');
          return reply.code(500).send({
            error: 'Failed to apply fix',
            details: error instanceof Error ? error.message : String(error),
            statusCode: 500,
          });
        }
      } catch (error) {
        app.log.error({ error }, 'Unexpected error in fix apply endpoint');
        return reply.code(500).send({
          error: 'Internal server error',
          details: error instanceof Error ? error.message : String(error),
          statusCode: 500,
        });
      }
    }
  );

  /**
   * GET /api/findings
   * Get all findings from the last audit
   */
  app.get(
    '/api/findings',
    async (
      _request: FastifyRequest,
      reply: FastifyReply
    ): Promise<Finding[]> => {
      try {
        // Return all findings from cache
        const findings = Array.from(findingsCache.values());
        return reply.send(findings);
      } catch (error) {
        app.log.error({ error }, 'Failed to get findings');
        return reply.code(500).send({
          error: 'Failed to get findings',
          details: error instanceof Error ? error.message : String(error),
          statusCode: 500,
        });
      }
    }
  );
}
