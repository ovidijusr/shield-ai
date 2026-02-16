/**
 * Chat Routes
 *
 * Provides SSE endpoint for streaming conversational AI responses
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { collectInfraContext } from '../services/collector.js';
import { streamOpusChat } from '../services/opus-chat.js';
import type { ChatRequest, ChatMessage } from '@shared/types.js';

/**
 * Type guard for chat request body
 */
function isChatRequest(body: unknown): body is ChatRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const req = body as Partial<ChatRequest>;

  return (
    typeof req.message === 'string' &&
    Array.isArray(req.history) &&
    req.history.every(
      (msg) =>
        typeof msg === 'object' &&
        msg !== null &&
        'role' in msg &&
        'content' in msg &&
        'timestamp' in msg &&
        (msg.role === 'user' || msg.role === 'assistant') &&
        typeof msg.content === 'string' &&
        typeof msg.timestamp === 'string'
    )
  );
}

/**
 * In-memory cache of last audit result
 * In production, this should be stored in a database or Redis
 */
let lastAuditResult: any = null;

/**
 * Helper to update audit result cache (called after audit)
 */
export function updateAuditResultCache(result: any): void {
  lastAuditResult = result;
}

/**
 * Helper to get the last audit result
 */
export function getLastAuditResult(): any {
  return lastAuditResult;
}

/**
 * Register chat routes
 */
export async function chatRoutes(app: FastifyInstance) {
  /**
   * POST /api/chat
   * SSE endpoint for streaming chat responses
   * Body: { message: string, history: ChatMessage[] }
   *
   * Streams Opus chat response via SSE
   * Includes full infra context + audit results in system prompt
   */
  app.post(
    '/api/chat',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        // Validate request body
        if (!isChatRequest(request.body)) {
          reply.code(400).send({
            error: 'Invalid request body',
            details:
              'Request body must include message (string) and history (ChatMessage[])',
            statusCode: 400,
          });
          return;
        }

        const { message, history } = request.body;

        // Set up SSE headers
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

        // Collect infrastructure context
        let context;
        try {
          context = await collectInfraContext();
        } catch (error) {
          reply.raw.write(
            `data: ${JSON.stringify({
              type: 'error',
              error: `Failed to collect infrastructure: ${error instanceof Error ? error.message : String(error)}`,
            })}\n\n`
          );
          reply.raw.write('data: [DONE]\n\n');
          reply.raw.end();
          return;
        }

        // Stream chat response
        try {
          // Build messages array for streaming
          const messages: ChatMessage[] = [
            ...history,
            {
              role: 'user',
              content: message,
              timestamp: new Date().toISOString(),
            },
          ];

          // Stream chat using generator
          for await (const chunk of streamOpusChat(messages, context, lastAuditResult || undefined)) {
            // Send chunk as SSE event
            reply.raw.write(
              `data: ${JSON.stringify({
                type: 'chunk',
                content: chunk,
              })}\n\n`
            );
          }

          // Send completion event
          reply.raw.write(
            `data: ${JSON.stringify({
              type: 'done',
            })}\n\n`
          );
        } catch (error) {
          app.log.error({ error }, 'Chat stream error');
          reply.raw.write(
            `data: ${JSON.stringify({
              type: 'error',
              error: error instanceof Error ? error.message : String(error),
            })}\n\n`
          );
        }

        // Close the stream
        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();
      } catch (error) {
        app.log.error({ error }, 'Unexpected error in chat endpoint');

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
