/**
 * System Status Routes
 *
 * Provides system health information for warning banner display.
 * Checks API key configuration and Docker daemon connectivity.
 */

import type { FastifyInstance } from 'fastify';
import type { SystemStatus, DashboardStats } from '@shared/types.js';
import { dockerPing } from '../services/collector.js';
import { getLastAuditResult } from './chat.js';
import Docker from 'dockerode';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Register status routes
 */
export async function statusRoutes(app: FastifyInstance) {
  /**
   * GET /api/status
   * Returns system status for warning banner
   * Always returns 200 - this is a status report, not an error
   */
  app.get<{ Reply: SystemStatus }>('/api/status', async () => {
    const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
    const dockerReachable = await dockerPing();

    return {
      apiKey: {
        ok: hasApiKey,
        message: hasApiKey
          ? undefined
          : 'ANTHROPIC_API_KEY is not set. AI analysis features will not work.',
      },
      docker: {
        ok: dockerReachable,
        message: dockerReachable
          ? undefined
          : 'Cannot connect to Docker daemon. Ensure Docker is running and accessible.',
      },
      checkedAt: new Date().toISOString(),
    };
  });

  /**
   * GET /api/stats
   * Returns dashboard statistics (container counts, exposed ports, etc.)
   */
  app.get<{ Reply: DashboardStats }>('/api/stats', async () => {
    try {
      const docker = new Docker();

      // Get all containers
      const containers = await docker.listContainers({ all: true });
      const runningContainers = containers.filter(c => c.State === 'running');

      // Count exposed ports
      let exposedPorts = 0;
      for (const container of runningContainers) {
        if (container.Ports) {
          exposedPorts += container.Ports.filter(p => p.PublicPort).length;
        }
      }

      // Get networks and volumes
      const networks = await docker.listNetworks();
      const volumes = await docker.listVolumes();

      // Get last audit result from cache
      const lastAudit = getLastAuditResult();

      return {
        totalContainers: containers.length,
        runningContainers: runningContainers.length,
        totalNetworks: networks.length,
        totalVolumes: volumes.Volumes?.length || 0,
        exposedPorts,
        lastScore: lastAudit?.overallScore ?? null,
        lastAuditAt: lastAudit?.auditedAt ?? null,
      };
    } catch (error) {
      app.log.error({ error }, 'Failed to get dashboard stats');

      // Return empty stats on error
      return {
        totalContainers: 0,
        runningContainers: 0,
        totalNetworks: 0,
        totalVolumes: 0,
        exposedPorts: 0,
        lastScore: null,
        lastAuditAt: null,
      };
    }
  });

  /**
   * GET /api/backups
   * Returns list of backup files
   */
  app.get('/api/backups', async () => {
    try {
      const backupDir = '/backups';

      // Create backup directory if it doesn't exist
      await fs.mkdir(backupDir, { recursive: true });

      // Read directory contents
      const files = await fs.readdir(backupDir);

      // Get file stats for each backup
      const backups = await Promise.all(
        files.map(async (filename) => {
          const filepath = path.join(backupDir, filename);
          const stats = await fs.stat(filepath);

          return {
            filename,
            path: filepath,
            size: stats.size,
            createdAt: stats.birthtime.toISOString(),
            modifiedAt: stats.mtime.toISOString(),
          };
        })
      );

      // Sort by creation time (newest first)
      backups.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return backups;
    } catch (error) {
      app.log.error({ error }, 'Failed to list backups');

      return {
        error: 'Failed to list backups',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
