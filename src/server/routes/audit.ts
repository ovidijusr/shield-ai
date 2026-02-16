/**
 * Audit Routes
 *
 * Provides SSE endpoint for streaming security audit results
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { collectInfraContext } from '../services/collector.js';
import { runQuickChecks } from '../services/quick-checks.js';
import { runOpusAudit } from '../services/opus-audit.js';
import { updateFindingsCache } from './fix.js';
import { updateAuditResultCache } from './chat.js';
import { getScoreHistoryService } from '../services/score-history.js';
import { getAchievementsService } from '../services/achievements.js';
import type { Finding, GoodPractice, AuditResult } from '@shared/types.js';

/**
 * SSE event types for audit streaming
 */
type AuditEventType = 'finding' | 'good-practice' | 'complete' | 'error';

interface AuditEvent {
  type: AuditEventType;
  data?: Finding | GoodPractice | AuditResult;
  error?: string;
}

/**
 * Register audit routes
 */
export async function auditRoutes(app: FastifyInstance) {
  /**
   * POST /api/audit
   * SSE endpoint for streaming audit results
   *
   * Flow:
   * 1. Collect infrastructure context
   * 2. Run quick checks (instant)
   * 3. Stream quick findings via SSE
   * 4. Start Opus audit (streaming)
   * 5. Stream Opus findings as they arrive
   * 6. Send final summary with security score
   */
  app.post(
    '/api/audit',
    async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        // Set up SSE headers
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

        // Helper to send SSE event
        const sendEvent = (event: AuditEvent) => {
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
        };

        // Step 1: Collect infrastructure context
        let context;
        try {
          context = await collectInfraContext();
        } catch (error) {
          sendEvent({
            type: 'error',
            error: `Failed to collect infrastructure: ${error instanceof Error ? error.message : String(error)}`,
          });
          reply.raw.write('data: [DONE]\n\n');
          reply.raw.end();
          return;
        }

        // Step 2: Run quick checks (now async due to firewall check)
        const quickFindings = await runQuickChecks(context);

        // Step 3: Stream quick findings
        for (const finding of quickFindings) {
          sendEvent({
            type: 'finding',
            data: finding,
          });
        }

        // Step 4 & 5: Run Opus audit and stream results
        let auditResult: AuditResult;
        try {
          auditResult = await runOpusAudit(context, quickFindings);

          // Stream Opus findings (not already sent)
          const quickFindingIds = new Set(quickFindings.map((f) => f.id));
          for (const finding of auditResult.findings) {
            if (!quickFindingIds.has(finding.id)) {
              sendEvent({
                type: 'finding',
                data: finding,
              });
            }
          }

          // Stream good practices
          for (const practice of auditResult.goodPractices) {
            sendEvent({
              type: 'good-practice',
              data: practice,
            });
          }
        } catch (error) {
          // If Opus audit fails, don't provide a score
          // (scores require full Opus analysis to be meaningful)
          app.log.error({ error }, 'Opus audit failed, using quick checks only');

          auditResult = {
            overallScore: null as any, // No score without full analysis
            scoreExplanation: `Quick checks completed. Full security analysis requires ANTHROPIC_API_KEY to be set.`,
            findings: quickFindings,
            goodPractices: [],
            architecturalRecommendations: [],
            auditedAt: new Date().toISOString(),
          };
        }

        // Step 6: Update caches with audit results
        updateFindingsCache(auditResult.findings);
        updateAuditResultCache(auditResult);

        // Step 7: Save score to history and check achievements
        if (auditResult.overallScore !== null && auditResult.overallScore !== undefined) {
          const scoreHistoryService = getScoreHistoryService();
          const achievementsService = getAchievementsService();

          try {
            await scoreHistoryService.saveScore(auditResult, 'api');
            await achievementsService.checkAndUnlockAchievements(auditResult);
          } catch (error) {
            app.log.error({ error }, 'Failed to save score history or check achievements');
          }
        }

        // Step 8: Send final summary
        sendEvent({
          type: 'complete',
          data: auditResult,
        });

        // Close the stream
        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();
      } catch (error) {
        app.log.error({ error }, 'Unexpected error in audit endpoint');

        // Try to send error if stream is still open
        try {
          reply.raw.write(
            `data: ${JSON.stringify({
              type: 'error',
              error: error instanceof Error ? error.message : String(error),
            })}\n\n`
          );
          reply.raw.write('data: [DONE]\n\n');
          reply.raw.end();
        } catch {
          // Stream already closed, ignore
        }
      }
    }
  );
}
