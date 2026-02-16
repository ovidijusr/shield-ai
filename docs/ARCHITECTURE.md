# ShieldAI API Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                         │
│                      React + TanStack Query                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ HTTP/SSE
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      Fastify Server (Port 8484)                  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   Middleware Layer                          │ │
│  │  • CORS (dev: permissive, prod: same-origin)               │ │
│  │  • Bearer Token Auth (via SHIELDAI_TOKEN)                  │ │
│  │  • Error Handler (production-safe messages)                │ │
│  │  • Request Logger (pino)                                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                      API Routes                             │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  /api/containers  (GET)                              │ │ │
│  │  │  /api/infrastructure  (GET)                          │ │ │
│  │  │  └─> collector.ts                                    │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  /api/audit  (POST, SSE)                             │ │ │
│  │  │  └─> collector.ts → quick-checks.ts → opus-audit.ts │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  /api/fix/preview  (POST)                            │ │ │
│  │  │  /api/fix/apply    (POST)                            │ │ │
│  │  │  └─> fix-engine.ts                                   │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  /api/chat  (POST, SSE)                              │ │ │
│  │  │  └─> collector.ts → opus-chat.ts                     │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Service Layer                            │ │
│  │                                                             │ │
│  │  • collector.ts        - Docker API integration           │ │
│  │  • quick-checks.ts     - Fast rule-based checks           │ │
│  │  • opus-audit.ts       - Deep AI analysis                 │ │
│  │  • fix-engine.ts       - Fix generation & application     │ │
│  │  • opus-chat.ts        - Conversational AI                │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ├──> Docker API (containers, networks, volumes)
                            ├──> Filesystem (/configs for compose files)
                            └──> Claude Opus API (security analysis & chat)
```

## Request Flow

### Standard REST Endpoint

```
Client Request
      │
      ▼
┌─────────────────┐
│ CORS Check      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Auth Middleware │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Route Handler   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Service Layer   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ JSON Response   │
└─────────────────┘
```

### SSE Streaming Endpoint

```
Client Request (POST)
      │
      ▼
┌─────────────────┐
│ CORS Check      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Auth Middleware │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Set SSE Headers │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Service Layer   │
│ (async/stream)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Write Events    │◄──┐
│ data: {...}\n\n │   │ Loop/Stream
└────────┬────────┘   │
         │            │
         ├────────────┘
         │
         ▼
┌─────────────────┐
│ Send [DONE]     │
│ Close Stream    │
└─────────────────┘
```

## Audit Flow (Detailed)

```
POST /api/audit
      │
      ▼
┌──────────────────────────────────────┐
│ 1. Set SSE Headers                   │
│    Content-Type: text/event-stream   │
│    Cache-Control: no-cache           │
│    Connection: keep-alive            │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 2. Collect Infrastructure Context    │
│    • Docker containers (all)         │
│    • Networks                        │
│    • Volumes                         │
│    • Compose files (/configs)        │
│    • Docker version & OS info        │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 3. Run Quick Checks (Instant)        │
│    • Privileged containers           │
│    • Exposed ports                   │
│    • Running as root                 │
│    • No resource limits              │
│    • Insecure configurations         │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 4. Stream Quick Findings             │
│    data: {"type":"finding",...}\n\n  │
│    (One event per finding)           │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 5. Run Opus Deep Analysis            │
│    • Send context to Claude Opus     │
│    • Analyze security posture        │
│    • Generate detailed findings      │
│    • Identify good practices         │
│    • Create recommendations          │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 6. Stream Opus Findings              │
│    (Exclude duplicates from quick)   │
│    data: {"type":"finding",...}\n\n  │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 7. Stream Good Practices             │
│    data: {"type":"good-practice"...} │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 8. Calculate Security Score          │
│    Score = 100 - Σ(severity_weight)  │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 9. Send Complete Event               │
│    data: {"type":"complete",...}\n\n │
│    (Includes full AuditResult)       │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 10. Close Stream                     │
│     data: [DONE]\n\n                 │
└──────────────────────────────────────┘
```

## Chat Flow (Detailed)

```
POST /api/chat
  body: { message, history }
      │
      ▼
┌──────────────────────────────────────┐
│ 1. Validate Request Body             │
│    • message: string                 │
│    • history: ChatMessage[]          │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 2. Set SSE Headers                   │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 3. Collect Infrastructure Context    │
│    (Same as audit)                   │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 4. Get Last Audit Result (Cache)     │
│    (If available)                    │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 5. Build System Prompt               │
│    • Infrastructure context          │
│    • Audit findings                  │
│    • Good practices                  │
│    • Security score                  │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 6. Stream Claude Opus Response       │
│    for await (chunk of response)     │
│      write chunk as SSE event        │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 7. Send Done Event                   │
│    data: {"type":"done"}\n\n         │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 8. Close Stream                      │
│    data: [DONE]\n\n                  │
└──────────────────────────────────────┘
```

## Fix Flow (Detailed)

```
POST /api/fix/preview
  body: { findingId }
      │
      ▼
┌──────────────────────────────────────┐
│ 1. Validate Request Body             │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 2. Lookup Finding (Cache)            │
│    findingsCache.get(findingId)      │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 3. Generate Diff Preview             │
│    • Read current file               │
│    • Compare with new content        │
│    • Generate diff lines             │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 4. Return DiffPreview                │
│    { before, after, diff, ... }      │
└──────────────────────────────────────┘


POST /api/fix/apply
  body: { findingId }
      │
      ▼
┌──────────────────────────────────────┐
│ 1. Validate & Lookup Finding         │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 2. Create Backup                     │
│    (Timestamped backup file)         │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 3. Apply Fix                         │
│    • compose_replace: Write new file │
│    • docker_command: Run commands    │
│    • manual: Return instructions     │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 4. Restart Container (if needed)     │
│    docker-compose restart <name>     │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 5. Return FixResult                  │
│    { success, backupPath, ... }      │
└──────────────────────────────────────┘
```

## Data Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Docker    │────▶│  Collector   │────▶│   Memory    │
│   Daemon    │     │   Service    │     │   Cache     │
└─────────────┘     └──────────────┘     └─────────────┘
                                                │
                                                ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Filesystem  │────▶│    Routes    │────▶│   Client    │
│  /configs   │     │   (SSE/REST) │     │  (Browser)  │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Claude Opus  │
                    │     API      │
                    └──────────────┘
```

## Caching Strategy

```
┌─────────────────────────────────────────────────────────┐
│                    In-Memory Cache                       │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Findings Cache                                  │   │
│  │  Map<findingId, Finding>                        │   │
│  │  • Updated after each audit                     │   │
│  │  • Used by fix preview/apply                    │   │
│  │  • Production: Replace with Redis               │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Audit Result Cache                              │   │
│  │  AuditResult (latest)                           │   │
│  │  • Updated after each audit                     │   │
│  │  • Used by chat for context                     │   │
│  │  • Production: Replace with Redis               │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Security Model

```
┌───────────────────────────────────────────────────────┐
│              Authentication Flow                       │
│                                                        │
│  Client Request                                        │
│       │                                                │
│       ▼                                                │
│  ┌──────────────────────────────────────────┐         │
│  │ Is SHIELDAI_TOKEN set in env?            │         │
│  └─────────────┬────────────────────────────┘         │
│                │                                       │
│         No     │     Yes                               │
│    ┌───────────┴──────────┐                           │
│    ▼                      ▼                            │
│  Allow            Check Authorization header          │
│  Request          │                                    │
│                   ▼                                    │
│           ┌─────────────────────┐                     │
│           │ Bearer token valid? │                     │
│           └─────────────────────┘                     │
│                   │                                    │
│            Yes    │    No                              │
│         ┌─────────┴────────┐                          │
│         ▼                  ▼                           │
│       Allow              401                           │
│      Request          Unauthorized                     │
└───────────────────────────────────────────────────────┘
```

## Error Handling Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                   Error Handler Stack                    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Level 1: Route Handler try/catch                │   │
│  │ • Catches expected errors                       │   │
│  │ • Returns structured error response             │   │
│  │ • Logs error details                            │   │
│  └─────────────────┬───────────────────────────────┘   │
│                    │ (Unhandled errors)                 │
│                    ▼                                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Level 2: Global Error Handler                   │   │
│  │ • Catches all unhandled errors                  │   │
│  │ • Sanitizes error messages in production        │   │
│  │ • Logs full error with context                  │   │
│  │ • Returns 500 with safe message                 │   │
│  └─────────────────┬───────────────────────────────┘   │
│                    │ (SSE stream errors)                │
│                    ▼                                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Level 3: SSE Error Events                       │   │
│  │ • Sends error event to client                   │   │
│  │ • Closes stream gracefully                      │   │
│  │ • Sends [DONE] marker                           │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Production Deployment

```
┌────────────────────────────────────────────────────────┐
│                    Production Stack                     │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Nginx/Traefik (Reverse Proxy)                    │ │
│  │ • HTTPS termination                              │ │
│  │ • Rate limiting                                  │ │
│  │ • Request buffering disabled for SSE            │ │
│  └────────────────┬─────────────────────────────────┘ │
│                   │                                    │
│                   ▼                                    │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Fastify Server (PM2/Docker)                      │ │
│  │ • Multiple instances                             │ │
│  │ • Health checks                                  │ │
│  │ • Graceful shutdown                              │ │
│  └────────────────┬─────────────────────────────────┘ │
│                   │                                    │
│        ┌──────────┼──────────┐                         │
│        ▼          ▼          ▼                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                  │
│  │ Redis   │ │ Docker  │ │ Claude  │                  │
│  │ (Cache) │ │  API    │ │  API    │                  │
│  └─────────┘ └─────────┘ └─────────┘                  │
└────────────────────────────────────────────────────────┘
```

## Performance Considerations

- **Caching**: In-memory for dev, Redis for production
- **Connection Pooling**: Docker API connection reuse
- **Streaming**: SSE for real-time updates without polling
- **Compression**: Gzip for large responses
- **Rate Limiting**: Prevent abuse (to be implemented)
- **Request Timeouts**: Prevent hanging requests
- **Graceful Degradation**: Quick checks fallback if Opus fails

## Monitoring Points

```
Key Metrics to Track:
├── Request Rate (per endpoint)
├── Response Times (p50, p95, p99)
├── Error Rate (per endpoint)
├── SSE Stream Duration
├── Docker API Response Time
├── Claude API Response Time
├── Cache Hit Rate
├── Active Connections
└── Memory Usage
```
