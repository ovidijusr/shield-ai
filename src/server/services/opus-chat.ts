/**
 * Opus Chat Service
 *
 * Conversational AI advisor with full infrastructure context.
 * Provides streaming responses with security guidance.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { DockerInfraContext, AuditResult, ChatMessage } from '@shared/types.js';
import { buildChatSystemPrompt } from '../prompts/chat.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Streams chat responses from Claude Opus 4.6 with full infrastructure context.
 * Yields text chunks as they arrive for real-time display.
 */
export async function* streamOpusChat(
  messages: ChatMessage[],
  context: DockerInfraContext,
  auditResults?: AuditResult
): AsyncGenerator<string> {
  const systemPrompt = buildChatSystemPrompt(context, auditResults);

  try {
    // Convert ChatMessage[] to Anthropic message format
    const anthropicMessages: Anthropic.MessageParam[] = messages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    const stream = await anthropic.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      temperature: 0.7,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        yield chunk.delta.text;
      }
    }
  } catch (error) {
    console.error('Error in Opus chat stream:', error);

    // Yield error message to user
    yield '\n\n❌ **Error**: Unable to process your request. ';

    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        yield 'Invalid API key. Please check your ANTHROPIC_API_KEY environment variable.';
      } else if (error.status === 429) {
        yield 'Rate limit reached. Please try again in a moment.';
      } else {
        yield `API error: ${error.message}`;
      }
    } else {
      yield `An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

/**
 * Non-streaming version that returns complete chat response.
 * Useful for simpler integrations or testing.
 */
export async function chat(
  context: DockerInfraContext,
  auditResults: AuditResult | null,
  history: ChatMessage[],
  message: string
): Promise<string> {
  const messages: ChatMessage[] = [
    ...history,
    {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    },
  ];

  let fullResponse = '';

  for await (const chunk of streamOpusChat(messages, context, auditResults || undefined)) {
    fullResponse += chunk;
  }

  return fullResponse;
}
