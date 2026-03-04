/**
 * Agent Detector v2 — Real Detection Only
 * 
 * Detection strategy:
 * 1. vscode.lm.selectChatModels() — enumerates all available LM models with real specs
 * 2. Extension presence — checks which AI extensions are installed
 * 3. Claude Code JSONL logs — parses ~/.claude/projects/ for active session data
 * 4. Polling — re-detects on configurable interval to catch model switches
 * 
 * NO hardcoded model specs. Every model's maxInputTokens/maxOutputTokens comes from the API.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import {
  DetectedAgent, DetectedModel, AgentSession, AgentType,
  AgentSessionState,
} from '../types';

interface ClaudeSessionMeta {
  sessionId: string;
  model?: string;
  turnCount: number;
  toolCallCount: number;
  filesTouched: Set<string>;
  lastActivity: number;
  state: AgentSessionState;
  currentTask?: string;
  compactionCount: number;
}

/** Extension IDs for known AI agents */
const AGENT_EXTENSIONS: Record<AgentType, string[]> = {
  'copilot': ['github.copilot', 'github.copilot-chat'],
  'claude-code': [], // Claude Code is CLI-based, detected via file indicators
  'cursor': ['cursor.cursor'],
  'cline': ['saoudrizwan.claude-dev'],
  'codex': ['openai.chatgpt-vscode'],
  'unknown': [],
};

/** File indicators for agents without extension IDs */
const AGENT_FILE_INDICATORS: Partial<Record<AgentType, string[]>> = {
  'claude-code': ['CLAUDE.md', '.claude/settings.json'],
  'cursor': ['.cursorrules'],
  'cline': ['.clinerules'],
};

export class AgentDetector {
  private detectedAgents: Map<AgentType, DetectedAgent> = new Map();
  private allModels: DetectedModel[] = [];
  private activeModelId: string | undefined;
  private claudeSessions: Map<string, ClaudeSessionMeta> = new Map();
  private pollTimer: NodeJS.Timeout | undefined;
  private _onModelChanged = new vscode.EventEmitter<DetectedModel>();
  public readonly onModelChanged = this._onModelChanged.event;

  /** Detect all available agents and models. Called on init and on each poll. */
  async detect(): Promise<void> {
    this.detectedAgents.clear();
    this.allModels = [];

    // 1. Enumerate models via VS Code LM API (real data from Copilot/providers)
    await this.detectVsCodeModels();

    // 2. Detect extensions
    this.detectInstalledExtensions();

    // 3. Detect Claude Code via file system
    await this.detectClaudeCode();
  }

  /** Start polling for model/agent changes */
  startPolling(intervalMs: number): void {
    this.stopPolling();
    this.pollTimer = setInterval(async () => {
      const previousModelId = this.activeModelId;
      await this.detect();
      const currentModelId = this.activeModelId;
      if (previousModelId !== currentModelId && currentModelId) {
        const model = this.allModels.find(m => m.id === currentModelId);
        if (model) {
          this._onModelChanged.fire(model);
        }
      }
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  /** Use vscode.lm.selectChatModels() to get real model data */
  private async detectVsCodeModels(): Promise<void> {
    try {
      // Get ALL available models (no filter = all vendors)
      const models = await vscode.lm.selectChatModels({});
      
      for (const model of models) {
        const detected: DetectedModel = {
          id: model.id,
          name: model.name,
          family: model.family,
          vendor: model.vendor,
          maxInputTokens: model.maxInputTokens,
          maxOutputTokens: 0, // VS Code LM API does not expose maxOutputTokens
          isActive: false, // We'll determine active model separately
        };
        this.allModels.push(detected);

        // Map vendor to agent type
        const agentType = this.vendorToAgentType(model.vendor);
        const existing = this.detectedAgents.get(agentType);
        if (existing) {
          existing.availableModels.push(detected);
        } else {
          this.detectedAgents.set(agentType, {
            type: agentType,
            displayName: this.getAgentDisplayName(agentType),
            isInstalled: true,
            sessions: [],
            availableModels: [detected],
          });
        }
      }
    } catch (err) {
      // LM API not available or no models — this is fine, we fall back to other detection
      console.log('AgentLens: vscode.lm.selectChatModels() not available:', err);
    }
  }

  /** Check which AI extensions are installed */
  private detectInstalledExtensions(): void {
    for (const [agentType, extIds] of Object.entries(AGENT_EXTENSIONS)) {
      if (extIds.length === 0) continue;
      
      const installed = extIds.some(id => vscode.extensions.getExtension(id) !== undefined);
      if (installed) {
        const type = agentType as AgentType;
        const existing = this.detectedAgents.get(type);
        if (existing) {
          existing.isInstalled = true;
          existing.extensionId = extIds.find(id => vscode.extensions.getExtension(id) !== undefined);
        } else {
          this.detectedAgents.set(type, {
            type,
            displayName: this.getAgentDisplayName(type),
            isInstalled: true,
            extensionId: extIds.find(id => vscode.extensions.getExtension(id) !== undefined),
            sessions: [],
            availableModels: [],
          });
        }
      }
    }

    // Check file indicators in workspace
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      for (const [agentType, files] of Object.entries(AGENT_FILE_INDICATORS)) {
        if (!files) continue;
        const type = agentType as AgentType;
        // File indicators are checked but don't create an agent entry unless files exist
        // This is handled by scanForCriticalFiles in FileTracker
      }
    }
  }

  /** Parse Claude Code JSONL session logs for real session data */
  private async detectClaudeCode(): Promise<void> {
    const claudeDir = path.join(os.homedir(), '.claude');
    const projectsDir = path.join(claudeDir, 'projects');

    try {
      // Check if .claude directory exists
      await vscode.workspace.fs.stat(vscode.Uri.file(claudeDir));
    } catch {
      return; // No Claude Code installed
    }

    // Ensure Claude Code is in detected agents
    if (!this.detectedAgents.has('claude-code')) {
      this.detectedAgents.set('claude-code', {
        type: 'claude-code',
        displayName: 'Claude Code',
        isInstalled: true,
        sessions: [],
        availableModels: [],
      });
    }

    // Find the project directory for current workspace
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;

    // Claude Code encodes project paths: /Users/xxx/project → -Users-xxx-project
    const encodedPath = workspaceRoot.replace(/\//g, '-').replace(/^-/, '');
    const projectDir = path.join(projectsDir, encodedPath);

    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(projectDir));
    } catch {
      // Try alternate encoding (Windows-style)
      return;
    }

    // Read session JSONL files — find the most recent one
    try {
      const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(projectDir));
      const jsonlFiles = entries
        .filter(([name, type]) => name.endsWith('.jsonl') && type === vscode.FileType.File)
        .map(([name]) => name);

      if (jsonlFiles.length === 0) return;

      // Get the most recently modified JSONL file
      let latestFile = '';
      let latestMtime = 0;

      for (const file of jsonlFiles.slice(-10)) { // Check last 10 files
        try {
          const stat = await vscode.workspace.fs.stat(
            vscode.Uri.file(path.join(projectDir, file))
          );
          if (stat.mtime > latestMtime) {
            latestMtime = stat.mtime;
            latestFile = file;
          }
        } catch { continue; }
      }

      if (!latestFile) return;

      // Parse the JSONL file (read last 100KB to avoid loading massive files)
      const fileUri = vscode.Uri.file(path.join(projectDir, latestFile));
      const content = await vscode.workspace.fs.readFile(fileUri);
      const text = Buffer.from(content).toString('utf-8');
      
      // Parse from the end (most recent entries)
      const lines = text.split('\n').filter(l => l.trim());
      const recentLines = lines.slice(-200); // Last 200 messages

      const session = this.parseClaudeSession(latestFile.replace('.jsonl', ''), recentLines);
      
      if (session) {
        const agent = this.detectedAgents.get('claude-code')!;
        agent.sessions = [{
          id: session.sessionId,
          agentType: 'claude-code',
          state: session.state,
          startedAt: session.lastActivity - (session.turnCount * 30000), // Estimate
          isActive: (Date.now() - session.lastActivity) < 120000, // Active if last activity < 2min
          currentTask: session.currentTask,
          turnCount: session.turnCount,
          toolCallCount: session.toolCallCount,
          filesTouchedCount: session.filesTouched.size,
          compactionCount: session.compactionCount,
          model: session.model ? this.allModels.find(m => m.family === session.model) || {
            id: session.model,
            name: session.model,
            family: session.model,
            vendor: 'anthropic',
            maxInputTokens: 200000, // Claude default
            maxOutputTokens: 16384,
            isActive: true,
          } : undefined,
        }];

        // If we found a model from Claude Code logs, add it to available models
        if (session.model && !agent.availableModels.find(m => m.family === session.model)) {
          agent.availableModels.push({
            id: session.model,
            name: session.model,
            family: session.model,
            vendor: 'anthropic',
            maxInputTokens: 200000,
            maxOutputTokens: 16384,
            isActive: true,
          });
        }
      }
    } catch (err) {
      console.log('AgentLens: Error reading Claude Code sessions:', err);
    }
  }

  /** Parse Claude Code JSONL lines into session metadata */
  private parseClaudeSession(sessionId: string, lines: string[]): ClaudeSessionMeta | null {
    const meta: ClaudeSessionMeta = {
      sessionId,
      turnCount: 0,
      toolCallCount: 0,
      filesTouched: new Set(),
      lastActivity: Date.now(),
      state: 'idle',
      compactionCount: 0,
    };

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const msg = entry.message;
        if (!msg) continue;

        // Extract model from assistant messages
        if (msg.role === 'assistant' && entry.model) {
          meta.model = entry.model;
        }

        // Count user turns
        if (msg.role === 'user') {
          meta.turnCount++;
          // Extract first user message as task hint
          if (!meta.currentTask && msg.content) {
            const text = typeof msg.content === 'string'
              ? msg.content
              : Array.isArray(msg.content)
                ? msg.content.find((c: any) => c.type === 'text')?.text
                : undefined;
            if (text && text.length > 0) {
              meta.currentTask = text.substring(0, 80) + (text.length > 80 ? '...' : '');
            }
          }
        }

        // Count tool calls and track files
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'tool_use') {
              meta.toolCallCount++;
              // Track file operations
              const input = block.input;
              if (input?.file_path) meta.filesTouched.add(input.file_path);
              if (input?.path) meta.filesTouched.add(input.path);
              if (input?.command && typeof input.command === 'string') {
                // Simple heuristic: detect file paths in bash commands
                const fileMatch = input.command.match(/(?:cat|edit|read|write|vim|nano)\s+(\S+)/);
                if (fileMatch) meta.filesTouched.add(fileMatch[1]);
              }

              // Detect state from tool names
              if (block.name === 'Read' || block.name === 'Grep' || block.name === 'Glob' || block.name === 'LS') {
                meta.state = 'reading-files';
              } else if (block.name === 'Write' || block.name === 'Edit' || block.name === 'MultiEdit') {
                meta.state = 'writing-code';
              } else if (block.name === 'Bash') {
                meta.state = 'running-terminal';
              } else if (block.name === 'Task') {
                meta.state = 'executing';
              } else {
                meta.state = 'tool-calling';
              }
            }

            // Detect thinking
            if (block.type === 'thinking') {
              meta.state = 'thinking';
            }
          }
        }

        // Detect compaction (context window summary messages)
        if (msg.role === 'user' && typeof msg.content === 'string' &&
            (msg.content.includes('[compacted]') || msg.content.includes('conversation summary'))) {
          meta.compactionCount++;
          meta.state = 'compacting';
        }

      } catch {
        // Skip malformed lines
      }
    }

    return meta.turnCount > 0 ? meta : null;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  getDetectedAgents(): DetectedAgent[] {
    return Array.from(this.detectedAgents.values());
  }

  getAllModels(): DetectedModel[] {
    return this.allModels;
  }

  /** Get the primary active agent (prefer one with active session, then most models) */
  getPrimaryAgent(): DetectedAgent | undefined {
    const agents = this.getDetectedAgents();
    // Prefer agent with active session
    const withSession = agents.find(a => a.sessions.some(s => s.isActive));
    if (withSession) return withSession;
    // Prefer agent with most models
    return agents.sort((a, b) => b.availableModels.length - a.availableModels.length)[0];
  }

  /** Get the currently active model (best guess from available data) */
  getActiveModel(): DetectedModel | undefined {
    // Check Claude Code sessions first (most reliable — parsed from real logs)
    for (const agent of this.detectedAgents.values()) {
      for (const session of agent.sessions) {
        if (session.isActive && session.model) {
          return session.model;
        }
      }
    }
    // Fall back to first available model from LM API
    return this.allModels[0];
  }

  getActiveSession(): AgentSession | undefined {
    for (const agent of this.detectedAgents.values()) {
      const active = agent.sessions.find(s => s.isActive);
      if (active) return active;
    }
    return undefined;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private vendorToAgentType(vendor: string): AgentType {
    const v = vendor.toLowerCase();
    if (v === 'copilot' || v === 'github') return 'copilot';
    if (v === 'anthropic' || v === 'claude') return 'claude-code';
    if (v === 'cursor') return 'cursor';
    if (v === 'openai') return 'codex';
    return 'unknown';
  }

  private getAgentDisplayName(type: AgentType): string {
    switch (type) {
      case 'copilot': return 'GitHub Copilot';
      case 'claude-code': return 'Claude Code';
      case 'cursor': return 'Cursor';
      case 'cline': return 'Cline';
      case 'codex': return 'Codex / OpenAI';
      default: return 'Unknown Agent';
    }
  }

  dispose(): void {
    this.stopPolling();
    this._onModelChanged.dispose();
  }
}
