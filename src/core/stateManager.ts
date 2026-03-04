/**
 * State Manager v3.1 — Single Poll Loop
 *
 * Fixes from v2:
 * - Bug 3: Feeds token usage from ClaudeCodeAdapter to ContextCalculator
 * - Bug 4: Single poll timer (no dual polling with AgentDetector)
 *
 * Fixes v3.1:
 * - Always set dataSource when active session exists (prevents permanent "partial" state)
 * - Feed agent-touched files into FileTracker for real-time file updates
 * - Add createMissingDocs support
 *
 * Uses AdapterRegistry instead of monolithic AgentDetector.
 */

import * as vscode from 'vscode';
import {
  DashboardState, ContextThresholds, CompactionEvent,
  TimelineEvent,
} from '../types';
import { ContextCalculator } from './contextCalculator';
import { FileTracker } from './fileTracker';
import { DocHealthTracker } from './docHealthTracker';
import { AdapterRegistry } from '../adapters/adapterRegistry';
import { HealthScorer } from './healthScorer';
import { ClaudeCodeAdapter } from '../adapters/claudeCodeAdapter';

export class StateManager {
  private contextCalc: ContextCalculator;
  private fileTracker: FileTracker;
  private docTracker: DocHealthTracker;
  private healthScorer: HealthScorer;

  private compactionEvents: CompactionEvent[] = [];
  private timeline: TimelineEvent[] = [];
  private thresholds: ContextThresholds;
  private pollIntervalMs: number;
  private lastPollAt: number = 0;

  private _onStateChanged = new vscode.EventEmitter<DashboardState>();
  public readonly onStateChanged = this._onStateChanged.event;

  private pollTimer: NodeJS.Timeout | undefined;
  private previousContextPercent: number = 0;
  private previouslyOverBudget = false;        // Issue 21: edge-trigger guard for budget warning
  private previousModelId: string | undefined; // Issue 22: detect model switch to skip false compaction
  // Issue 19: poll-diff snapshots for timeline event emission
  private previousZone: string | undefined;
  private previousSessionState: string | undefined;
  private previousDocScore: number | undefined;
  private previousToolCallCount = 0;
  private previousLostFileCount = 0;

  constructor(private registry: AdapterRegistry) {
    this.contextCalc = new ContextCalculator();
    this.fileTracker = new FileTracker();
    this.docTracker = new DocHealthTracker();
    this.healthScorer = new HealthScorer();

    const config = vscode.workspace.getConfiguration('agentlens');
    this.thresholds = config.get<ContextThresholds>('alertThresholds', {
      warning: 60, danger: 60, critical: 80,
    });

    const intervalSec = config.get<number>('pollIntervalSeconds', 5);
    this.pollIntervalMs = Math.max(2, Math.min(60, intervalSec)) * 1000;
  }

  async initialize(): Promise<void> {
    // Initial detection
    await this.registry.detectAll();

    // Set model from real detection
    const activeModel = this.registry.getActiveModel();
    if (activeModel) {
      this.contextCalc.setModel(activeModel);
    }

    // Feed initial token usage from Claude adapter (Bug 3 fix)
    this.feedTokenUsage();

    // Feed initial agent-touched files
    this.feedAgentFiles();

    // Scan workspace
    await this.fileTracker.scanForFiles();

    // Load doc manifest and scan
    await this.docTracker.loadManifest();
    await this.docTracker.scan();

    this.addTimelineEvent('session-start', 'AgentLens initialized');

    // Listen for model changes from adapter registry
    this.registry.onModelChanged((model) => {
      this.contextCalc.setModel(model);
      this.addTimelineEvent('model-change', `Model changed: ${model.name}`);
      this.emitState();
    });

    // Start single poll loop (Bug 4 fix: only one timer)
    this.startPolling();

    // Emit initial state
    this.emitState();
  }

  private startPolling(): void {
    this.stopPolling();
    // SINGLE poll timer — no other timers exist
    this.pollTimer = setInterval(async () => {
      await this.poll();
    }, this.pollIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  /** Single poll cycle — refresh all real data */
  private async poll(): Promise<void> {
    this.lastPollAt = Date.now();

    // One call to detect (Bug 4 fix: no dual polling)
    await this.registry.detectAll();

    const activeModel = this.registry.getActiveModel();
    if (activeModel) {
      this.contextCalc.setModel(activeModel);
    }

    // Issue 22: detect model change to skip false compaction this poll
    const modelChanged = this.previousModelId !== undefined && activeModel?.id !== this.previousModelId;
    this.previousModelId = activeModel?.id;

    // Feed token usage from Claude adapter (Bug 3 fix)
    this.feedTokenUsage();

    // Feed agent-touched files into file tracker (v3.1)
    this.feedAgentFiles();

    // Re-scan doc health on every poll (Issue 5 fix: docs now reflect disk state in real time)
    await this.docTracker.scan();

    // Detect compaction (context usage drop > 30%)
    const prevPercent = this.previousContextPercent;
    const state = this.contextCalc.getState(this.thresholds);
    const currPercent = state.usagePercent;

    // Issue 22: skip if model changed — context % drop is due to different window size, not compaction
    if (!modelChanged && prevPercent > 50 && currPercent < prevPercent * 0.6) {
      const event: CompactionEvent = {
        timestamp: Date.now(),
        tokensBefore: Math.round((prevPercent / 100) * state.maxInputTokens),
        tokensAfter: state.usedTokens,
        tokensFreed: Math.round(((prevPercent - currPercent) / 100) * state.maxInputTokens),
        filesLost: [],
        sessionId: this.registry.getActiveSession()?.id || 'unknown',
        source: 'detected',
      };
      this.compactionEvents.push(event);
      this.addTimelineEvent('compaction', `Compaction detected: ${currPercent}% (was ${prevPercent}%)`);

      const needsReinjection = this.fileTracker.getFilesNeedingReinjection();
      if (needsReinjection.length > 0) {
        const names = needsReinjection.map(f => f.relativePath).join(', ');
        vscode.window.showWarningMessage(
          `AgentLens: ${needsReinjection.length} always-present file(s) may need re-injection: ${names}`,
          'Re-inject'
        ).then(action => {
          if (action === 'Re-inject') {
            this.fileTracker.markInContext(needsReinjection.map(f => f.relativePath));
            this.emitState();
          }
        });
      }
    }
    this.previousContextPercent = currPercent;

    // Check context budget for always-present files (Issue 21: edge-trigger — fires once on rising edge)
    const isOverBudget = state.maxInputTokens > 0 && this.fileTracker.exceedsContextBudget(state.maxInputTokens);
    if (isOverBudget && !this.previouslyOverBudget) {
      const cost = this.fileTracker.getAlwaysPresentTokenCost();
      const maxPercent = vscode.workspace.getConfiguration('agentlens')
        .get<number>('alwaysPresentMaxPercent', 50);
      vscode.window.showWarningMessage(
        `AgentLens: Always-present files use ${Math.round((cost / state.maxInputTokens) * 100)}% of context (limit: ${maxPercent}%).`
      );
    }
    this.previouslyOverBudget = isOverBudget;

    // ── Timeline diff events (Issue 19: poll-diff emission) ──────────────────
    const activeSession = this.registry.getActiveSession();

    // agent-state-change: fire on every session state transition
    if (activeSession) {
      if (this.previousSessionState !== undefined &&
          activeSession.state !== this.previousSessionState) {
        this.addTimelineEvent(
          'agent-state-change',
          `Agent: ${this.previousSessionState} → ${activeSession.state}`
        );
      }
      this.previousSessionState = activeSession.state;

      // tool-call: batch — emit when ≥5 new calls accumulated since last event
      const toolDelta = activeSession.toolCallCount - this.previousToolCallCount;
      if (toolDelta >= 5) {
        this.addTimelineEvent('tool-call', `${toolDelta} tool calls`);
        this.previousToolCallCount = activeSession.toolCallCount;
      }
    } else {
      this.previousSessionState = undefined;
      this.previousToolCallCount = 0;
    }

    // threshold-crossed: fire when context zone changes
    if (this.previousZone !== undefined && state.zone !== this.previousZone) {
      this.addTimelineEvent(
        'threshold-crossed',
        `Context: ${this.previousZone} → ${state.zone}`,
        `${Math.round(currPercent)}%`
      );
    }
    this.previousZone = state.zone;

    // doc-change: fire when documentation health score changes
    const currentDocScore = this.docTracker.getHealth().score;
    if (this.previousDocScore !== undefined && currentDocScore !== this.previousDocScore) {
      this.addTimelineEvent('doc-change', `Docs: ${this.previousDocScore} → ${currentDocScore}`);
    }
    this.previousDocScore = currentDocScore;

    // file-lost: fire when new files transition to 'lost' visibility
    const trackedFiles = this.fileTracker.getTrackedFiles();
    const lostCount = trackedFiles.filter(f => f.visibility === 'lost').length;
    if (lostCount > this.previousLostFileCount) {
      const n = lostCount - this.previousLostFileCount;
      this.addTimelineEvent('file-lost', `${n} file${n > 1 ? 's' : ''} lost from context`);
    }
    this.previousLostFileCount = lostCount;

    this.emitState();
  }

  /**
   * Feed token usage from Claude adapter to context calculator.
   * v3.1: Always set dataSource when an active session exists, even if tokens are 0.
   * This prevents the context panel from being stuck in "partial" state forever.
   */
  private feedTokenUsage(): void {
    const claudeAdapter = this.registry.getAdapter('claude-code');
    if (claudeAdapter) {
      const usage = claudeAdapter.getTokenUsage();
      const session = claudeAdapter.getActiveSession();
      if (usage > 0) {
        this.contextCalc.updateUsage(usage, 'claude-code-logs');
      } else if (session?.isActive) {
        // Active session but no token data parsed yet — still set source
        // so the UI shows "available" state with 0 tokens instead of "partial"
        this.contextCalc.updateUsage(0, 'claude-code-session');
      }
    }
  }

  /**
   * Feed agent-touched files into the file tracker.
   * v3.1: Files read/written by the agent are dynamically added to tracking.
   */
  private feedAgentFiles(): void {
    const claudeAdapter = this.registry.getAdapter('claude-code') as ClaudeCodeAdapter | undefined;
    if (claudeAdapter && typeof claudeAdapter.getFilesTouched === 'function') {
      const files = claudeAdapter.getFilesTouched();
      if (files.length > 0) {
        this.fileTracker.addAgentFiles(files);
        this.docTracker.setAgentTouchedFiles(files); // Issue 32: cross-reference for lastUpdatedByAgent
      }
    }
  }

  injectFile(filePath: string): void {
    this.fileTracker.markInContext([filePath]);
    this.addTimelineEvent('file-loaded', `Injected: ${filePath}`);
    this.emitState();
  }

  toggleAlwaysPresent(filePath: string): void {
    this.fileTracker.toggleAlwaysPresent(filePath);
    this.emitState();
  }

  toggleCritical(filePath: string): void {
    this.fileTracker.toggleCritical(filePath);
    this.emitState();
  }

  async createDocManifest(): Promise<void> {
    try {
      const filePath = await this.docTracker.createDefaultManifest();
      const doc = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage('AgentLens: Created .agentlens/doc-requirements.json');
      await this.docTracker.loadManifest();
      await this.docTracker.scan();
      this.emitState();
    } catch (err) {
      vscode.window.showErrorMessage(`AgentLens: Failed to create manifest: ${err}`);
    }
  }

  /** Create missing documentation files from the manifest */
  async createMissingDocs(): Promise<void> {
    try {
      const created = await this.docTracker.createMissingDocs();
      if (created.length > 0) {
        vscode.window.showInformationMessage(
          `AgentLens: Created ${created.length} documentation file(s): ${created.join(', ')}`
        );
        await this.docTracker.scan();
        this.emitState();
      } else {
        vscode.window.showInformationMessage('AgentLens: No missing documentation files to create.');
      }
    } catch (err) {
      vscode.window.showErrorMessage(`AgentLens: Failed to create docs: ${err}`);
    }
  }

  /** Update existing documentation files — shows overwrite warning first */
  async updateDocs(docTypes?: string[]): Promise<void> {
    const label = docTypes?.length === 1 ? `"${docTypes[0]}"` : 'all existing docs';
    const answer = await vscode.window.showWarningMessage(
      `AgentLens will regenerate ${label} from current project files. Existing content will be overwritten.`,
      'Continue', 'Cancel'
    );
    if (answer !== 'Continue') return;

    try {
      const updated = await this.docTracker.updateDocs(docTypes);
      if (updated.length > 0) {
        vscode.window.showInformationMessage(
          `AgentLens: Updated ${updated.length} documentation file(s): ${updated.join(', ')}`
        );
        await this.docTracker.scan();
        this.emitState();
      } else {
        vscode.window.showInformationMessage('AgentLens: No existing documentation files to update.');
      }
    } catch (err) {
      vscode.window.showErrorMessage(`AgentLens: Failed to update docs: ${err}`);
    }
  }

  reInjectLostFiles(): void {
    const lost = this.fileTracker.getFilesNeedingReinjection();
    if (lost.length > 0) {
      this.fileTracker.markInContext(lost.map(f => f.relativePath));
      this.addTimelineEvent('file-loaded', `Re-injected ${lost.length} file(s)`);
      this.emitState();
    }
  }

  getState(): DashboardState {
    const context = this.contextCalc.getState(this.thresholds);
    const agents = this.registry.getDetectedAgents();
    const trackedFiles = this.fileTracker.getTrackedFiles();
    const documentationHealth = this.docTracker.getHealth();
    const activeSession = this.registry.getActiveSession();

    const healthScore = this.healthScorer.calculate(
      context, trackedFiles, documentationHealth,
      this.compactionEvents, activeSession
    );

    return {
      context,
      agents,
      trackedFiles,
      documentationHealth,
      compactionEvents: this.compactionEvents,
      timeline: this.timeline.slice(-50),
      healthScore,
      thresholds: this.thresholds,
      pollIntervalMs: this.pollIntervalMs,
      lastPollAt: this.lastPollAt,
    };
  }

  private emitState(): void {
    this._onStateChanged.fire(this.getState());
  }

  private addTimelineEvent(type: TimelineEvent['type'], label: string, detail?: string): void {
    const context = this.contextCalc.getState(this.thresholds);
    this.timeline.push({
      type, timestamp: Date.now(), label, detail,
      contextUsageAtTime: context.usagePercent, zone: context.zone,
    });
  }

  dispose(): void {
    this.stopPolling();
    this.fileTracker.dispose();
    this.registry.dispose();
    this._onStateChanged.dispose();
  }
}
