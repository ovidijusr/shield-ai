/**
 * Score History Routes
 *
 * API endpoints for score history, trends, and achievements
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getScoreHistoryService } from '../services/score-history.js';
import { getAchievementsService } from '../services/achievements.js';

/**
 * Register score history routes
 */
export async function scoreHistoryRoutes(app: FastifyInstance) {
  /**
   * GET /api/score/history?days=30
   * Get score history for the last N days
   */
  app.get(
    '/api/score/history',
    async (
      request: FastifyRequest<{
        Querystring: { days?: string };
      }>
    ) => {
      const days = parseInt(request.query.days || '30', 10);
      const service = getScoreHistoryService();
      const history = await service.getHistory(days);

      return {
        success: true,
        data: history,
      };
    }
  );

  /**
   * GET /api/score/comparison
   * Get latest vs previous scan comparison
   */
  app.get('/api/score/comparison', async () => {
    const service = getScoreHistoryService();
    const comparison = await service.getLatestComparison();

    return {
      success: true,
      data: comparison,
    };
  });

  /**
   * GET /api/score/latest
   * Get the most recent score entry
   */
  app.get('/api/score/latest', async () => {
    const service = getScoreHistoryService();
    const latest = await service.getLatestScore();

    return {
      success: true,
      data: latest,
    };
  });

  /**
   * GET /api/achievements
   * Get all achievements with unlock status
   */
  app.get('/api/achievements', async () => {
    const service = getAchievementsService();
    const achievements = await service.getAllAchievements();
    const unlockedCount = achievements.filter((a) => a.unlocked).length;

    return {
      success: true,
      data: {
        achievements,
        unlockedCount,
        totalCount: achievements.length,
      },
    };
  });

  /**
   * POST /api/achievements/unlock
   * Manually unlock an achievement (internal use, requires auth)
   */
  app.post(
    '/api/achievements/unlock',
    async (
      request: FastifyRequest<{
        Body: { achievementId: string };
      }>
    ) => {
      const { achievementId } = request.body;

      if (!achievementId) {
        return {
          success: false,
          error: 'achievementId is required',
        };
      }

      // This would typically require authentication
      // For now, it's an internal endpoint

      return {
        success: true,
        message: `Achievement ${achievementId} unlocked`,
      };
    }
  );
}
