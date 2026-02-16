# Opus Integration API Reference

Quick reference for other swarm agents integrating with the Anthropic Opus services.

---

## Imports

```typescript
// Prompt builders
import { buildAuditPrompt } from './prompts/audit.js';
import { buildChatSystemPrompt } from './prompts/chat.js';

// Streaming services
import { streamOpusAudit, runOpusAudit } from './services/opus-audit.js';
import { streamOpusChat, chat } from './services/opus-chat.js';

// Types
import type {
  DockerInfraContext,
  Finding,
  GoodPractice,
  ArchitecturalRecommendation,
  AuditResult,
  ChatMessage
} from '@shared/types.js';
```

---

## Audit Service

### Streaming (Recommended)

```typescript
for await (const item of streamOpusAudit(context, quickFindings)) {
  if ('severity' in item) {
    // It's a Finding
    const finding = item as Finding;
    console.log(`Finding: ${finding.title} (${finding.severity})`);
  }
  else if ('appliesTo' in item) {
    // It's a GoodPractice
    const practice = item as GoodPractice;
    console.log(`Good Practice: ${practice.title}`);
  }
  else if ('complexity' in item) {
    // It's an ArchitecturalRecommendation
    const rec = item as ArchitecturalRecommendation;
    console.log(`Recommendation: ${rec.title} (${rec.complexity})`);
  }
  else if ('type' in item && item.type === 'audit_result') {
    // Complete audit result
    const result = item.data;
    console.log(`Overall Score: ${result.overallScore}/100`);
  }
}
```

### Non-Streaming

```typescript
const auditResult = await runOpusAudit(context, quickFindings);
console.log(`Score: ${auditResult.overallScore}/100`);
console.log(`Findings: ${auditResult.findings.length}`);
console.log(`Good Practices: ${auditResult.goodPractices.length}`);
```

---

## Chat Service

### Streaming (Recommended)

```typescript
const messages: ChatMessage[] = [
  {
    role: 'user',
    content: 'How can I secure my containers?',
    timestamp: new Date().toISOString()
  }
];

for await (const chunk of streamOpusChat(messages, context, auditResults)) {
  process.stdout.write(chunk); // Print as it arrives
}
```

### Non-Streaming

```typescript
const response = await chat(
  context,
  auditResults,
  conversationHistory,
  'How can I secure my containers?'
);

console.log(response);
```

---

## Prompt Builders (Advanced)

### Audit Prompt

```typescript
const promptJson = buildAuditPrompt(context, quickFindings);
const { system, user } = JSON.parse(promptJson);

// Use with custom Anthropic client
const response = await anthropic.messages.create({
  model: 'claude-opus-4-6',
  max_tokens: 16000,
  temperature: 0.3,
  system,
  messages: [{ role: 'user', content: user }]
});
```

### Chat Prompt

```typescript
const systemPrompt = buildChatSystemPrompt(context, auditResults);

// Use with custom Anthropic client
const response = await anthropic.messages.create({
  model: 'claude-opus-4-6',
  max_tokens: 4096,
  temperature: 0.7,
  system: systemPrompt,
  messages: chatHistory
});
```

---

## Error Handling

### Audit Errors

```typescript
try {
  for await (const item of streamOpusAudit(context, quickFindings)) {
    // Process items
  }
} catch (error) {
  console.error('Audit failed:', error.message);
  // Fallback to quick findings only
}
```

### Chat Errors

```typescript
try {
  for await (const chunk of streamOpusChat(messages, context)) {
    // Error messages are yielded in the stream
    if (chunk.includes('❌ **Error**')) {
      console.error('Chat error detected in stream');
    }
  }
} catch (error) {
  console.error('Chat service error:', error.message);
}
```

---

## Type Guards

```typescript
function isFinding(item: any): item is Finding {
  return 'severity' in item && 'container' in item;
}

function isGoodPractice(item: any): item is GoodPractice {
  return 'appliesTo' in item && !('severity' in item);
}

function isArchitecturalRecommendation(item: any): item is ArchitecturalRecommendation {
  return 'complexity' in item && 'impact' in item;
}

function isAuditResult(item: any): item is { type: 'audit_result', data: AuditResult } {
  return 'type' in item && item.type === 'audit_result';
}
```

---

## Server-Sent Events (SSE) Integration

### Audit Endpoint

```typescript
// In Fastify route handler
reply.raw.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive'
});

for await (const item of streamOpusAudit(context, quickFindings)) {
  const eventData = JSON.stringify(item);
  reply.raw.write(`data: ${eventData}\n\n`);
}

reply.raw.write('data: [DONE]\n\n');
reply.raw.end();
```

### Chat Endpoint

```typescript
reply.raw.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive'
});

for await (const chunk of streamOpusChat(messages, context, auditResults)) {
  const eventData = JSON.stringify({ content: chunk });
  reply.raw.write(`data: ${eventData}\n\n`);
}

reply.raw.write('data: [DONE]\n\n');
reply.raw.end();
```

---

## Configuration

### Environment

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Optional
NODE_ENV=development
LOG_LEVEL=info
```

### Model Settings

| Service | Model | Max Tokens | Temperature | Streaming |
|---------|-------|------------|-------------|-----------|
| Audit | claude-opus-4-6 | 16,000 | 0.3 | Yes |
| Chat | claude-opus-4-6 | 4,096 | 0.7 | Yes |

---

## Testing

### Mock Data

```typescript
const mockContext: DockerInfraContext = {
  containers: [],
  networks: [],
  volumes: [],
  dockerVersion: '24.0.0',
  os: 'Linux',
  totalContainers: 0,
  composeFiles: [],
  collectedAt: new Date().toISOString()
};

const mockFindings: Finding[] = [];

// Test streaming
for await (const item of streamOpusAudit(mockContext, mockFindings)) {
  console.log('Received item:', item);
}
```

---

## Common Patterns

### Progress Tracking

```typescript
let findingCount = 0;
let practiceCount = 0;

for await (const item of streamOpusAudit(context, quickFindings)) {
  if (isFinding(item)) {
    findingCount++;
    console.log(`Progress: ${findingCount} findings...`);
  } else if (isGoodPractice(item)) {
    practiceCount++;
  }
}

console.log(`Complete: ${findingCount} findings, ${practiceCount} good practices`);
```

### Chat with History

```typescript
const history: ChatMessage[] = [];

while (true) {
  const userMessage = await getUserInput();

  history.push({
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString()
  });

  let assistantResponse = '';

  for await (const chunk of streamOpusChat(history, context)) {
    assistantResponse += chunk;
    process.stdout.write(chunk);
  }

  history.push({
    role: 'assistant',
    content: assistantResponse,
    timestamp: new Date().toISOString()
  });
}
```

---

## Troubleshooting

### API Key Issues

```typescript
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required');
}
```

### Rate Limiting

Error message yielded in stream:
```
❌ **Error**: Unable to process your request. Rate limit reached. Please try again in a moment.
```

### Parsing Failures

Audit service falls back to returning basic AuditResult with quick findings only.

---

## Performance

### Streaming Benefits

- **Real-time feedback**: Show progress as analysis happens
- **Lower memory**: Don't accumulate entire response before displaying
- **Better UX**: Users see results immediately

### Response Times

- **Audit**: 10-60 seconds (depends on infrastructure size)
- **Chat**: 2-10 seconds (depends on question complexity)

---

## Best Practices

1. **Always stream**: Use streaming functions for better UX
2. **Handle errors**: Wrap in try-catch and provide fallbacks
3. **Validate context**: Ensure context has required fields
4. **Rate limit**: Implement client-side rate limiting
5. **Cache results**: Cache audit results to reduce API calls
6. **Monitor costs**: Log API usage and token consumption

---

For detailed implementation examples, see:
- `/Users/ovi/projects/shieldai/test-opus-integration.js`
- `/Users/ovi/projects/shieldai/OPUS_INTEGRATION_COMPLETE.md`
