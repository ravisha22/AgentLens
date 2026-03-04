/**
 * Claude Code Adapter — Detects Claude Code via JSONL session logs.
 *
 * Fixes:
 * - Bug 1: Multi-strategy Windows path encoding for project directory lookup
 * - Bug 5: Extracts real token usage from JSONL usage/costData fields
 * - v3.1: Include cache_read_input_tokens in usage calculation
 * - v3.1: Beautify model names for human-readable display
 * - v3.1: Expose filesTouched for dynamic file tracking
 * - v3.1: Detect edit mode from JSONL permission patterns
 * - v3.1: Improved path matching with case-insensitive strategies
 * - v3.1: Use file mtime for session liveness instead of fixed 120s window
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { IAgentAdapter } from './IAgentAdapter';
import {
  AgentType, DetectedAgent, DetectedModel, AgentSession, AgentSessionState,
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
  detectedMode?: string;
  compactionCount: number;
  tokenUsage: number;
  hasEditTools: boolean;
}

/**
 * Known model context windows. Keyed by exact or prefix ID.
 * Add new entries here when context sizes change. The keyword fallback
 * in getModelSpecs() handles unknown future models without code changes.
 */
const MODEL_SPECS: Record<string, { maxInput: number; maxOutput: number }> = {
  // Anthropic — Claude 4 series
  'claude-sonnet-4-20250514': { maxInput: 200000, maxOutput: 16384 },
  'claude-opus-4-20250514':   { maxInput: 200000, maxOutput: 32768 },
  // Anthropic — Claude 3.x series
  'claude-3-5-sonnet-20241022': { maxInput: 200000, maxOutput: 8192 },
  'claude-3-5-haiku-20241022':  { maxInput: 200000, maxOutput: 8192 },
  'claude-3-opus-20240229':     { maxInput: 200000, maxOutput: 4096 },
  // OpenAI
  'gpt-4o':       { maxInput: 128000, maxOutput: 4096 },
  'gpt-4-turbo':  { maxInput: 128000, maxOutput: 4096 },
  'gpt-4':        { maxInput: 8192,   maxOutput: 4096 },
  'gpt-3.5-turbo':{ maxInput: 16385,  maxOutput: 4096 },
  'o1':           { maxInput: 200000, maxOutput: 100000 },
  'o3':           { maxInput: 200000, maxOutput: 100000 },
  'o3-mini':      { maxInput: 200000, maxOutput: 65536 },
  // Google Gemini
  'gemini-2.0-flash': { maxInput: 1000000, maxOutput: 8192 },
  'gemini-1.5-pro':   { maxInput: 1000000, maxOutput: 8192 },
  'gemini-1.5-flash': { maxInput: 1000000, maxOutput: 8192 },
  'gemini-pro':       { maxInput: 32760,   maxOutput: 2048 },
  // xAI Grok
  'grok-3':     { maxInput: 131072, maxOutput: 8192 },
  'grok-2':     { maxInput: 131072, maxOutput: 4096 },
  'grok-mini':  { maxInput: 131072, maxOutput: 4096 },
  // Mistral
  'mistral-large': { maxInput: 131072, maxOutput: 4096 },
  'mistral-small': { maxInput: 32768,  maxOutput: 4096 },
  'mistral-7b':    { maxInput: 32768,  maxOutput: 4096 },
};

function getModelSpecs(modelId: string): { maxInput: number; maxOutput: number } {
  const id = modelId.toLowerCase();
  // Exact match
  if (MODEL_SPECS[id]) return MODEL_SPECS[id];
  // Prefix match — e.g. "claude-sonnet-4-6-20260101" matches "claude-sonnet-4"
  for (const [key, specs] of Object.entries(MODEL_SPECS)) {
    if (id.startsWith(key)) return specs;
  }
  // Keyword fallback — handles future/unknown models without code changes
  if (/opus/i.test(id))            return { maxInput: 200000, maxOutput: 32768 };
  if (/sonnet/i.test(id))          return { maxInput: 200000, maxOutput: 16384 };
  if (/haiku/i.test(id))           return { maxInput: 200000, maxOutput: 8192 };
  if (/gemini.*flash/i.test(id))   return { maxInput: 1000000, maxOutput: 8192 };
  if (/gemini/i.test(id))          return { maxInput: 1000000, maxOutput: 8192 };
  if (/gpt-4/i.test(id))           return { maxInput: 128000, maxOutput: 4096 };
  if (/gpt/i.test(id))             return { maxInput: 16385, maxOutput: 4096 };
  if (/^o\d+/i.test(id))           return { maxInput: 200000, maxOutput: 65536 };
  if (/grok/i.test(id))            return { maxInput: 131072, maxOutput: 4096 };
  if (/mistral|mixtral/i.test(id)) return { maxInput: 131072, maxOutput: 4096 };
  if (/llama/i.test(id))           return { maxInput: 131072, maxOutput: 4096 };
  if (/deepseek/i.test(id))        return { maxInput: 64000, maxOutput: 8192 };
  return { maxInput: 200000, maxOutput: 16384 };
}

/**
 * Format a single model-id segment for display.
 * - Digit-start with B/K/M suffix → uppercase suffix (7b → 7B, 70b → 70B)
 * - Digit-start otherwise → leave as-is (4o stays 4o, 2.0 stays 2.0)
 * - Letter-start → Title Case (turbo → Turbo)
 */
function fmtSeg(s: string): string {
  if (!s) return '';
  if (/^\d/.test(s)) {
    // Size notation: 7b/70b/13b → 7B/70B/13B; 4o/4.5/3.5 unchanged
    return s.replace(/^(\d+)([bkmg])$/i, (_, n, u) => n + u.toUpperCase());
  }
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Walk an array of hyphen-split segments, merging consecutive single-digit
 * pairs into dotted version strings.
 * ['3','5','sonnet'] → '3.5 Sonnet'
 * ['4','turbo'] → '4 Turbo'
 * ['2','0','flash'] → '2.0 Flash'
 * ['4o'] → '4o'
 */
function fmtSegments(segs: string[]): string {
  const out: string[] = [];
  let i = 0;
  while (i < segs.length) {
    const cur = segs[i];
    const nxt = segs[i + 1];
    // Merge pure-number + short-pure-number into dotted version
    if (/^\d+$/.test(cur) && nxt !== undefined && /^\d{1,2}$/.test(nxt)) {
      out.push(`${cur}.${nxt}`);
      i += 2;
    } else {
      out.push(fmtSeg(cur));
      i++;
    }
  }
  return out.join(' ');
}

/**
 * Universal model name beautifier.
 *
 * No hardcoded version list — works with any future Claude version and any
 * other provider (OpenAI, Gemini, Grok, Mistral, Llama, DeepSeek, Cohere…).
 *
 * Algorithm:
 *   1. Strip 8-digit date suffixes (-20250514) and 4-digit release tags (-1219)
 *   2. Strip trailing noise words (latest, preview, stable, beta, exp)
 *   3. Identify vendor prefix and remove it from the remainder
 *   4. Walk the remaining segments, merging consecutive numeric pairs into
 *      dotted versions (4, 6 → 4.6) and title-casing the rest
 *
 * Examples:
 *   claude-sonnet-4-6-20260101  → Claude Sonnet 4.6
 *   claude-opus-5-20270514      → Claude Opus 5
 *   gpt-4o                      → GPT 4o
 *   gpt-4-turbo                 → GPT 4 Turbo
 *   gemini-2-0-flash            → Gemini 2.0 Flash
 *   grok-3-mini                 → Grok 3 Mini
 *   mistral-large-latest        → Mistral Large
 *   mistral-7b-instruct         → Mistral 7B Instruct
 *   o3-mini                     → o3 Mini
 *   llama-3-70b-instruct        → Llama 3 70B Instruct
 */
function beautifyModelName(modelId: string): string {
  if (!modelId) return 'Unknown Model';
  let work = modelId.toLowerCase().trim();

  // OpenAI o-series (o1, o3, o4-mini…) — handled before generic vendor strip
  const oMatch = work.match(/^(o\d+)(?:-(.+))?$/);
  if (oMatch) {
    const [, base, rest] = oMatch;
    if (!rest) return base;
    const segs = rest.split('-').filter(s => !['latest','preview','exp','stable','beta'].includes(s));
    return segs.length ? `${base} ${fmtSegments(segs)}` : base;
  }

  // Strip 8-digit date suffix (-20250514) or 4-digit trailing numeric (-1219, -0125)
  work = work.replace(/-\d{8}$/, '').replace(/-\d{4}$/, '');
  // Strip trailing noise words
  work = work.replace(/-(latest|preview|stable|beta|exp|experimental)$/, '');

  // Vendor prefix table: [pattern to test, display label, prefix string to strip]
  const VENDORS: [RegExp, string, string][] = [
    [/^claude-/,       'Claude',    'claude-'],
    [/^gpt-/,          'GPT',       'gpt-'],
    [/^chatgpt-/,      'ChatGPT',   'chatgpt-'],
    [/^codex-/,        'Codex',     'codex-'],
    [/^text-davinci-/, 'Davinci',   'text-davinci-'],
    [/^(meta-)?llama[-_]/, 'Llama', ''],  // special-cased below
    [/^gemini-/,       'Gemini',    'gemini-'],
    [/^grok-/,         'Grok',      'grok-'],
    [/^mistral-/,      'Mistral',   'mistral-'],
    [/^mixtral-/,      'Mixtral',   'mixtral-'],
    [/^deepseek-/,     'DeepSeek',  'deepseek-'],
    [/^command[-r]*/,  'Command',   ''],  // special-cased below
  ];

  let vendor = '';
  let remainder = work;

  for (const [pat, label, strip] of VENDORS) {
    if (!pat.test(work)) continue;
    vendor = label;
    if (strip) {
      remainder = work.slice(strip.length);
    } else if (label === 'Llama') {
      remainder = work.replace(/^(?:meta-)?llama[-_]/, '');
    } else if (label === 'Command') {
      remainder = work.replace(/^command[-r]*-?/, '');
    }
    break;
  }

  if (!remainder) return vendor || modelId;

  const segs = remainder.split('-').filter(Boolean);
  const body = fmtSegments(segs);
  return [vendor, body].filter(Boolean).join(' ');
}

/**
 * Derive the model family label (tier/architecture name) from a model ID.
 * Used for the secondary line in the Context panel.
 */
function beautifyModelFamily(modelId: string): string {
  const id = modelId.toLowerCase();
  // Anthropic tiers
  if (/opus/i.test(id))   return 'Opus';
  if (/sonnet/i.test(id)) return 'Sonnet';
  if (/haiku/i.test(id))  return 'Haiku';
  // OpenAI
  if (/^gpt-4o/.test(id))   return 'GPT-4o';
  if (/^gpt-4/.test(id))    return 'GPT-4';
  if (/^gpt-3/.test(id))    return 'GPT-3';
  if (/^o(\d+)/.test(id))   return id.match(/^o\d+/)?.[0] ?? '';
  // Google
  if (/gemini.*flash/.test(id)) return 'Flash';
  if (/gemini.*pro/.test(id))   return 'Pro';
  if (/^gemini/.test(id))       return 'Gemini';
  // xAI / Mistral / Meta / DeepSeek
  if (/grok/.test(id))    return 'Grok';
  if (/large/.test(id))   return 'Large';
  if (/small/.test(id))   return 'Small';
  if (/llama/.test(id))   return 'Llama';
  if (/deepseek/.test(id))return 'DeepSeek';
  return '';
}

/**
 * Detect the model vendor from the model ID.
 * Used for the vendor label in the Context panel.
 */
function detectVendor(modelId: string): string {
  const id = modelId.toLowerCase();
  if (/^claude/.test(id))                                 return 'Anthropic';
  if (/^(gpt|chatgpt|o\d+|codex|text-davinci)/.test(id)) return 'OpenAI';
  if (/^gemini/.test(id))                                 return 'Google';
  if (/^grok/.test(id))                                   return 'xAI';
  if (/^(mistral|mixtral)/.test(id))                      return 'Mistral AI';
  if (/llama/.test(id))                                   return 'Meta';
  if (/^deepseek/.test(id))                               return 'DeepSeek';
  if (/^command/.test(id))                                return 'Cohere';
  return 'Unknown';
}

/**
 * Score a stripped user message as a task description candidate.
 * Higher = more likely to be a real task. Used for multi-candidate task extraction.
 */
function scoreTaskCandidate(text: string): number {
  let score = 0;

  // Length sweet spot: 15–200 chars — real tasks are usually terse but not trivial
  if (text.length >= 15 && text.length <= 200) score += 3;
  else if (text.length > 400) score -= 5; // continuation summaries are always long
  else if (text.length < 10) score -= 3;

  // Action verbs common in task requests
  if (/\b(fix|add|create|implement|build|update|refactor|make|write|debug|test|check|help|explain|show|find|remove|delete|change|rename|generate|review|analyse|analyze)\b/i.test(text)) score += 2;

  // Code-related terms
  if (/\b(function|file|component|error|test|class|module|api|endpoint|variable|const|type|interface|bug|feature|import|export|hook|method|service|config|schema)\b/i.test(text)) score += 1;

  // Meta / noise indicators — self-referential, session management
  if (/\b(session|conversation|context window|compacted|are you|still executing|ran out|continued from|summarized below|previous conversation)\b/i.test(text)) score -= 5;

  // Short question — likely meta
  if (text.length < 40 && text.trimEnd().endsWith('?')) score -= 2;

  return score;
}

export class ClaudeCodeAdapter implements IAgentAdapter {
  readonly agentType: AgentType = 'claude-code';
  readonly displayName = 'Claude Code';

  private detected = false;
  private session: AgentSession | null = null;
  private model: DetectedModel | null = null;
  private latestTokenUsage = 0;
  private latestFilesTouched: string[] = [];
  private sessionFileMtime = 0;

  async detect(): Promise<void> {
    const claudeDir = path.join(os.homedir(), '.claude');

    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(claudeDir));
    } catch {
      this.detected = false;
      return;
    }

    this.detected = true;

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;

    // Find project directory using multi-strategy encoding (Bug 1 fix)
    const projectDir = await this.findProjectDir(workspaceRoot);
    if (!projectDir) return;

    // Find and parse the most recent JSONL session file
    await this.parseLatestSession(projectDir);
  }

  /**
   * Multi-strategy project directory lookup.
   * Fixes Bug 1: Windows path encoding with additional strategies.
   */
  private async findProjectDir(workspacePath: string): Promise<string | null> {
    const projectsDir = path.join(os.homedir(), '.claude', 'projects');

    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(projectsDir));
    } catch {
      return null;
    }

    // Normalize to forward slashes
    const normalized = workspacePath.replace(/\\/g, '/');

    // Strategy 1: Unix-style (remove leading slash, replace / with -)
    const unix = normalized.replace(/^\//, '').replace(/\//g, '-');

    // Strategy 2: Windows drive without colon (C:/Users/... -> C-Users-...)
    const winDrive = normalized.replace(/^([A-Za-z]):\//, '$1-').replace(/\//g, '-');

    // Strategy 3: Full colons removed (C:\Users\... -> C-Users-...)
    const fullClean = normalized.replace(/:/g, '').replace(/\//g, '-').replace(/^-+/, '');

    // Strategy 4: Lowercase variants (Claude Code may normalize to lowercase)
    const winDriveLower = winDrive.toLowerCase();
    const fullCleanLower = fullClean.toLowerCase();

    // Strategy 5: With drive colon kept (C:-Users-...)
    const withColon = normalized.replace(/\//g, '-');

    const candidates = [...new Set([unix, winDrive, fullClean, winDriveLower, fullCleanLower, withColon])];

    for (const candidate of candidates) {
      const candidatePath = path.join(projectsDir, candidate);
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(candidatePath));
        return candidatePath;
      } catch {
        // Not found, try next
      }
    }

    // Strategy 6: Scan all directories and match by workspace base name + path components
    try {
      const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(projectsDir));
      const baseName = path.basename(workspacePath).toLowerCase();
      const pathParts = workspacePath.replace(/\\/g, '/').toLowerCase().split('/').filter(Boolean);

      // First try: match ending with base name
      let matches = entries.filter(([name, type]) =>
        type === vscode.FileType.Directory && name.toLowerCase().endsWith(baseName)
      );

      if (matches.length === 1) {
        return path.join(projectsDir, matches[0][0]);
      }

      // Multiple matches: pick the one with most matching path components
      if (matches.length > 1) {
        let bestMatch = matches[0][0];
        let bestScore = 0;
        for (const [name] of matches) {
          const parts = name.toLowerCase().split('-');
          const score = pathParts.filter(p => parts.includes(p)).length;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = name;
          }
        }
        return path.join(projectsDir, bestMatch);
      }

      // No ending match — try partial match with most recent mtime
      if (matches.length === 0) {
        let bestDir: string | null = null;
        let bestMtime = 0;
        for (const [name, type] of entries) {
          if (type !== vscode.FileType.Directory) continue;
          if (!name.toLowerCase().includes(baseName)) continue;
          try {
            const stat = await vscode.workspace.fs.stat(
              vscode.Uri.file(path.join(projectsDir, name))
            );
            if (stat.mtime > bestMtime) {
              bestMtime = stat.mtime;
              bestDir = name;
            }
          } catch { /* skip */ }
        }
        if (bestDir) return path.join(projectsDir, bestDir);
      }
    } catch {
      // Can't read projects dir
    }

    return null;
  }

  private async parseLatestSession(projectDir: string): Promise<void> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(projectDir));
      const jsonlFiles = entries
        .filter(([name, type]) => name.endsWith('.jsonl') && type === vscode.FileType.File)
        .map(([name]) => name);

      if (jsonlFiles.length === 0) return;

      // Find the most recently modified JSONL file
      let latestFile = '';
      let latestMtime = 0;

      for (const file of jsonlFiles) {
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

      this.sessionFileMtime = latestMtime; // will be overwritten below with effectiveMtime

      // Also check subagent directory — tool calls from sub-tasks write there,
      // not to the main JSONL, so the main file mtime won't update during tool execution.
      let latestSubagentMtime = 0;
      try {
        const sessionUUID = latestFile.replace('.jsonl', '');
        const subagentDir = path.join(projectDir, sessionUUID, 'subagents');
        const subEntries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(subagentDir));
        for (const [name, type] of subEntries) {
          if (type !== vscode.FileType.File || !name.endsWith('.jsonl')) continue;
          try {
            const stat = await vscode.workspace.fs.stat(
              vscode.Uri.file(path.join(subagentDir, name))
            );
            if (stat.mtime > latestSubagentMtime) latestSubagentMtime = stat.mtime;
          } catch { continue; }
        }
      } catch { /* no subagent dir — single-agent session */ }

      // Use the most recent write across main + subagent files for liveness
      const effectiveMtime = Math.max(latestMtime, latestSubagentMtime);
      this.sessionFileMtime = effectiveMtime; // Issue 23: use effective mtime (includes subagent activity)

      const fileUri = vscode.Uri.file(path.join(projectDir, latestFile));
      const content = await vscode.workspace.fs.readFile(fileUri);
      const text = Buffer.from(content).toString('utf-8');

      const lines = text.split('\n').filter(l => l.trim());
      const recentLines = lines.slice(-200);

      const meta = this.parseClaudeSession(latestFile.replace('.jsonl', ''), recentLines);
      if (!meta) return;

      // Build model info with beautified names
      const specs = meta.model ? getModelSpecs(meta.model) : getModelSpecs('default');
      const modelInfo: DetectedModel = {
        id: meta.model || 'claude-unknown',
        name: beautifyModelName(meta.model || 'Claude (unknown)'),
        family: beautifyModelFamily(meta.model || 'claude'),
        vendor: detectVendor(meta.model || ''),
        maxInputTokens: specs.maxInput,
        maxOutputTokens: specs.maxOutput,
        isActive: true,
      };

      this.model = modelInfo;
      this.latestTokenUsage = meta.tokenUsage;
      this.latestFilesTouched = Array.from(meta.filesTouched);

      // Use file mtime for liveness — more reliable than fixed window
      // Session is active if main JSONL or any subagent JSONL was modified within the last 5 minutes
      const isActive = (Date.now() - effectiveMtime) < 300000;
      // Agent is "currently generating" only if JSONL was written within last 30s.
      // meta.state reflects the last tool call in the window, not the current activity —
      // so if no writes recently, override to idle to unblock UI controls.
      const isCurrentlyBusy = (Date.now() - effectiveMtime) < 30000;

      // Mode inference (Issue 49): 'Plan mode' is confirmed from JSONL tool_result.
      // All other labels are behaviorally inferred from tool usage patterns —
      // they reflect what the agent is doing, not the VS Code UI mode setting.
      let mode: string | undefined;
      if (meta.detectedMode) {
        mode = meta.detectedMode; // confirmed
      } else if (meta.hasEditTools) {
        const ratio = meta.turnCount > 0 ? meta.toolCallCount / meta.turnCount : 0;
        mode = ratio >= 3 ? 'Auto-editing' : 'Editing';
      } else if (meta.toolCallCount > 0) {
        mode = 'Reading';
      }

      this.session = {
        id: meta.sessionId,
        agentType: 'claude-code',
        state: isCurrentlyBusy ? meta.state : 'idle',
        startedAt: meta.lastActivity - (meta.turnCount * 30000),
        isActive,
        currentTask: meta.currentTask,
        turnCount: meta.turnCount,
        toolCallCount: meta.toolCallCount,
        filesTouchedCount: meta.filesTouched.size,
        filesTouched: Array.from(meta.filesTouched),
        compactionCount: meta.compactionCount,
        model: modelInfo,
        mode,
      };

    } catch (err) {
      console.log('AgentLens: Error reading Claude Code sessions:', err);
    }
  }

  /** Parse Claude Code JSONL lines into session metadata + token usage */
  private parseClaudeSession(sessionId: string, lines: string[]): ClaudeSessionMeta | null {
    const meta: ClaudeSessionMeta = {
      sessionId,
      turnCount: 0,
      toolCallCount: 0,
      filesTouched: new Set(),
      lastActivity: Date.now(),
      state: 'idle',
      compactionCount: 0,
      tokenUsage: 0,
      hasEditTools: false,
    };

    // Task candidates: collect up to 5 post-compaction user messages, score them,
    // pick the best one. Reset after every compaction to anchor to the current segment.
    const taskCandidates: Array<{ text: string; score: number }> = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const msg = entry.message;

        // Token usage — latest entry wins (most recent)
        const usageObj = entry.usage || (msg && msg.usage);
        if (usageObj) {
          const u = usageObj;
          meta.tokenUsage = (u.input_tokens || 0)
            + (u.cache_creation_input_tokens || 0)
            + (u.cache_read_input_tokens || 0);
        }
        if (entry.costData) {
          const cd = entry.costData;
          meta.tokenUsage = (cd.inputTokens || 0)
            + (cd.cacheCreationInputTokens || 0)
            + (cd.cacheReadInputTokens || 0);
        }

        if (!msg) continue;

        // Model from assistant messages
        if (msg.role === 'assistant' && (entry.model || msg.model)) {
          meta.model = entry.model || msg.model;
        }

        // User turns: unified compaction + mode extraction + task scoring
        if (msg.role === 'user') {
          meta.turnCount++;

          const isCompaction = typeof msg.content === 'string' &&
            (msg.content.includes('[compacted]') || msg.content.includes('conversation summary'));

          if (isCompaction) {
            meta.compactionCount++;
            meta.state = 'compacting';
            // Post-compaction anchor: reset candidates so we pick up the new session's task
            taskCandidates.length = 0;
          } else {
            // Scan all content blocks for mode signals (tool_result) and task text
            const blocks: any[] = Array.isArray(msg.content)
              ? msg.content
              : typeof msg.content === 'string'
                ? [{ type: 'text', text: msg.content }]
                : [];

            for (const block of blocks) {
              // Mode detection: scan tool_result blocks for "Entered/Exited plan mode"
              if (block.type === 'tool_result') {
                const resultText = typeof block.content === 'string'
                  ? block.content
                  : Array.isArray(block.content)
                    ? block.content.find((c: any) => c.type === 'text')?.text ?? ''
                    : '';
                if (/entered plan mode/i.test(resultText)) {
                  meta.detectedMode = 'Plan mode';
                } else if (/exited plan mode/i.test(resultText)) {
                  meta.detectedMode = undefined;
                }
              }

              // Task scoring: extract text from user text blocks
              if (block.type === 'text' && taskCandidates.length < 5) {
                const raw: string = block.text ?? '';
                if (raw.length > 0) {
                  // Strip all XML injection blocks before scoring
                  const stripped = raw.replace(/<[a-z][a-z-]*>[\s\S]*?<\/[a-z][a-z-]*>\s*/gi, '').trim();
                  if (stripped.length > 0) {
                    taskCandidates.push({ text: stripped, score: scoreTaskCandidate(stripped) });
                  }
                }
              }
            }
          }
        }

        // Tool calls: count, files, state
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'tool_use') {
              meta.toolCallCount++;
              const input = block.input;
              if (input?.file_path) meta.filesTouched.add(input.file_path);
              if (input?.path) meta.filesTouched.add(input.path);
              // Bash command regex heuristic removed (Issue 47): it captured regex fragments
              // and JSON tokens as fake file paths. Structured tool inputs above are sufficient.

              const name = block.name;
              if (name === 'Read' || name === 'Grep' || name === 'Glob' || name === 'LS') {
                meta.state = 'reading-files';
              } else if (name === 'Write' || name === 'Edit' || name === 'MultiEdit') {
                meta.state = 'writing-code';
                meta.hasEditTools = true;
              } else if (name === 'Bash') {
                meta.state = 'running-terminal';
              } else if (name === 'Task') {
                meta.state = 'executing';
              } else {
                meta.state = 'tool-calling';
              }
            }

            if (block.type === 'thinking') {
              meta.state = 'thinking';
            }
          }
        }

      } catch {
        // Skip malformed lines
      }
    }

    // Pick best-scoring task candidate (score > -3 to avoid locking in noise)
    if (taskCandidates.length > 0) {
      const best = taskCandidates.reduce((a, b) => a.score >= b.score ? a : b);
      if (best.score > -3) {
        meta.currentTask = best.text.substring(0, 80) + (best.text.length > 80 ? '...' : '');
      }
    }

    return meta.turnCount > 0 ? meta : null;
  }

  isDetected(): boolean {
    return this.detected;
  }

  getAgent(): DetectedAgent | null {
    if (!this.detected) return null;
    return {
      type: this.agentType,
      displayName: this.displayName,
      isInstalled: true,
      sessions: this.session ? [this.session] : [],
      availableModels: this.model ? [this.model] : [],
    };
  }

  getAllModels(): DetectedModel[] {
    return this.model ? [this.model] : [];
  }

  getActiveSession(): AgentSession | null {
    return this.session?.isActive ? this.session : null;
  }

  getTokenUsage(): number {
    return this.latestTokenUsage;
  }

  /** Get files touched by the current session */
  getFilesTouched(): string[] {
    return this.latestFilesTouched;
  }

  /** Get the JSONL file mtime — used by StateManager for liveness */
  getSessionFileMtime(): number {
    return this.sessionFileMtime;
  }

  dispose(): void {
    this.session = null;
    this.model = null;
    this.latestFilesTouched = [];
  }
}
