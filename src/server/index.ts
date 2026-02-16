/**
 * ShieldAI Server
 *
 * Fastify server with SSE support for streaming security audits and chat responses.
 * Provides Docker infrastructure inspection, security analysis, and automated fixes.
 */

import Fastify from 'fastify';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';

// Import configuration
import { loadConfig, displayConfig } from './config.js';

// Import route handlers
import { containerRoutes } from './routes/containers.js';
import { auditRoutes } from './routes/audit.js';
import { auditHistoryRoutes } from './routes/audit-history.js';
import { fixRoutes } from './routes/fix.js';
import { chatRoutes } from './routes/chat.js';
import { statusRoutes } from './routes/status.js';
import { scheduleRoutes } from './routes/schedule.js';
import { scoreHistoryRoutes } from './routes/score-history.js';

// Load and validate configuration with warnings for missing env vars
const config = loadConfig();
displayConfig(config);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Fastify with TypeScript typing
const app: FastifyInstance = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  },
  bodyLimit: 10485760, // 10MB for large infrastructure contexts
  requestIdLogLabel: 'reqId',
});

// ============================================================================
// CORS Configuration
// ============================================================================

await app.register(cors, {
  origin: (origin, callback) => {
    // Allow requests from Vite dev server in development
    if (process.env.NODE_ENV !== 'production') {
      callback(null, true);
      return;
    }

    // In production, only allow same-origin requests
    if (!origin) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
});

// ============================================================================
// Authentication Middleware
// ============================================================================

/**
 * Bearer token authentication middleware
 * Protects all /api/* routes if SHIELDAI_TOKEN is set
 */
app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
  const token = process.env.SHIELDAI_TOKEN;

  // Skip auth if no token is configured
  if (!token) {
    return;
  }

  // Only protect API routes
  if (!req.url.startsWith('/api')) {
    return;
  }

  // Allow health check and status without auth
  if (req.url === '/api/health' || req.url === '/api/status') {
    return;
  }

  // Verify bearer token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({
      error: 'Unauthorized',
      details: 'Missing or invalid authorization header',
      statusCode: 401,
    });
  }

  const providedToken = authHeader.replace('Bearer ', '');
  if (providedToken !== token) {
    return reply.code(401).send({
      error: 'Unauthorized',
      details: 'Invalid token',
      statusCode: 401,
    });
  }
});

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Global error handler
 */
app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
  app.log.error(
    {
      error,
      url: request.url,
      method: request.method,
    },
    'Unhandled error'
  );

  // Don't expose internal errors in production
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error.message;

  reply.status(error.statusCode || 500).send({
    error: 'Internal server error',
    details: message,
    statusCode: error.statusCode || 500,
  });
});

/**
 * 404 handler for API routes
 */
app.setNotFoundHandler((request, reply) => {
  if (request.url.startsWith('/api')) {
    reply.code(404).send({
      error: 'Not found',
      details: `Route ${request.method} ${request.url} not found`,
      statusCode: 404,
    });
  }
});

// ============================================================================
// Health Check
// ============================================================================

app.get('/api/health', async () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  };
});

// ============================================================================
// Register Route Handlers
// ============================================================================

await app.register(containerRoutes);
await app.register(auditRoutes);
await app.register(auditHistoryRoutes);
await app.register(fixRoutes);
await app.register(chatRoutes);
await app.register(statusRoutes);
await app.register(scheduleRoutes);
await app.register(scoreHistoryRoutes);

// ============================================================================
// Static File Serving (Production)
// ============================================================================

if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../client');

  await app.register(fastifyStatic, {
    root: clientPath,
    prefix: '/',
  });

  // Serve index.html for all non-API routes (SPA support)
  app.get('*', async (request, reply) => {
    if (!request.url.startsWith('/api')) {
      return reply.sendFile('index.html');
    }
  });
}

// ============================================================================
// Server Start
// ============================================================================

try {
  await app.listen({ port: config.port, host: config.host });

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🛡️  ShieldAI Server Running                                 ║
║                                                                ║
║   URL:      http://${config.host}:${config.port}                            ║
║   Mode:     ${config.nodeEnv}                        ║
║   Auth:     ${config.authEnabled ? 'Enabled' : 'Disabled'}                       ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  `);
} catch (err) {
  app.log.error(err, 'Failed to start server');
  process.exit(1);
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

const signals = ['SIGINT', 'SIGTERM'];

for (const signal of signals) {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);

    try {
      await app.close();
      app.log.info('Server closed successfully');
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  });
}
