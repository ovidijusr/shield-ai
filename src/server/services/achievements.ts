/**
 * Achievements Service
 *
 * Gamification system with unlockable achievements.
 * Tracks user progress and rewards security improvements.
 */

import Database from 'better-sqlite3';
import { resolve } from 'path';
import type { AuditResult } from '@shared/types.js';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // Emoji or icon identifier
  unlocked: boolean;
  unlockedAt?: Date;
  progress?: number; // 0-100 for achievements with progress tracking
  total?: number; // For achievements like "Apply 10 fixes"
}

/**
 * Achievement definitions
 */
const ACHIEVEMENT_DEFINITIONS: Omit<Achievement, 'unlocked' | 'unlockedAt'>[] = [
  {
    id: 'first-scan',
    title: 'First Steps',
    description: 'Completed your first security scan',
    icon: '🔍',
  },
  {
    id: 'score-50',
    title: 'Getting Started',
    description: 'Reached security score of 50+',
    icon: '⭐',
  },
  {
    id: 'score-70',
    title: 'Security Conscious',
    description: 'Reached security score of 70+',
    icon: '🛡️',
  },
  {
    id: 'score-90',
    title: 'Security Expert',
    description: 'Reached security score of 90+',
    icon: '🏆',
  },
  {
    id: 'score-100',
    title: 'Flawless',
    description: 'Achieved perfect 100/100 security score',
    icon: '💎',
  },
  {
    id: 'first-fix',
    title: 'Fixer',
    description: 'Applied your first security fix',
    icon: '🔧',
  },
  {
    id: 'fix-master',
    title: 'Hardening Master',
    description: 'Applied 10 security fixes',
    icon: '🎯',
  },
];

/**
 * Database manager for achievements
 */
class AchievementsDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  /**
   * Create achievements table if it doesn't exist
   */
  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS achievements (
        id TEXT PRIMARY KEY,
        unlocked_at DATETIME,
        metadata TEXT
      )
    `);

    // Create fix tracking table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS fix_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        finding_id TEXT NOT NULL,
        fixed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  /**
   * Check if achievement is unlocked
   */
  isUnlocked(achievementId: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM achievements WHERE id = ?').get(achievementId);
    return !!row;
  }

  /**
   * Get unlock date for an achievement
   */
  getUnlockDate(achievementId: string): Date | null {
    const row = this.db.prepare('SELECT unlocked_at FROM achievements WHERE id = ?').get(achievementId) as
      | { unlocked_at: string }
      | undefined;
    return row ? new Date(row.unlocked_at) : null;
  }

  /**
   * Unlock an achievement
   */
  unlock(achievementId: string, metadata: any = {}): void {
    if (this.isUnlocked(achievementId)) {
      return; // Already unlocked
    }

    this.db.prepare('INSERT INTO achievements (id, unlocked_at, metadata) VALUES (?, datetime("now"), ?)').run(
      achievementId,
      JSON.stringify(metadata)
    );

    console.log(`[Achievements] Unlocked: ${achievementId}`);
  }

  /**
   * Get count of applied fixes
   */
  getFixCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM fix_history').get() as { count: number };
    return row.count;
  }

  /**
   * Record a fix
   */
  recordFix(findingId: string): void {
    this.db.prepare('INSERT INTO fix_history (finding_id) VALUES (?)').run(findingId);
  }

  close(): void {
    this.db.close();
  }
}

/**
 * Achievements Service
 */
export class AchievementsService {
  private db: AchievementsDatabase;

  constructor(dbPath: string = resolve(process.cwd(), 'data', 'shieldai.db')) {
    this.db = new AchievementsDatabase(dbPath);
  }

  /**
   * Get all achievements with their unlock status
   */
  async getAllAchievements(): Promise<Achievement[]> {
    return ACHIEVEMENT_DEFINITIONS.map((def) => {
      const unlocked = this.db.isUnlocked(def.id);
      const unlockedAt = unlocked ? this.db.getUnlockDate(def.id) || undefined : undefined;

      // Add progress for fix-master achievement
      let progress: number | undefined;
      let total: number | undefined;
      if (def.id === 'fix-master') {
        const fixCount = this.db.getFixCount();
        total = 10;
        progress = Math.min(100, (fixCount / 10) * 100);
      }

      return {
        ...def,
        unlocked,
        unlockedAt,
        progress,
        total,
      };
    });
  }

  /**
   * Check and unlock achievements based on audit result
   */
  async checkAndUnlockAchievements(result: AuditResult): Promise<Achievement[]> {
    const newlyUnlocked: Achievement[] = [];
    const score = result.overallScore ?? 0;

    // First scan achievement
    if (!this.db.isUnlocked('first-scan')) {
      this.db.unlock('first-scan', { score });
      newlyUnlocked.push(await this.getAchievement('first-scan'));
    }

    // Score-based achievements
    const scoreAchievements = [
      { id: 'score-50', threshold: 50 },
      { id: 'score-70', threshold: 70 },
      { id: 'score-90', threshold: 90 },
      { id: 'score-100', threshold: 100 },
    ];

    for (const { id, threshold } of scoreAchievements) {
      if (score >= threshold && !this.db.isUnlocked(id)) {
        this.db.unlock(id, { score, threshold });
        newlyUnlocked.push(await this.getAchievement(id));
      }
    }

    return newlyUnlocked;
  }

  /**
   * Record a fix and check fix-related achievements
   */
  async recordFix(findingId: string): Promise<Achievement[]> {
    const newlyUnlocked: Achievement[] = [];

    this.db.recordFix(findingId);
    const fixCount = this.db.getFixCount();

    // First fix achievement
    if (fixCount === 1 && !this.db.isUnlocked('first-fix')) {
      this.db.unlock('first-fix', { fixCount });
      newlyUnlocked.push(await this.getAchievement('first-fix'));
    }

    // Fix master achievement
    if (fixCount >= 10 && !this.db.isUnlocked('fix-master')) {
      this.db.unlock('fix-master', { fixCount });
      newlyUnlocked.push(await this.getAchievement('fix-master'));
    }

    return newlyUnlocked;
  }

  /**
   * Get a single achievement by ID
   */
  private async getAchievement(id: string): Promise<Achievement> {
    const def = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === id);
    if (!def) {
      throw new Error(`Achievement not found: ${id}`);
    }

    const unlocked = this.db.isUnlocked(id);
    const unlockedAt = unlocked ? this.db.getUnlockDate(id) || undefined : undefined;

    return {
      ...def,
      unlocked,
      unlockedAt,
    };
  }

  /**
   * Get count of unlocked achievements
   */
  async getUnlockedCount(): Promise<number> {
    const achievements = await this.getAllAchievements();
    return achievements.filter((a) => a.unlocked).length;
  }

  close(): void {
    this.db.close();
  }
}

// Export singleton instance
let achievementsServiceInstance: AchievementsService | null = null;

export function getAchievementsService(): AchievementsService {
  if (!achievementsServiceInstance) {
    achievementsServiceInstance = new AchievementsService();
  }
  return achievementsServiceInstance;
}
