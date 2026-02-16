/**
 * Containers Routes
 *
 * Provides endpoints to query Docker infrastructure context
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { collectInfraContext } from '../services/collector.js';
import type { DockerInfraContext, ContainerInfo, NetworkInfo, VolumeInfo } from '@shared/types.js';

/**
 * Register container-related routes
 */
export async function containerRoutes(app: FastifyInstance) {
  /**
   * GET /api/containers
   * Returns list of all containers (running and stopped)
   */
  app.get(
    '/api/containers',
    async (
      _request: FastifyRequest,
      reply: FastifyReply
    ): Promise<ContainerInfo[]> => {
      try {
        const context = await collectInfraContext();
        return reply.send(context.containers);
      } catch (error) {
        app.log.error({ error }, 'Failed to collect containers');
        return reply.code(500).send({
          error: 'Failed to collect containers',
          details: error instanceof Error ? error.message : String(error),
          statusCode: 500,
        });
      }
    }
  );

  /**
   * GET /api/networks
   * Returns list of all Docker networks
   */
  app.get(
    '/api/networks',
    async (
      _request: FastifyRequest,
      reply: FastifyReply
    ): Promise<NetworkInfo[]> => {
      try {
        const context = await collectInfraContext();
        return reply.send(context.networks);
      } catch (error) {
        app.log.error({ error }, 'Failed to collect networks');
        return reply.code(500).send({
          error: 'Failed to collect networks',
          details: error instanceof Error ? error.message : String(error),
          statusCode: 500,
        });
      }
    }
  );

  /**
   * GET /api/volumes
   * Returns list of all Docker volumes
   */
  app.get(
    '/api/volumes',
    async (
      _request: FastifyRequest,
      reply: FastifyReply
    ): Promise<VolumeInfo[]> => {
      try {
        const context = await collectInfraContext();
        return reply.send(context.volumes);
      } catch (error) {
        app.log.error({ error }, 'Failed to collect volumes');
        return reply.code(500).send({
          error: 'Failed to collect volumes',
          details: error instanceof Error ? error.message : String(error),
          statusCode: 500,
        });
      }
    }
  );

  /**
   * GET /api/infrastructure
   * Returns full Docker infrastructure context
   */
  app.get(
    '/api/infrastructure',
    async (
      _request: FastifyRequest,
      reply: FastifyReply
    ): Promise<DockerInfraContext> => {
      try {
        const context = await collectInfraContext();
        return reply.send(context);
      } catch (error) {
        app.log.error({ error }, 'Failed to collect infrastructure context');
        return reply.code(500).send({
          error: 'Failed to collect infrastructure context',
          details: error instanceof Error ? error.message : String(error),
          statusCode: 500,
        });
      }
    }
  );
}
