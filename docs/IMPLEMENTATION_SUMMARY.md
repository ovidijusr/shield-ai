# API Routes & SSE Infrastructure - Implementation Summary

This document summarizes the implementation of the ShieldAI API routes and SSE streaming infrastructure.

## Overview

The API server is built with Fastify and provides both standard REST endpoints and Server-Sent Events (SSE) streaming for real-time audit and chat responses.

## Architecture

```
src/server/
├── index.ts              # Main server with middleware, error handling, route registration
├── routes/
│   ├── containers.ts     # Container and infrastructure endpoints
│   ├── audit.ts          # SSE streaming audit endpoint
│   ├── fix.ts            # Fix preview and apply endpoints
│   └── chat.ts           # SSE streaming chat endpoint
└── services/
    ├── collector.ts      # Docker infrastructure collector
    ├── quick-checks.ts   # Quick security checks (placeholder)
    ├── opus-audit.ts     # Opus deep analysis (placeholder)
    ├── fix-engine.ts     # Fix preview/apply logic (placeholder)
    └── opus-chat.ts      # Chat service (placeholder)
```

## Implementation Details

### 1. Main Server (`src/server/index.ts`)

**Features:**
- Fastify with full TypeScript typing
- CORS configuration (permissive in dev, same-origin in prod)
- Bearer token authentication middleware
- Global error handler with production-safe error messages
- 404 handler for API routes
- Static file serving in production
- Graceful shutdown handling
- Pretty logging in development

**Key Configurations:**
- Port: 8484 (configurable via `SHIELDAI_PORT`)
- Host: 0.0.0.0 (configurable via `HOST`)
- Body limit: 10MB for large infrastructure contexts
- Auth: Optional Bearer token via `SHIELDAI_TOKEN` env var

**Authentication:**
- Protects all `/api/*` routes except `/api/health`
- Validates `Authorization: Bearer <token>` header
- Returns 401 with descriptive error if token is invalid
- Skips auth if `SHIELDAI_TOKEN` is not set

### 2. Containers Routes (`src/server/routes/containers.ts`)

Provides two endpoints for querying Docker infrastructure:

**GET `/api/containers`**
- Returns array of all containers (running and stopped)
- Uses `collectInfraContext()` service
- Error handling with 500 status on failure

**GET `/api/infrastructure`**
- Returns complete infrastructure context
- Includes containers, networks, volumes, compose files
- Provides Docker version, OS info, collection timestamp

### 3. Audit Routes (`src/server/routes/audit.ts`)

Implements SSE streaming for real-time audit results.

**POST `/api/audit`**

**Flow:**
1. Set SSE headers (Content-Type, Cache-Control, Connection)
2. Collect infrastructure context via `collectInfraContext()`
3. Run quick security checks via `runQuickChecks()`
4. Stream quick findings as SSE events
5. Run deep Opus analysis via `runOpusAudit()`
6. Stream Opus findings (excluding duplicates)
7. Stream good practices
8. Send final complete event with audit summary
9. Close stream with `[DONE]` marker

**SSE Event Types:**
- `finding` - Security finding with severity, category, title, description, fix
- `good-practice` - Positive security practice found
- `complete` - Final audit summary with score and all results
- `error` - Error during audit process

**Error Handling:**
- Gracefully handles infrastructure collection failures
- Falls back to quick checks only if Opus audit fails
- Calculates security score based on findings
- Always closes stream properly

**Security Score:**
- Ranges from 0-100 (higher is better)
- Calculated based on finding severities:
  - Critical: -25 points
  - High: -15 points
  - Medium: -8 points
  - Low: -3 points
  - Info: -1 point

### 4. Fix Routes (`src/server/routes/fix.ts`)

Provides endpoints for previewing and applying security fixes.

**POST `/api/fix/preview`**
- Accepts `{ findingId: string }` in request body
- Validates request body with type guard
- Looks up finding from in-memory cache
- Calls `previewFix()` to generate diff
- Returns diff preview with before/after content

**POST `/api/fix/apply`**
- Accepts `{ findingId: string }` in request body
- Validates request body
- Looks up finding from cache
- Calls `applyFix()` to apply changes
- Returns result with backup path and restart info

**Findings Cache:**
- In-memory Map for storing findings from last audit
- Exported `updateFindingsCache()` function for cache updates
- In production, should be replaced with Redis/database

**Error Handling:**
- 400 for invalid request body
- 404 for finding not found
- 500 for service failures

### 5. Chat Routes (`src/server/routes/chat.ts`)

Implements SSE streaming for conversational AI responses.

**POST `/api/chat`**

**Request:**
```json
{
  "message": "User's message",
  "history": [
    { "role": "user", "content": "...", "timestamp": "..." },
    { "role": "assistant", "content": "...", "timestamp": "..." }
  ]
}
```

**Flow:**
1. Validate request body with type guard
2. Set SSE headers
3. Collect infrastructure context
4. Call `chat()` service with context, audit results, history, message
5. Stream response chunks via SSE
6. Send done event when complete
7. Close stream with `[DONE]` marker

**SSE Event Types:**
- `chunk` - Partial response text
- `done` - Stream complete
- `error` - Error during chat

**Context:**
- Includes full infrastructure context
- Includes last audit result from cache
- In production, should persist audit results

### 6. SSE Implementation Pattern

All SSE endpoints follow this pattern:

```typescript
// Set headers
reply.raw.setHeader('Content-Type', 'text/event-stream');
reply.raw.setHeader('Cache-Control', 'no-cache');
reply.raw.setHeader('Connection', 'keep-alive');
reply.raw.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

// Send events
for (const item of items) {
  reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
}

// Close stream
reply.raw.write('data: [DONE]\n\n');
reply.raw.end();
```

**Key Points:**
- Use `reply.raw` for direct stream access
- Double newline after each event
- Send `[DONE]` marker before closing
- Always close stream properly
- Handle errors gracefully

## Type Safety

All routes use TypeScript for:
- Request/response typing
- Type guards for request body validation
- Shared types from `@shared/types.ts`
- Fastify plugin typing

Example type guard:
```typescript
function isChatRequest(body: unknown): body is ChatRequest {
  return (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    'history' in body &&
    // ... more validation
  );
}
```

## Error Handling

**Levels:**
1. Route-level try/catch for specific errors
2. Global error handler for unhandled errors
3. SSE error events for stream errors
4. Always return proper status codes

**Error Response Format:**
```json
{
  "error": "Error type",
  "details": "Detailed message",
  "statusCode": 500
}
```

## Testing

A comprehensive test script is provided: `test-api.sh`

**Tests:**
1. Health check
2. GET /api/containers
3. GET /api/infrastructure
4. POST /api/audit (SSE stream)
5. POST /api/fix/preview
6. POST /api/chat (SSE stream)
7. Authentication (if token set)

**Usage:**
```bash
# Without auth
./test-api.sh

# With auth
SHIELDAI_TOKEN=your-token ./test-api.sh

# Custom URL
API_URL=http://example.com:8484 ./test-api.sh
```

## Production Considerations

**Current Implementation:**
- In-memory caching for findings and audit results
- No rate limiting
- Simple auth with single token

**Production Improvements:**
- Replace in-memory cache with Redis
- Add rate limiting middleware
- Implement user/API key management
- Add request logging and monitoring
- Enable HTTPS
- Add health checks for dependencies
- Implement graceful degradation
- Add request timeouts

## Integration Points

**Services Used:**
- `collector.ts` - Collects Docker infrastructure
- `quick-checks.ts` - Fast rule-based checks (placeholder)
- `opus-audit.ts` - Deep AI analysis (placeholder)
- `fix-engine.ts` - Fix preview/apply (placeholder)
- `opus-chat.ts` - Chat service (placeholder)

**Cache Updates:**
These functions should be called by other agents:
- `updateFindingsCache(findings)` in `fix.ts`
- `updateAuditResultCache(result)` in `chat.ts`

## Verification

To verify the implementation:

1. **Build the server:**
   ```bash
   pnpm run build:server
   ```

2. **Start the server:**
   ```bash
   pnpm run dev:server
   ```

3. **Run tests:**
   ```bash
   ./test-api.sh
   ```

4. **Test SSE manually:**
   ```bash
   curl -N -X POST http://localhost:8484/api/audit
   ```

## Documentation

Complete API documentation is available in `docs/API.md`, including:
- Endpoint descriptions
- Request/response formats
- SSE event types
- Client examples (JavaScript, cURL)
- Error formats
- Security score calculation

## Quality Standards Met

- ✅ Proper SSE implementation with correct headers
- ✅ Type-safe route handlers with Fastify typing
- ✅ Comprehensive error handling at all levels
- ✅ Auth middleware applied to sensitive routes
- ✅ Request validation with type guards
- ✅ Clean separation of concerns
- ✅ Production-ready error messages
- ✅ Graceful shutdown handling
- ✅ Static file serving for SPA
- ✅ CORS configuration for dev/prod
- ✅ Complete documentation
- ✅ Test script for verification

## Next Steps

For other agents:
1. **AUDIT agent** - Implement `runQuickChecks()` and `runOpusAudit()`
2. **FIX agent** - Implement `previewFix()` and `applyFix()`
3. **CHAT agent** - Implement `chat()` streaming function
4. **FRONTEND agent** - Integrate with these API endpoints
