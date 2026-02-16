# ShieldAI API Documentation

This document describes the ShieldAI HTTP API and SSE streaming endpoints.

## Base URL

```
http://localhost:8484
```

## Authentication

All API routes (except `/api/health`) are protected by Bearer token authentication if `SHIELDAI_TOKEN` environment variable is set.

Include the token in the `Authorization` header:

```bash
Authorization: Bearer <your-token>
```

## Endpoints

### Health Check

**GET** `/api/health`

Returns server health status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

---

### Get Containers

**GET** `/api/containers`

Returns a list of all Docker containers (running and stopped).

**Response:**
```json
[
  {
    "id": "abc123",
    "name": "nginx",
    "image": "nginx:latest",
    "status": "running",
    "privileged": false,
    "ports": [...],
    "networks": ["bridge"],
    ...
  }
]
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized (if auth is enabled)
- `500` - Failed to collect containers

---

### Get Infrastructure

**GET** `/api/infrastructure`

Returns complete Docker infrastructure context including containers, networks, volumes, and compose files.

**Response:**
```json
{
  "containers": [...],
  "networks": [...],
  "volumes": [...],
  "dockerVersion": "24.0.0",
  "os": "Linux (linux)",
  "totalContainers": 5,
  "composeFiles": [...],
  "collectedAt": "2024-01-01T00:00:00.000Z"
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `500` - Failed to collect infrastructure

---

### Run Security Audit (SSE)

**POST** `/api/audit`

Streams security audit results via Server-Sent Events (SSE).

**Flow:**
1. Collects infrastructure context
2. Runs quick security checks
3. Streams quick findings
4. Runs deep Opus analysis
5. Streams Opus findings
6. Streams good practices
7. Sends final summary with security score

**Request:**
```bash
curl -N -H "Authorization: Bearer <token>" \
  -X POST http://localhost:8484/api/audit
```

**SSE Event Format:**

Each event is sent as:
```
data: <json>\n\n
```

**Event Types:**

**Finding Event:**
```json
{
  "type": "finding",
  "data": {
    "id": "finding-1",
    "severity": "high",
    "category": "privileged mode",
    "title": "Container running in privileged mode",
    "container": "nginx",
    "description": "...",
    "risk": "...",
    "fix": {...},
    "source": "quick_check"
  }
}
```

**Good Practice Event:**
```json
{
  "type": "good-practice",
  "data": {
    "id": "practice-1",
    "category": "resource limits",
    "title": "Memory limits configured",
    "description": "...",
    "appliesTo": ["nginx", "redis"]
  }
}
```

**Complete Event:**
```json
{
  "type": "complete",
  "data": {
    "overallScore": 85,
    "scoreExplanation": "...",
    "findings": [...],
    "goodPractices": [...],
    "architecturalRecommendations": [...],
    "auditedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Event:**
```json
{
  "type": "error",
  "error": "Error message"
}
```

**Stream Termination:**
```
data: [DONE]
```

**Status Codes:**
- `200` - Stream started (status sent before stream begins)
- `401` - Unauthorized

---

### Preview Fix

**POST** `/api/fix/preview`

Generates a diff preview of what changes would be made to apply a fix.

**Request Body:**
```json
{
  "findingId": "finding-1"
}
```

**Response:**
```json
{
  "before": "...",
  "after": "...",
  "diff": [
    { "value": "  image: nginx:latest\n", "removed": true },
    { "value": "  image: nginx:1.21\n", "added": true }
  ],
  "sideEffects": "Container will be recreated",
  "composePath": "/configs/docker-compose.yml"
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid request body
- `401` - Unauthorized
- `404` - Finding not found
- `500` - Failed to generate preview

---

### Apply Fix

**POST** `/api/fix/apply`

Applies a security fix to the Docker configuration.

**Request Body:**
```json
{
  "findingId": "finding-1"
}
```

**Response:**
```json
{
  "success": true,
  "backupPath": "/backups/docker-compose.yml.backup.1234567890",
  "containerRestarted": "nginx",
  "appliedAt": "2024-01-01T00:00:00.000Z"
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid request body
- `401` - Unauthorized
- `404` - Finding not found
- `500` - Failed to apply fix

---

### Chat with AI (SSE)

**POST** `/api/chat`

Streams conversational AI responses about your Docker infrastructure via SSE.

**Request Body:**
```json
{
  "message": "How can I improve the security of my nginx container?",
  "history": [
    {
      "role": "user",
      "content": "What containers are running?",
      "timestamp": "2024-01-01T00:00:00.000Z"
    },
    {
      "role": "assistant",
      "content": "You have 5 containers running...",
      "timestamp": "2024-01-01T00:00:01.000Z"
    }
  ]
}
```

**Request:**
```bash
curl -N -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"message": "What is my infrastructure?", "history": []}' \
  http://localhost:8484/api/chat
```

**SSE Event Format:**

**Chunk Event:**
```json
{
  "type": "chunk",
  "content": "Your nginx container is running in"
}
```

**Done Event:**
```json
{
  "type": "done"
}
```

**Error Event:**
```json
{
  "type": "error",
  "error": "Error message"
}
```

**Stream Termination:**
```
data: [DONE]
```

**Status Codes:**
- `200` - Stream started
- `400` - Invalid request body
- `401` - Unauthorized

---

## SSE Client Examples

### JavaScript/TypeScript

```typescript
const eventSource = new EventSource('/api/audit', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

eventSource.onmessage = (event) => {
  if (event.data === '[DONE]') {
    eventSource.close();
    return;
  }

  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'finding':
      console.log('Finding:', data.data);
      break;
    case 'good-practice':
      console.log('Good practice:', data.data);
      break;
    case 'complete':
      console.log('Audit complete:', data.data);
      break;
    case 'error':
      console.error('Error:', data.error);
      break;
  }
};

eventSource.onerror = (error) => {
  console.error('Stream error:', error);
  eventSource.close();
};
```

### cURL

```bash
# Stream audit results
curl -N -H "Authorization: Bearer <token>" \
  -X POST http://localhost:8484/api/audit

# Stream chat responses
curl -N -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"message": "Hello", "history": []}' \
  http://localhost:8484/api/chat
```

---

## Error Response Format

All error responses follow this format:

```json
{
  "error": "Error message",
  "details": "Detailed error information",
  "statusCode": 500
}
```

Common status codes:
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing or invalid token)
- `404` - Not Found (resource not found)
- `500` - Internal Server Error

---

## Security Score Calculation

The security score ranges from 0-100 (higher is better) and is calculated based on finding severities:

- **Critical**: -25 points per finding
- **High**: -15 points per finding
- **Medium**: -8 points per finding
- **Low**: -3 points per finding
- **Info**: -1 point per finding

The score is capped at 0 (minimum) and 100 (maximum).

---

## Rate Limiting

Currently, no rate limiting is implemented. In production, consider adding rate limiting middleware to prevent abuse.

---

## CORS Configuration

- **Development**: All origins allowed
- **Production**: Same-origin only

---

## Server Configuration

Environment variables:

- `SHIELDAI_PORT` - Server port (default: 8484)
- `SHIELDAI_TOKEN` - Bearer token for authentication (optional)
- `HOST` - Server host (default: 0.0.0.0)
- `NODE_ENV` - Environment mode (development/production)
- `LOG_LEVEL` - Log level (default: info)
