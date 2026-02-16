/**
 * Score History Service
 *
 * Manages security score history and trends.
 * Provides data for score visualization and comparison.
 */

import type { AuditResult } from '@shared/types.js';
import { getScheduler } from './scheduler.js';

export interface ScoreHistoryEntry {
  id: number;
  timestamp: Date;
  score: number;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  triggerType: 'manual' | 'scheduled' | 'api';
}

export interface ScoreComparison {
  current: ScoreHistoryEntry | null;
  previous: ScoreHistoryEntry | null;
  delta: number;
  percentChange: number;
}

/**
 * Score History Service
 *
 * Thin wrapper around the scheduler's database manager.
 * Provides score-specific operations and formatting.
 */
export class ScoreHistoryService {
  /**
   * Save a score to history
   */
  async saveScore(result: AuditResult, _triggerType: 'manual' | 'scheduled' | 'api' = 'manual'): Promise<void> {
    const scheduler = getScheduler();
    scheduler.saveManualScan(result);
  }

  /**
   * Get score history for the last N days
   */
  async getHistory(days: number = 30): Promise<ScoreHistoryEntry[]> {
    const scheduler = getScheduler();
    const rawHistory = scheduler.getScanHistory(days * 3); // Get more to ensure we have enough

    // Convert database format to service format
    const history: ScoreHistoryEntry[] = rawHistory.map((entry) => ({
      id: entry.id,
      timestamp: new Date(entry.timestamp),
      score: entry.score,
      findingsCount: entry.findings_count,
      criticalCount: entry.critical_count,
      highCount: entry.high_count,
      mediumCount: entry.medium_count,
      lowCount: entry.low_count,
      triggerType: entry.trigger_type,
    }));

    // Filter to entries within the specified days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const filtered = history.filter((entry) => entry.timestamp >= cutoffDate);

    // Return in chronological order (oldest first) for charting
    return filtered.reverse();
  }

  /**
   * Get comparison between latest and previous scan
   */
  async getLatestComparison(): Promise<ScoreComparison> {
    const scheduler = getScheduler();
    const history = scheduler.getScanHistory(2);

    if (history.length === 0) {
      return {
        current: null,
        previous: null,
        delta: 0,
        percentChange: 0,
      };
    }

    const current: ScoreHistoryEntry = {
      id: history[0].id,
      timestamp: new Date(history[0].timestamp),
      score: history[0].score,
      findingsCount: history[0].findings_count,
      criticalCount: history[0].critical_count,
      highCount: history[0].high_count,
      mediumCount: history[0].medium_count,
      lowCount: history[0].low_count,
      triggerType: history[0].trigger_type,
    };

    if (history.length === 1) {
      return {
        current,
        previous: null,
        delta: 0,
        percentChange: 0,
      };
    }

    const previous: ScoreHistoryEntry = {
      id: history[1].id,
      timestamp: new Date(history[1].timestamp),
      score: history[1].score,
      findingsCount: history[1].findings_count,
      criticalCount: history[1].critical_count,
      highCount: history[1].high_count,
      mediumCount: history[1].medium_count,
      lowCount: history[1].low_count,
      triggerType: history[1].trigger_type,
    };

    const delta = current.score - previous.score;
    const percentChange = previous.score > 0 ? (delta / previous.score) * 100 : 0;

    return {
      current,
      previous,
      delta,
      percentChange,
    };
  }

  /**
   * Get the latest score entry
   */
  async getLatestScore(): Promise<ScoreHistoryEntry | null> {
    const scheduler = getScheduler();
    const history = scheduler.getScanHistory(1);

    if (history.length === 0) {
      return null;
    }

    return {
      id: history[0].id,
      timestamp: new Date(history[0].timestamp),
      score: history[0].score,
      findingsCount: history[0].findings_count,
      criticalCount: history[0].critical_count,
      highCount: history[0].high_count,
      mediumCount: history[0].medium_count,
      lowCount: history[0].low_count,
      triggerType: history[0].trigger_type,
    };
  }
}

// Export singleton instance
let scoreHistoryServiceInstance: ScoreHistoryService | null = null;

export function getScoreHistoryService(): ScoreHistoryService {
  if (!scoreHistoryServiceInstance) {
    scoreHistoryServiceInstance = new ScoreHistoryService();
  }
  return scoreHistoryServiceInstance;
}
