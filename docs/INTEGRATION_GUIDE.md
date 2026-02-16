# Integration Guide for Other Agents

This guide shows how other agents should integrate with the API routes infrastructure.

## For AUDIT Agent

### Implement Quick Checks

Location: `src/server/services/quick-checks.ts`

```typescript
import type { DockerInfraContext, Finding } from '@shared/types.js';

export function runQuickChecks(context: DockerInfraContext): Finding[] {
  const findings: Finding[] = [];

  // Example: Check for privileged containers
  for (const container of context.containers) {
    if (container.privileged) {
      findings.push({
        id: `priv-${container.id}`,
        severity: 'critical',
        category: 'privileged mode',
        title: 'Container running in privileged mode',
        container: container.name,
        description: `Container ${container.name} is running with --privileged flag`,
        risk: 'Full host access, can escape container',
        fix: {
          description: 'Remove privileged flag',
          type: 'compose_replace',
          composePath: '/path/to/compose.yml',
          newFileContent: '...',
          commands: null,
          sideEffects: 'Container will restart',
          requiresRestart: true,
        },
        source: 'quick_check',
      });
    }
  }

  return findings;
}
```

### Implement Opus Audit

Location: `src/server/services/opus-audit.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { DockerInfraContext, Finding, AuditResult } from '@shared/types.js';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function runOpusAudit(
  context: DockerInfraContext,
  quickFindings: Finding[]
): Promise<AuditResult> {
  // 1. Build system prompt with infrastructure context
  const systemPrompt = buildAuditPrompt(context, quickFindings);

  // 2. Call Claude Opus
  const message = await client.messages.create({
    model: 'claude-opus-4-20250514',
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: 'Analyze this Docker infrastructure for security issues.',
      },
    ],
  });

  // 3. Parse response into AuditResult
  const result = parseAuditResponse(message.content);

  return result;
}
```

### Update Findings Cache

After generating findings, update the cache so fix routes can access them:

```typescript
import { updateFindingsCache } from '../routes/fix.js';

// After audit completes
updateFindingsCache(auditResult.findings);
```

## For FIX Agent

### Implement Fix Preview

Location: `src/server/services/fix-engine.ts`

```typescript
import { diffLines } from 'diff';
import { promises as fs } from 'fs';
import type { Finding, DiffPreview } from '@shared/types.js';

export async function previewFix(finding: Finding): Promise<DiffPreview> {
  const fix = finding.fix;

  if (fix.type === 'compose_replace' && fix.composePath && fix.newFileContent) {
    // Read current file
    const before = await fs.readFile(fix.composePath, 'utf-8');
    const after = fix.newFileContent;

    // Generate diff
    const diff = diffLines(before, after);

    return {
      before,
      after,
      diff,
      sideEffects: fix.sideEffects,
      composePath: fix.composePath,
    };
  }

  if (fix.type === 'docker_command') {
    return {
      before: '',
      after: fix.commands?.join('\n') || '',
      diff: [],
      sideEffects: fix.sideEffects,
      composePath: '',
    };
  }

  throw new Error(`Cannot preview fix type: ${fix.type}`);
}
```

### Implement Fix Application

```typescript
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { Finding, FixResult } from '@shared/types.js';

const execAsync = promisify(exec);

export async function applyFix(finding: Finding): Promise<FixResult> {
  const fix = finding.fix;

  try {
    // Create backup
    const backupPath = await createBackup(fix.composePath);

    if (fix.type === 'compose_replace' && fix.composePath && fix.newFileContent) {
      // Write new file
      await fs.writeFile(fix.composePath, fix.newFileContent, 'utf-8');

      // Restart container if needed
      if (fix.requiresRestart && finding.container) {
        await execAsync(`docker-compose restart ${finding.container}`);
      }

      return {
        success: true,
        backupPath,
        containerRestarted: fix.requiresRestart ? finding.container : undefined,
        appliedAt: new Date().toISOString(),
      };
    }

    if (fix.type === 'docker_command' && fix.commands) {
      // Execute commands
      for (const cmd of fix.commands) {
        await execAsync(cmd);
      }

      return {
        success: true,
        backupPath,
        appliedAt: new Date().toISOString(),
      };
    }

    throw new Error(`Cannot apply fix type: ${fix.type}`);
  } catch (error) {
    return {
      success: false,
      backupPath: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

## For CHAT Agent

### Implement Chat Service

Location: `src/server/services/opus-chat.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type {
  DockerInfraContext,
  AuditResult,
  ChatMessage,
} from '@shared/types.js';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function* chat(
  context: DockerInfraContext,
  auditResults: AuditResult | null,
  history: ChatMessage[],
  message: string
): AsyncIterable<string> {
  // 1. Build system prompt with context
  const systemPrompt = buildChatSystemPrompt(context, auditResults);

  // 2. Convert history to Anthropic format
  const messages = [
    ...history.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    {
      role: 'user' as const,
      content: message,
    },
  ];

  // 3. Stream response
  const stream = await client.messages.stream({
    model: 'claude-opus-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  // 4. Yield chunks
  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}
```

### Update Audit Result Cache

After audit completes, update the cache:

```typescript
import { updateAuditResultCache } from '../routes/chat.js';

// After audit completes
updateAuditResultCache(auditResult);
```

## For FRONTEND Agent

### Consuming SSE Endpoints

#### Audit Stream

```typescript
const auditStream = new EventSource('/api/audit', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

auditStream.onmessage = (event) => {
  if (event.data === '[DONE]') {
    auditStream.close();
    return;
  }

  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'finding':
      addFinding(data.data);
      break;
    case 'good-practice':
      addGoodPractice(data.data);
      break;
    case 'complete':
      setAuditResult(data.data);
      break;
    case 'error':
      handleError(data.error);
      break;
  }
};
```

#### Chat Stream

```typescript
async function sendChatMessage(message: string, history: ChatMessage[]) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message, history }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') break;

        const event = JSON.parse(data);
        if (event.type === 'chunk') {
          appendToMessage(event.content);
        }
      }
    }
  }
}
```

### Standard Endpoints

```typescript
// Get containers
const containers = await fetch('/api/containers', {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

// Get infrastructure
const infra = await fetch('/api/infrastructure', {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

// Preview fix
const preview = await fetch('/api/fix/preview', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ findingId: 'finding-1' }),
}).then((r) => r.json());

// Apply fix
const result = await fetch('/api/fix/apply', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ findingId: 'finding-1' }),
}).then((r) => r.json());
```

## Environment Variables

All agents should use these environment variables:

```bash
# Server configuration
SHIELDAI_PORT=8484              # Server port
HOST=0.0.0.0                     # Server host
NODE_ENV=development             # Environment mode

# Authentication
SHIELDAI_TOKEN=your-token-here   # Bearer token (optional)

# Anthropic API
ANTHROPIC_API_KEY=sk-...         # Claude API key

# Logging
LOG_LEVEL=info                   # Log level
```

## Testing

Test your implementations with the provided test script:

```bash
# Start server
pnpm run dev:server

# In another terminal, run tests
./test-api.sh
```

## Cache Management

### Current Implementation

The API uses in-memory caching for:
- Findings (for fix routes)
- Audit results (for chat context)

### Production Migration

For production, replace with Redis:

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Store findings
await redis.set(
  `findings:${findingId}`,
  JSON.stringify(finding),
  'EX',
  3600
);

// Retrieve findings
const finding = JSON.parse(await redis.get(`findings:${findingId}`));

// Store audit result
await redis.set('audit:latest', JSON.stringify(result), 'EX', 86400);
```

## Error Handling

All service implementations should throw descriptive errors:

```typescript
throw new Error('Failed to analyze container: missing required fields');
```

The route handlers will catch and format these appropriately.

## Logging

Use the Fastify logger:

```typescript
app.log.info('Starting audit');
app.log.error({ error }, 'Audit failed');
app.log.debug({ context }, 'Context collected');
```

## Type Safety

Always use types from `@shared/types.ts`:

```typescript
import type {
  DockerInfraContext,
  Finding,
  AuditResult,
  ChatMessage,
  // ... etc
} from '@shared/types.js';
```

## Next Steps

1. Implement the placeholder services
2. Test with the provided test script
3. Integrate with frontend
4. Add production caching (Redis)
5. Add monitoring and metrics
