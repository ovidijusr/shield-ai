/**
 * ShieldAI Shared Types
 *
 * This file contains all shared type definitions used across client and server.
 * These types define the core data structures for Docker infrastructure analysis,
 * security findings, fixes, and audit results.
 */

// ============================================================================
// Docker Infrastructure Types
// ============================================================================

export interface PortMapping {
  /** Container internal port */
  containerPort: number;
  /** Host port (if exposed) */
  hostPort: number | null;
  /** Protocol (tcp, udp) */
  protocol: string;
  /** Host IP (0.0.0.0 means exposed to internet) */
  hostIp: string;
}

export interface Mount {
  /** Source path on host */
  source: string;
  /** Destination path in container */
  destination: string;
  /** Mount type (bind, volume, tmpfs) */
  type: string;
  /** Read-only flag */
  readOnly: boolean;
  /** Propagation mode */
  propagation: string;
}

export interface Volume {
  /** Volume name */
  name: string;
  /** Source path on host (for bind mounts) */
  source: string;
  /** Destination path in container */
  destination: string;
  /** Driver type */
  driver: string;
  /** Read-only flag */
  readOnly: boolean;
}

export interface Healthcheck {
  /** Test command */
  test: string[];
  /** Interval between checks */
  interval: number;
  /** Timeout for each check */
  timeout: number;
  /** Number of retries before unhealthy */
  retries: number;
  /** Start period before checks begin */
  startPeriod: number;
}

export interface ContainerInfo {
  /** Container ID */
  id: string;
  /** Container name (without leading /) */
  name: string;
  /** Image name and tag */
  image: string;
  /** Container status (running, exited, etc.) */
  status: string;
  /** Creation timestamp */
  created: string;
  /** User the container runs as (root is concerning) */
  user: string;
  /** Whether container has privileged mode */
  privileged: boolean;
  /** Linux capabilities */
  capabilities: string[];
  /** Whether root filesystem is read-only */
  readOnlyRootfs: boolean;
  /** Port mappings */
  ports: PortMapping[];
  /** Network names the container is connected to */
  networks: string[];
  /** Network mode (bridge, host, none, container:...) */
  networkMode: string;
  /** Mounts (bind mounts, volumes, tmpfs) */
  mounts: Mount[];
  /** Volumes */
  volumes: Volume[];
  /** Environment variables */
  env: string[];
  /** Memory limit in bytes (0 = unlimited) */
  memoryLimit: number;
  /** CPU limit (0 = unlimited) */
  cpuLimit: number;
  /** Healthcheck configuration */
  healthcheck: Healthcheck | null;
  /** Restart policy (no, always, on-failure, unless-stopped) */
  restartPolicy: string;
  /** Labels applied to container */
  labels: Record<string, string>;
}

export interface NetworkInfo {
  /** Network name */
  name: string;
  /** Network driver (bridge, overlay, host, etc.) */
  driver: string;
  /** Container IDs connected to this network */
  containers: string[];
  /** Whether network is internal (not connected to external networks) */
  internal: boolean;
  /** Whether IPv6 is enabled */
  enableIPv6: boolean;
  /** Network ID */
  id: string;
  /** Network scope (local, global, swarm) */
  scope: string;
}

export interface VolumeInfo {
  /** Volume name */
  name: string;
  /** Volume driver */
  driver: string;
  /** Mount point on host */
  mountPoint: string;
  /** Container names using this volume */
  usedBy: string[];
  /** Volume scope */
  scope: string;
  /** Volume labels */
  labels: Record<string, string>;
}

export interface ComposeFile {
  /** Path to compose file */
  path: string;
  /** Raw YAML content */
  content: string;
  /** Service names defined in compose file */
  services: string[];
  /** Last modified timestamp */
  lastModified: string;
}

/**
 * Complete Docker infrastructure context collected from Docker API
 * and filesystem. This is sent to Claude Opus for analysis.
 */
export interface DockerInfraContext {
  /** All containers (running and stopped) */
  containers: ContainerInfo[];
  /** All networks */
  networks: NetworkInfo[];
  /** All volumes */
  volumes: VolumeInfo[];
  /** Docker daemon version */
  dockerVersion: string;
  /** Host operating system */
  os: string;
  /** Total number of containers */
  totalContainers: number;
  /** Docker Compose files found in mounted /configs */
  composeFiles: ComposeFile[];
  /** Timestamp when context was collected */
  collectedAt: string;
}

// ============================================================================
// Security Finding Types
// ============================================================================

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type FixType = 'compose_replace' | 'docker_command' | 'manual';

export interface Fix {
  /** Human-readable description of the fix */
  description: string;
  /** Type of fix to apply */
  type: FixType;
  /** Path to compose file (for compose_replace type) */
  composePath: string | null;
  /** Complete corrected file content (for compose_replace type) */
  newFileContent: string | null;
  /** Docker commands to run (for docker_command type) */
  commands: string[] | null;
  /** Side effects of applying this fix */
  sideEffects: string;
  /** Whether container needs restart after fix */
  requiresRestart: boolean;
}

/**
 * A security finding identified during audit.
 * Can come from quick checks or deep AI analysis.
 */
export interface Finding {
  /** Unique finding ID */
  id: string;
  /** Severity level */
  severity: Severity;
  /** Category (e.g., "privileged mode", "exposed ports") */
  category: string;
  /** Short title */
  title: string;
  /** Container name (null for infrastructure-wide findings) */
  container: string | null;
  /** Detailed description specific to this setup */
  description: string;
  /** Risk explanation with specific blast radius */
  risk: string;
  /** How to fix this finding */
  fix: Fix;
  /** Source of finding (quick_check or opus_analysis) */
  source: 'quick_check' | 'opus_analysis';
}

export interface GoodPractice {
  /** Unique ID */
  id: string;
  /** Category of good practice */
  category: string;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Affected containers or infrastructure */
  appliesTo: string[];
}

export interface ArchitecturalRecommendation {
  /** Unique ID */
  id: string;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Impact of implementing this */
  impact: string;
  /** Complexity level (low, medium, high) */
  complexity: 'low' | 'medium' | 'high';
}

/**
 * Complete audit result with score, findings, and recommendations.
 * This is what Claude Opus returns after analyzing infrastructure.
 */
export interface AuditResult {
  /** Overall security score (0-100, higher is better, null if analysis incomplete) */
  overallScore: number | null;
  /** Explanation of the score */
  scoreExplanation: string;
  /** Security findings */
  findings: Finding[];
  /** Things the user is doing right */
  goodPractices: GoodPractice[];
  /** High-level architectural recommendations */
  architecturalRecommendations: ArchitecturalRecommendation[];
  /** Timestamp of audit */
  auditedAt: string;
}

// ============================================================================
// Fix Preview and Application Types
// ============================================================================

export interface DiffLine {
  /** Line value */
  value: string;
  /** Whether this line was added */
  added?: boolean;
  /** Whether this line was removed */
  removed?: boolean;
  /** Number of lines in this change */
  count?: number;
}

/**
 * Diff preview before applying a fix
 */
export interface DiffPreview {
  /** Original file content */
  before: string;
  /** New file content */
  after: string;
  /** Diff lines for display */
  diff: DiffLine[];
  /** Side effects warning */
  sideEffects: string;
  /** Path to compose file being modified */
  composePath: string;
}

/**
 * Result of applying a fix
 */
export interface FixResult {
  /** Whether fix was successfully applied */
  success: boolean;
  /** Path to backup file */
  backupPath: string;
  /** Error message if failed */
  error?: string;
  /** Container name that was restarted */
  containerRestarted?: string;
  /** Timestamp of fix application */
  appliedAt?: string;
}

// ============================================================================
// Chat Types
// ============================================================================

export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  /** Message role */
  role: MessageRole;
  /** Message content */
  content: string;
  /** Timestamp */
  timestamp: string;
}

export interface ChatRequest {
  /** User's message */
  message: string;
  /** Conversation history */
  history: ChatMessage[];
}

export interface ChatResponse {
  /** Assistant's response */
  content: string;
  /** Whether response is complete */
  done: boolean;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiError {
  /** Error message */
  error: string;
  /** Error details */
  details?: string;
  /** Status code */
  statusCode: number;
}

export interface SystemStatusCheck {
  ok: boolean;
  message?: string;
}

export interface SystemStatus {
  apiKey: SystemStatusCheck;
  docker: SystemStatusCheck;
  checkedAt: string;
}

export interface ContainerStatus {
  /** Container name */
  name: string;
  /** Current status */
  status: string;
  /** Health status (if healthcheck is configured) */
  health?: string;
  /** Uptime in seconds */
  uptime: number;
}

export interface DashboardStats {
  /** Total containers */
  totalContainers: number;
  /** Running containers */
  runningContainers: number;
  /** Total networks */
  totalNetworks: number;
  /** Total volumes */
  totalVolumes: number;
  /** Exposed ports count */
  exposedPorts: number;
  /** Last audit score (null if never audited) */
  lastScore: number | null;
  /** Last audit timestamp */
  lastAuditAt: string | null;
}

export interface BackupInfo {
  /** Backup timestamp */
  timestamp: string;
  /** Path to backup directory */
  path: string;
  /** Files backed up */
  files: string[];
  /** Finding ID that triggered this backup */
  findingId: string;
}

// ============================================================================
// Quick Check Types
// ============================================================================

export type QuickCheckCategory = 'critical' | 'warning' | 'info';

export interface QuickCheckDefinition {
  /** Check ID */
  id: string;
  /** Category */
  category: QuickCheckCategory;
  /** Check title */
  title: string;
  /** Check description */
  description: string;
  /** Check function */
  check: (context: DockerInfraContext) => QuickCheckResult[];
}

export interface QuickCheckResult {
  /** Check ID */
  checkId: string;
  /** Whether check passed */
  passed: boolean;
  /** Affected containers */
  affectedContainers: string[];
  /** Details */
  details: string;
}

// ============================================================================
// Streaming Types
// ============================================================================

export type StreamEventType = 'finding' | 'good-practice' | 'complete' | 'error';

export interface StreamEvent {
  /** Event type */
  type: StreamEventType;
  /** Event payload (for finding, good-practice, or complete events) */
  data?: Finding | GoodPractice | AuditResult;
  /** Error message (for error type) */
  error?: string;
}
