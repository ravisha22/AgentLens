/**
 * AgentLens Type System v3
 * Shared between extension host (esbuild) and webview (Vite) via path alias.
 * No simulated/hardcoded values. Every type represents observable state.
 */

// ── Context Window ──────────────────────────────────────────────────────────

export type ContextZone = 'green' | 'yellow' | 'orange' | 'red';

export type DataAvailability = 'available' | 'partial' | 'unavailable';

export interface ContextBreakdown {
  systemPrompt: number;
  tools: number;
  mcpServers: number;
  conversationHistory: number;
  fileContext: number;
  other: number;
}

export interface ContextState {
  dataAvailability: DataAvailability;
  errorMessage?: string;
  dataSource?: string;

  modelId: string;
  modelName: string;
  modelFamily: string;
  modelVendor: string;
  maxInputTokens: number;
  maxOutputTokens: number;

  usedTokens: number;
  usagePercent: number;
  zone: ContextZone;

  breakdown?: ContextBreakdown;
  breakdownAvailable: boolean;
}

export interface ContextThresholds {
  warning: number;
  danger: number;
  critical: number;
}

// ── Agent Detection ─────────────────────────────────────────────────────────

export type AgentType = 'copilot' | 'claude-code' | 'cursor' | 'cline' | 'codex' | 'unknown';

export type AgentSessionState =
  | 'idle' | 'thinking' | 'executing' | 'tool-calling'
  | 'reading-files' | 'writing-code' | 'running-terminal'
  | 'waiting-approval' | 'compacting' | 'completed' | 'failed' | 'cancelled';

export interface DetectedModel {
  id: string;
  name: string;
  family: string;
  vendor: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  isActive: boolean;
}

export interface AgentSession {
  id: string;
  agentType: AgentType;
  state: AgentSessionState;
  startedAt: number;
  isActive: boolean;
  currentTask?: string;
  turnCount: number;
  toolCallCount: number;
  filesTouchedCount: number;
  filesTouched: string[];
  compactionCount: number;
  model?: DetectedModel;
  mode?: string;
}

export interface DetectedAgent {
  type: AgentType;
  displayName: string;
  isInstalled: boolean;
  extensionId?: string;
  sessions: AgentSession[];
  availableModels: DetectedModel[];
}

// ── File Tracking ───────────────────────────────────────────────────────────

export type FileVisibility = 'in-context' | 'modified' | 'always-present' | 'watched' | 'lost';

export type FileCategory =
  | 'architecture' | 'schema' | 'config' | 'agent-instructions'
  | 'test' | 'documentation' | 'api-contract' | 'requirements'
  | 'source' | 'other';

export interface TrackedFile {
  relativePath: string;
  absolutePath: string;
  visibility: FileVisibility;
  tokenCost: number;
  isCritical: boolean;
  isAlwaysPresent: boolean;
  trackingReason: 'auto-detected' | 'user-configured' | 'always-present' | 'modified' | 'agent-activity';
  category: FileCategory;
  lastSeenAt?: number;
  lostAt?: number;
  lastModifiedAt?: number;
}

// ── Documentation Health ────────────────────────────────────────────────────

export type DocHealth = 'healthy' | 'stale' | 'missing' | 'outdated' | 'incomplete';

export type DocType =
  | 'readme' | 'architecture-docs' | 'agent-instructions' | 'api-docs'
  | 'test-cases' | 'acceptance-criteria' | 'user-docs' | 'changelog'
  | 'runbook' | 'custom';

export interface DocRequirement {
  docType: DocType;
  displayName: string;
  patterns: string[];
  required: boolean;
  staleDays: number;
  expectedSections?: string[];
  minWordCount?: number;
  maintainer: 'human' | 'agent' | 'either';
}

export interface DocManifest {
  version: string;
  requirements: DocRequirement[];
}

export interface DocumentationItem {
  docType: DocType;
  displayName: string;
  filePath?: string;
  health: DocHealth;
  lastModified?: number;
  tokenCost?: number;
  inContext: boolean;
  daysSinceUpdate?: number;
  required: boolean;
  maintainer: 'human' | 'agent' | 'either';
  missingSections?: string[];
  wordCount?: number;
  minWordCount?: number;
  lastUpdatedByAgent?: boolean;
}

export interface DocumentationHealth {
  score: number;
  items: DocumentationItem[];
  healthyCount: number;
  attentionCount: number;
  missingCount: number;
  noDocs: boolean;       // true = no manifest file / no scan data at all
  allMissing?: boolean;  // true = manifest exists but every doc file is absent
  staleDocCount24h?: number; // count of existing docs not updated in >24h (issue 46)
}

// ── Compaction Events ───────────────────────────────────────────────────────

export interface CompactionEvent {
  timestamp: number;
  tokensBefore: number;
  tokensAfter: number;
  tokensFreed: number;
  filesLost: string[];
  sessionId: string;
  source: 'detected' | 'manual';
}

// ── Timeline ────────────────────────────────────────────────────────────────

export interface TimelineEvent {
  type: 'session-start' | 'model-change' | 'file-loaded' | 'file-lost'
    | 'compaction' | 'threshold-crossed' | 'tool-call' | 'agent-state-change'
    | 'doc-change' | 'error';
  timestamp: number;
  label: string;
  detail?: string;
  contextUsageAtTime?: number;
  zone?: ContextZone;
}

// ── Health Score ────────────────────────────────────────────────────────────

export interface HealthScore {
  overall: number;
  components: {
    contextEfficiency: number;
    criticalFilesCoverage: number;
    documentationHealth: number;
    sessionStability: number;
    agentResponsiveness: number;
  };
  color: string;
  label: string;
}

// ── Session History ─────────────────────────────────────────────────────────

export interface SessionSummary {
  id: string;
  agentType: AgentType;
  startedAt: number;
  endedAt?: number;
  model: string;
  peakContextUsage: number;
  compactionCount: number;
  turnCount: number;
  toolCallCount: number;
  filesTouchedCount: number;
}

// ── Dashboard State ─────────────────────────────────────────────────────────

export interface DashboardState {
  context: ContextState;
  agents: DetectedAgent[];
  trackedFiles: TrackedFile[];
  documentationHealth: DocumentationHealth;
  compactionEvents: CompactionEvent[];
  timeline: TimelineEvent[];
  healthScore: HealthScore;
  thresholds: ContextThresholds;
  pollIntervalMs: number;
  lastPollAt: number;
}

// ── Webview Messages ────────────────────────────────────────────────────────

export type WebviewMessage =
  | { type: 'requestRefresh' }
  | { type: 'injectFile'; filePath: string }
  | { type: 'toggleAlwaysPresent'; filePath: string }
  | { type: 'toggleCritical'; filePath: string }
  | { type: 'openFile'; filePath: string }
  | { type: 'expandFiles' }
  | { type: 'collapseFiles' }
  | { type: 'openDocManifest' }
  | { type: 'createDocManifest' }
  | { type: 'createDocFiles' }
  | { type: 'updateDocFiles' }
  | { type: 'updateDocFile'; docType: string }
  | { type: 'dismissCompactionAlert'; eventTimestamp: number }
  | { type: 'reInjectLostFiles' }
  | { type: 'requestSessionHistory' };

// ── Extension-to-Webview Messages ───────────────────────────────────────────

export type ExtensionMessage =
  | { type: 'stateUpdate'; state: DashboardState }
  | { type: 'sessionHistory'; sessions: SessionSummary[] };

// ── Extension Configuration ─────────────────────────────────────────────────

export interface AgentLensConfig {
  pollIntervalSeconds: number;
  criticalFiles: string[];
  alwaysPresentFiles: string[];
  alwaysPresentMaxPercent: number;
  autoInjectOnLoss: boolean;
  alertThresholds: ContextThresholds;
  autoDetectCriticalFiles: boolean;
  showStatusBar: boolean;
  visibleFileCount: number;
}
