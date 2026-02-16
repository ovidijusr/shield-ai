/**
 * Scan Scheduler Service
 *
 * Manages automatic scheduled security scans and scan history persistence.
 * Supports daily and weekly scan frequencies with configurable notification triggers.
 */

import Database from 'better-sqlite3';
import { CronJob } from 'cron';
import { resolve } from 'path';
import type { AuditResult, Finding } from '@shared/types.js';

export interface ScheduleConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'manual';
  time: string; // "02:00" for 2 AM
  dayOfWeek?: number; // 0-6 for weekly (0 = Sunday)
  notifyOnNewFindings: boolean;
  notifyOnScoreDrop: boolean;
  minimumScoreDrop: number; // Notify if score drops by X points
}

export interface ScanComparison {
  scoreDelta: number; // +5 or -10
  newFindings: Finding[];
  resolvedFindings: Finding[];
  persistentFindings: Finding[];
  summary: string;
}

export interface ScanHistoryEntry {
  id: number;
  timestamp: string;
  score: number;
  findings_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  trigger_type: 'manual' | 'scheduled' | 'api';
}

/**
 * Database manager for scan history and schedule configuration
 */
class DatabaseManager {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  /**
   * Create database tables if they don't exist
   */
  private initializeSchema(): void {
    // Scan history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scan_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        score INTEGER NOT NULL,
        findings_count INTEGER NOT NULL,
        critical_count INTEGER DEFAULT 0,
        high_count INTEGER DEFAULT 0,
        medium_count INTEGER DEFAULT 0,
        low_count INTEGER DEFAULT 0,
        result_json TEXT NOT NULL,
        trigger_type TEXT DEFAULT 'manual'
      )
    `);

    // Schedule configuration table (singleton)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schedule_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        enabled BOOLEAN DEFAULT 0,
        frequency TEXT DEFAULT 'weekly',
        time TEXT DEFAULT '02:00',
        day_of_week INTEGER,
        notify_on_new_findings BOOLEAN DEFAULT 1,
        notify_on_score_drop BOOLEAN DEFAULT 1,
        minimum_score_drop INTEGER DEFAULT 5
      )
    `);

    // Notification channels table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notification_channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        enabled BOOLEAN DEFAULT 0,
        config_json TEXT NOT NULL
      )
    `);

    // Insert default schedule config if not exists
    const hasConfig = this.db.prepare('SELECT COUNT(*) as count FROM schedule_config').get() as { count: number };
    if (hasConfig.count === 0) {
      this.db.prepare(`
        INSERT INTO schedule_config (id, enabled, frequency, time, day_of_week, notify_on_new_findings, notify_on_score_drop, minimum_score_drop)
        VALUES (1, 0, 'weekly', '02:00', 0, 1, 1, 5)
      `).run();
    }
  }

  /**
   * Save audit result to scan history
   */
  saveScanResult(result: AuditResult, triggerType: 'manual' | 'scheduled' | 'api' = 'manual'): void {
    const findings = result.findings || [];
    const criticalCount = findings.filter((f) => f.severity === 'critical').length;
    const highCount = findings.filter((f) => f.severity === 'high').length;
    const mediumCount = findings.filter((f) => f.severity === 'medium').length;
    const lowCount = findings.filter((f) => f.severity === 'low').length;

    this.db.prepare(`
      INSERT INTO scan_history (
        score, findings_count, critical_count, high_count, medium_count, low_count,
        result_json, trigger_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      result.overallScore ?? 0,
      findings.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      JSON.stringify(result),
      triggerType
    );
  }

  /**
   * Get scan history (last N scans)
   */
  getScanHistory(limit: number = 30): ScanHistoryEntry[] {
    return this.db.prepare(`
      SELECT id, timestamp, score, findings_count,
             critical_count, high_count, medium_count, low_count, trigger_type
      FROM scan_history
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit) as ScanHistoryEntry[];
  }

  /**
   * Get the two most recent scans for comparison
   */
  getLatestScans(): { current: AuditResult | null; previous: AuditResult | null } {
    const scans = this.db.prepare(`
      SELECT result_json
      FROM scan_history
      ORDER BY timestamp DESC
      LIMIT 2
    `).all() as Array<{ result_json: string }>;

    return {
      current: scans[0] ? JSON.parse(scans[0].result_json) : null,
      previous: scans[1] ? JSON.parse(scans[1].result_json) : null,
    };
  }

  /**
   * Get schedule configuration
   */
  getScheduleConfig(): ScheduleConfig {
    const row = this.db.prepare('SELECT * FROM schedule_config WHERE id = 1').get() as any;
    return {
      enabled: Boolean(row.enabled),
      frequency: row.frequency,
      time: row.time,
      dayOfWeek: row.day_of_week,
      notifyOnNewFindings: Boolean(row.notify_on_new_findings),
      notifyOnScoreDrop: Boolean(row.notify_on_score_drop),
      minimumScoreDrop: row.minimum_score_drop,
    };
  }

  /**
   * Save schedule configuration
   */
  saveScheduleConfig(config: ScheduleConfig): void {
    this.db.prepare(`
      UPDATE schedule_config
      SET enabled = ?,
          frequency = ?,
          time = ?,
          day_of_week = ?,
          notify_on_new_findings = ?,
          notify_on_score_drop = ?,
          minimum_score_drop = ?
      WHERE id = 1
    `).run(
      config.enabled ? 1 : 0,
      config.frequency,
      config.time,
      config.dayOfWeek ?? null,
      config.notifyOnNewFindings ? 1 : 0,
      config.notifyOnScoreDrop ? 1 : 0,
      config.minimumScoreDrop
    );
  }

  close(): void {
    this.db.close();
  }
}

/**
 * Scan Scheduler
 *
 * Manages scheduled security scans using cron jobs
 */
export class ScanScheduler {
  private cronJob: CronJob | null = null;
  private db: DatabaseManager;
  private onScanCallback: (() => Promise<AuditResult>) | null = null;
  private onScanCompleteCallback: ((comparison: ScanComparison) => Promise<void>) | null = null;

  constructor(dbPath: string = resolve(process.cwd(), 'data', 'shieldai.db')) {
    this.db = new DatabaseManager(dbPath);
  }

  /**
   * Set callback for running scans
   */
  onScan(callback: () => Promise<AuditResult>): void {
    this.onScanCallback = callback;
  }

  /**
   * Set callback for when scan completes (receives comparison result)
   */
  onScanComplete(callback: (comparison: ScanComparison) => Promise<void>): void {
    this.onScanCompleteCallback = callback;
  }

  /**
   * Start the scheduler with given configuration
   */
  async start(config: ScheduleConfig): Promise<void> {
    // Stop any existing job
    await this.stop();

    if (!config.enabled) {
      console.log('[Scheduler] Disabled, not starting');
      return;
    }

    // Build cron expression based on frequency
    const cronExpression = this.buildCronExpression(config);

    console.log(`[Scheduler] Starting with schedule: ${cronExpression}`);

    this.cronJob = new CronJob(
      cronExpression,
      async () => {
        console.log('[Scheduler] Triggering scheduled scan...');
        try {
          await this.runScheduledScan();
        } catch (error) {
          console.error('[Scheduler] Scan failed:', error);
        }
      },
      null, // onComplete
      true, // start
      'UTC' // timezone
    );
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('[Scheduler] Stopped');
    }
  }

  /**
   * Run a scheduled scan
   */
  async runScheduledScan(): Promise<AuditResult> {
    if (!this.onScanCallback) {
      throw new Error('No scan callback configured. Call onScan() first.');
    }

    // Run the scan
    const result = await this.onScanCallback();

    // Save to database
    this.db.saveScanResult(result, 'scheduled');

    // Compare with previous scan
    const { current, previous } = this.db.getLatestScans();
    if (current && previous) {
      const comparison = this.compareWithPrevious(current, previous);

      // Notify via callback
      if (this.onScanCompleteCallback) {
        await this.onScanCompleteCallback(comparison);
      }
    }

    return result;
  }

  /**
   * Compare current scan with previous scan
   */
  compareWithPrevious(current: AuditResult, previous: AuditResult): ScanComparison {
    const currentFindings = current.findings || [];
    const previousFindings = previous.findings || [];

    // Create maps by finding category+container for comparison
    const currentMap = new Map(
      currentFindings.map((f) => [`${f.category}:${f.container}:${f.title}`, f])
    );
    const previousMap = new Map(
      previousFindings.map((f) => [`${f.category}:${f.container}:${f.title}`, f])
    );

    // Identify new, resolved, and persistent findings
    const newFindings: Finding[] = [];
    const resolvedFindings: Finding[] = [];
    const persistentFindings: Finding[] = [];

    // Find new findings (in current but not in previous)
    for (const [key, finding] of currentMap) {
      if (!previousMap.has(key)) {
        newFindings.push(finding);
      } else {
        persistentFindings.push(finding);
      }
    }

    // Find resolved findings (in previous but not in current)
    for (const [key, finding] of previousMap) {
      if (!currentMap.has(key)) {
        resolvedFindings.push(finding);
      }
    }

    // Calculate score delta
    const currentScore = current.overallScore ?? 0;
    const previousScore = previous.overallScore ?? 0;
    const scoreDelta = currentScore - previousScore;

    // Generate summary
    let summary = '';
    if (newFindings.length > 0) {
      summary = `⚠️ ${newFindings.length} new issue${newFindings.length > 1 ? 's' : ''} detected`;
    } else if (resolvedFindings.length > 0) {
      summary = `✅ ${resolvedFindings.length} issue${resolvedFindings.length > 1 ? 's' : ''} resolved`;
    } else {
      summary = `✓ No changes detected`;
    }

    if (scoreDelta !== 0) {
      summary += ` (score ${scoreDelta > 0 ? '+' : ''}${scoreDelta})`;
    }

    return {
      scoreDelta,
      newFindings,
      resolvedFindings,
      persistentFindings,
      summary,
    };
  }

  /**
   * Build cron expression from schedule config
   */
  private buildCronExpression(config: ScheduleConfig): string {
    const [hour, minute] = config.time.split(':').map(Number);

    if (config.frequency === 'daily') {
      // Daily at specified time
      return `${minute} ${hour} * * *`;
    } else if (config.frequency === 'weekly') {
      // Weekly on specified day at specified time
      const day = config.dayOfWeek ?? 0;
      return `${minute} ${hour} * * ${day}`;
    } else {
      throw new Error(`Unsupported frequency: ${config.frequency}`);
    }
  }

  /**
   * Get schedule configuration
   */
  getScheduleConfig(): ScheduleConfig {
    return this.db.getScheduleConfig();
  }

  /**
   * Save schedule configuration and restart scheduler
   */
  async saveScheduleConfig(config: ScheduleConfig): Promise<void> {
    this.db.saveScheduleConfig(config);
    await this.start(config);
  }

  /**
   * Get scan history
   */
  getScanHistory(limit: number = 30): ScanHistoryEntry[] {
    return this.db.getScanHistory(limit);
  }

  /**
   * Save manual scan result
   */
  saveManualScan(result: AuditResult): void {
    this.db.saveScanResult(result, 'manual');
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// Export singleton instance
let schedulerInstance: ScanScheduler | null = null;

export function getScheduler(): ScanScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new ScanScheduler();
  }
  return schedulerInstance;
}
