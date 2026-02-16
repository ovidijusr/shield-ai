/**
 * Opus Audit Service
 *
 * Deep security analysis using Claude Opus 4.6.
 * Streams findings and recommendations as they are generated.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { DockerInfraContext, Finding, GoodPractice, AuditResult, ArchitecturalRecommendation } from '@shared/types.js';
import { buildAuditPrompt } from '../prompts/audit.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Streams security audit results from Claude Opus 4.6.
 * Yields findings and good practices as they arrive.
 */
export async function* streamOpusAudit(
  context: DockerInfraContext,
  quickFindings: Finding[]
): AsyncGenerator<Finding | GoodPractice | ArchitecturalRecommendation | { type: 'audit_result', data: AuditResult }> {
  const promptData = JSON.parse(buildAuditPrompt(context, quickFindings));

  try {
    const stream = await anthropic.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 16000,
      temperature: 0.3,
      system: promptData.system,
      messages: [
        {
          role: 'user',
          content: promptData.user,
        },
      ],
    });

    let accumulatedText = '';
    let jsonStarted = false;
    let braceCount = 0;
    let inString = false;
    let escapeNext = false;

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        const text = chunk.delta.text;
        accumulatedText += text;

        // Parse JSON progressively
        for (let i = 0; i < text.length; i++) {
          const char = text[i];

          if (escapeNext) {
            escapeNext = false;
            continue;
          }

          if (char === '\\') {
            escapeNext = true;
            continue;
          }

          if (char === '"' && !escapeNext) {
            inString = !inString;
          }

          if (!inString) {
            if (char === '{') {
              if (!jsonStarted) jsonStarted = true;
              braceCount++;
            } else if (char === '}') {
              braceCount--;

              // Complete JSON object detected
              if (jsonStarted && braceCount === 0) {
                try {
                  const auditResult: AuditResult = JSON.parse(accumulatedText);

                  // Validate structure
                  if (auditResult.overallScore !== undefined && auditResult.findings && auditResult.goodPractices) {
                    // Set timestamp
                    auditResult.auditedAt = new Date().toISOString();

                    // Yield individual findings
                    for (const finding of auditResult.findings) {
                      yield finding;
                    }

                    // Yield good practices
                    for (const practice of auditResult.goodPractices) {
                      yield practice;
                    }

                    // Yield architectural recommendations
                    if (auditResult.architecturalRecommendations) {
                      for (const rec of auditResult.architecturalRecommendations) {
                        yield rec;
                      }
                    }

                    // Yield complete audit result
                    yield {
                      type: 'audit_result',
                      data: auditResult,
                    };

                    return;
                  }
                } catch (parseError) {
                  // Continue accumulating if parsing fails
                  continue;
                }
              }
            }
          }
        }
      }
    }

    // Final attempt to parse complete response
    if (accumulatedText.trim()) {
      try {
        // Extract JSON from markdown code blocks if present
        let jsonText = accumulatedText.trim();
        const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/) || jsonText.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1].trim();
        }

        const auditResult: AuditResult = JSON.parse(jsonText);

        if (auditResult.overallScore !== undefined && auditResult.findings && auditResult.goodPractices) {
          auditResult.auditedAt = new Date().toISOString();

          // Yield everything
          for (const finding of auditResult.findings) {
            yield finding;
          }

          for (const practice of auditResult.goodPractices) {
            yield practice;
          }

          if (auditResult.architecturalRecommendations) {
            for (const rec of auditResult.architecturalRecommendations) {
              yield rec;
            }
          }

          yield {
            type: 'audit_result',
            data: auditResult,
          };

          return;
        }
      } catch (error) {
        console.error('Failed to parse audit response:', error);
        console.error('Accumulated text:', accumulatedText);

        // Fallback: return a basic audit result
        yield {
          type: 'audit_result',
          data: {
            overallScore: 50,
            scoreExplanation: 'Unable to complete full analysis due to parsing error.',
            findings: quickFindings,
            goodPractices: [],
            architecturalRecommendations: [],
            auditedAt: new Date().toISOString(),
          },
        };
      }
    }
  } catch (error) {
    console.error('Error in Opus audit stream:', error);
    throw new Error(`Opus audit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Non-streaming version that returns complete audit result.
 * Useful for simpler integrations.
 */
export async function runOpusAudit(
  context: DockerInfraContext,
  quickFindings: Finding[]
): Promise<AuditResult> {
  const findings: Finding[] = [];
  const goodPractices: GoodPractice[] = [];
  const architecturalRecommendations: ArchitecturalRecommendation[] = [];
  let auditResult: AuditResult | null = null;

  for await (const item of streamOpusAudit(context, quickFindings)) {
    if ('type' in item && item.type === 'audit_result') {
      auditResult = item.data;
    } else if ('severity' in item) {
      findings.push(item as Finding);
    } else if ('appliesTo' in item) {
      goodPractices.push(item as GoodPractice);
    } else if ('complexity' in item) {
      architecturalRecommendations.push(item as ArchitecturalRecommendation);
    }
  }

  if (auditResult) {
    return auditResult;
  }

  // Fallback if streaming didn't yield complete result
  return {
    overallScore: 50,
    scoreExplanation: 'Audit completed with partial results.',
    findings,
    goodPractices,
    architecturalRecommendations,
    auditedAt: new Date().toISOString(),
  };
}
