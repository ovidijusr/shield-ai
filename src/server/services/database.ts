/**
 * Database Service - SQLite-based audit storage
 *
 * Provides persistent storage for audit results with full history tracking.
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Finding, GoodPractice } from '../../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database file location
const DB_DIR = join(__dirname, '../../../data');
const DB_PATH = join(DB_DIR, 'shieldai.db');

// Ensure data directory exists
if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

/**
 * Audit record stored in database
 */
export interface AuditRecord {
  id: string;
  timestamp: number;
  findings: Finding[];
  goodPractices: GoodPractice[];
  quickCheckCount: number;
  opusCheckCount: number;
  score: number | null;
  duration: number; // milliseconds
  containerCount: number;
  networkCount: number;
  volumeCount: number;
}

/**
 * Initialize database schema
 */
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audits (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      findings TEXT NOT NULL,
      good_practices TEXT NOT NULL,
      quick_check_count INTEGER NOT NULL,
      opus_check_count INTEGER NOT NULL,
      score INTEGER,
      duration INTEGER NOT NULL,
      container_count INTEGER NOT NULL,
      network_count INTEGER NOT NULL,
      volume_count INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_audits_timestamp ON audits(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_audits_created_at ON audits(created_at DESC);
  `);
}

// Initialize schema on module load
initSchema();

/**
 * Save audit result to database
 */
export function saveAudit(audit: AuditRecord): void {
  const stmt = db.prepare(`
    INSERT INTO audits (
      id, timestamp, findings, good_practices,
      quick_check_count, opus_check_count, score,
      duration, container_count, network_count, volume_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    audit.id,
    audit.timestamp,
    JSON.stringify(audit.findings),
    JSON.stringify(audit.goodPractices),
    audit.quickCheckCount,
    audit.opusCheckCount,
    audit.score,
    audit.duration,
    audit.containerCount,
    audit.networkCount,
    audit.volumeCount
  );
}

/**
 * Get audit by ID
 */
export function getAudit(id: string): AuditRecord | null {
  const stmt = db.prepare(`
    SELECT * FROM audits WHERE id = ?
  `);

  const row = stmt.get(id) as any;
  if (!row) return null;

  return {
    id: row.id,
    timestamp: row.timestamp,
    findings: JSON.parse(row.findings),
    goodPractices: JSON.parse(row.good_practices),
    quickCheckCount: row.quick_check_count,
    opusCheckCount: row.opus_check_count,
    score: row.score,
    duration: row.duration,
    containerCount: row.container_count,
    networkCount: row.network_count,
    volumeCount: row.volume_count,
  };
}

/**
 * List all audits (most recent first)
 */
export function listAudits(limit = 50, offset = 0): AuditRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM audits
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `);

  const rows = stmt.all(limit, offset) as any[];

  return rows.map(row => ({
    id: row.id,
    timestamp: row.timestamp,
    findings: JSON.parse(row.findings),
    goodPractices: JSON.parse(row.good_practices),
    quickCheckCount: row.quick_check_count,
    opusCheckCount: row.opus_check_count,
    score: row.score,
    duration: row.duration,
    containerCount: row.container_count,
    networkCount: row.network_count,
    volumeCount: row.volume_count,
  }));
}

/**
 * Get audit summary (without full findings/practices)
 */
export interface AuditSummary {
  id: string;
  timestamp: number;
  findingsCount: number;
  goodPracticesCount: number;
  quickCheckCount: number;
  opusCheckCount: number;
  score: number | null;
  duration: number;
  containerCount: number;
  networkCount: number;
  volumeCount: number;
}

/**
 * List audit summaries (lightweight, no full findings)
 */
export function listAuditSummaries(limit = 50, offset = 0): AuditSummary[] {
  const stmt = db.prepare(`
    SELECT
      id, timestamp, quick_check_count, opus_check_count, score,
      duration, container_count, network_count, volume_count,
      json_array_length(findings) as findings_count,
      json_array_length(good_practices) as good_practices_count
    FROM audits
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `);

  const rows = stmt.all(limit, offset) as any[];

  return rows.map(row => ({
    id: row.id,
    timestamp: row.timestamp,
    findingsCount: row.findings_count || 0,
    goodPracticesCount: row.good_practices_count || 0,
    quickCheckCount: row.quick_check_count,
    opusCheckCount: row.opus_check_count,
    score: row.score,
    duration: row.duration,
    containerCount: row.container_count,
    networkCount: row.network_count,
    volumeCount: row.volume_count,
  }));
}

/**
 * Delete audit by ID
 */
export function deleteAudit(id: string): boolean {
  const stmt = db.prepare('DELETE FROM audits WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Get audit statistics
 */
export interface AuditStats {
  totalAudits: number;
  totalFindings: number;
  averageScore: number | null;
  lastAuditTimestamp: number | null;
}

export function getAuditStats(): AuditStats {
  const stmt = db.prepare(`
    SELECT
      COUNT(*) as total_audits,
      SUM(json_array_length(findings)) as total_findings,
      AVG(score) as average_score,
      MAX(timestamp) as last_audit_timestamp
    FROM audits
  `);

  const row = stmt.get() as any;

  return {
    totalAudits: row.total_audits || 0,
    totalFindings: row.total_findings || 0,
    averageScore: row.average_score || null,
    lastAuditTimestamp: row.last_audit_timestamp || null,
  };
}

/**
 * Close database connection (for graceful shutdown)
 */
export function closeDatabase(): void {
  db.close();
}
