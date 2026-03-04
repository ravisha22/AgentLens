/**
 * File Tracker v2 — Real File Tracking
 * 
 * Tracks three distinct file states:
 * 1. in-context: Files the agent has read (detected from Claude Code logs or Chat Debug View)
 * 2. modified: Files changed since session start (detected via fs watcher)
 * 3. always-present: User-configured files that should always be in context (capped at 50%)
 * 
 * Critical file criteria:
 * - architecture, schema, agent-instructions, api-contract categories = auto-critical
 * - User can override via settings or UI toggle
 * 
 * Display: Shows top N files (configurable 3-5), rest in collapsed view.
 */

import * as vscode from 'vscode';
import { TrackedFile, FileVisibility, FileCategory } from '../types';
import { ContextCalculator } from './contextCalculator';

/** Patterns for auto-detecting project files */
const AUTO_DETECT_PATTERNS: Array<{
  glob: string;
  category: FileCategory;
  displayHint: string;
}> = [
  // Architecture & Design
  { glob: '**/ARCHITECTURE.md', category: 'architecture', displayHint: 'Architecture doc' },
  { glob: '**/DESIGN.md', category: 'architecture', displayHint: 'Design doc' },
  { glob: '**/SYSTEM_DESIGN.md', category: 'architecture', displayHint: 'System design' },
  { glob: '**/docs/architecture/**/*.md', category: 'architecture', displayHint: 'Architecture docs' },

  // Agent Instructions
  { glob: '**/CLAUDE.md', category: 'agent-instructions', displayHint: 'Claude instructions' },
  { glob: '**/.github/copilot-instructions.md', category: 'agent-instructions', displayHint: 'Copilot instructions' },
  { glob: '**/AGENTS.md', category: 'agent-instructions', displayHint: 'Agent guidance' },
  { glob: '**/.cursorrules', category: 'agent-instructions', displayHint: 'Cursor rules' },
  { glob: '**/.clinerules', category: 'agent-instructions', displayHint: 'Cline rules' },

  // Schema & Data Models
  { glob: '**/schema.prisma', category: 'schema', displayHint: 'Prisma schema' },
  { glob: '**/schema.graphql', category: 'schema', displayHint: 'GraphQL schema' },
  { glob: '**/schema.sql', category: 'schema', displayHint: 'SQL schema' },

  // API Contracts
  { glob: '**/openapi.yaml', category: 'api-contract', displayHint: 'OpenAPI spec' },
  { glob: '**/openapi.json', category: 'api-contract', displayHint: 'OpenAPI spec' },
  { glob: '**/swagger.yaml', category: 'api-contract', displayHint: 'Swagger spec' },

  // Configuration
  { glob: '**/tsconfig.json', category: 'config', displayHint: 'TypeScript config' },
  { glob: '**/package.json', category: 'config', displayHint: 'Package manifest' },
  { glob: '**/docker-compose.yml', category: 'config', displayHint: 'Docker config' },

  // Documentation
  { glob: '**/README.md', category: 'documentation', displayHint: 'README' },
  { glob: '**/CONTRIBUTING.md', category: 'documentation', displayHint: 'Contributing guide' },
  { glob: '**/CHANGELOG.md', category: 'documentation', displayHint: 'Changelog' },

  // Tests & Requirements
  { glob: '**/acceptance-criteria.md', category: 'test', displayHint: 'Acceptance criteria' },
  { glob: '**/test-plan.md', category: 'test', displayHint: 'Test plan' },
  { glob: '**/PRD.md', category: 'requirements', displayHint: 'Product requirements' },
];

/** Categories that are auto-critical */
const CRITICAL_CATEGORIES: FileCategory[] = ['architecture', 'schema', 'agent-instructions', 'api-contract'];

export class FileTracker {
  private trackedFiles: Map<string, TrackedFile> = new Map();
  private modifiedFiles: Set<string> = new Set();
  private inContextFiles: Set<string> = new Set();
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private workspaceRoot: string | undefined;

  constructor() {
    const folders = vscode.workspace.workspaceFolders;
    this.workspaceRoot = folders?.[0]?.uri.fsPath;
    this.setupFileWatcher();
  }

  /** Watch for file modifications in the workspace */
  private setupFileWatcher(): void {
    if (!this.workspaceRoot) return;
    this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*', false, false, false);
    this.fileWatcher.onDidChange(uri => {
      const rel = vscode.workspace.asRelativePath(uri);
      if (this.trackedFiles.has(rel)) {
        this.modifiedFiles.add(rel);
        const file = this.trackedFiles.get(rel)!;
        file.lastModifiedAt = Date.now();
        if (file.visibility !== 'in-context' && file.visibility !== 'always-present') {
          file.visibility = 'modified';
        }
      }
    });
  }

  /** Scan workspace for trackable files */
  async scanForFiles(): Promise<TrackedFile[]> {
    if (!this.workspaceRoot) return [];

    const autoDetect = vscode.workspace
      .getConfiguration('agentlens')
      .get<boolean>('autoDetectCriticalFiles', true);

    if (autoDetect) {
      for (const pattern of AUTO_DETECT_PATTERNS) {
        try {
          const files = await vscode.workspace.findFiles(pattern.glob, '**/node_modules/**', 3);
          for (const file of files) {
            const relativePath = vscode.workspace.asRelativePath(file);
            if (!this.trackedFiles.has(relativePath)) {
              const stat = await vscode.workspace.fs.stat(file);
              this.trackedFiles.set(relativePath, {
                relativePath,
                absolutePath: file.fsPath,
                visibility: 'watched',
                tokenCost: ContextCalculator.estimateTokensFromBytes(stat.size),
                isCritical: CRITICAL_CATEGORIES.includes(pattern.category),
                isAlwaysPresent: false,
                trackingReason: 'auto-detected',
                category: pattern.category,
                lastModifiedAt: stat.mtime,
              });
            }
          }
        } catch { /* pattern didn't match */ }
      }
    }

    // Add user-configured critical files
    const userCritical = vscode.workspace
      .getConfiguration('agentlens')
      .get<string[]>('criticalFiles', []);
    for (const pattern of userCritical) {
      await this.addUserFiles(pattern, true, false);
    }

    // Add always-present files
    const alwaysPresent = vscode.workspace
      .getConfiguration('agentlens')
      .get<string[]>('alwaysPresentFiles', []);
    for (const pattern of alwaysPresent) {
      await this.addUserFiles(pattern, true, true);
    }

    return this.getTrackedFiles();
  }

  private async addUserFiles(pattern: string, critical: boolean, alwaysPresent: boolean): Promise<void> {
    try {
      const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 10);
      for (const file of files) {
        const rel = vscode.workspace.asRelativePath(file);
        const existing = this.trackedFiles.get(rel);
        if (existing) {
          if (critical) existing.isCritical = true;
          if (alwaysPresent) {
            existing.isAlwaysPresent = true;
            existing.visibility = 'always-present';
            existing.trackingReason = 'always-present';
          } else {
            existing.trackingReason = 'user-configured';
          }
        } else {
          const stat = await vscode.workspace.fs.stat(file);
          this.trackedFiles.set(rel, {
            relativePath: rel,
            absolutePath: file.fsPath,
            visibility: alwaysPresent ? 'always-present' : 'watched',
            tokenCost: ContextCalculator.estimateTokensFromBytes(stat.size),
            isCritical: critical,
            isAlwaysPresent: alwaysPresent,
            trackingReason: alwaysPresent ? 'always-present' : 'user-configured',
            category: 'other',
            lastModifiedAt: stat.mtime,
          });
        }
      }
    } catch { /* Continue */ }
  }

  /** Mark files as in-context (from real agent data) */
  markInContext(paths: string[]): void {
    this.inContextFiles = new Set(paths);
    for (const [rel, file] of this.trackedFiles) {
      if (paths.includes(rel)) {
        file.visibility = file.isAlwaysPresent ? 'always-present' : 'in-context';
        file.lastSeenAt = Date.now();
        file.lostAt = undefined;
      }
    }
  }

  /**
   * Add files touched by the agent dynamically.
   * v3.1: Called from StateManager on each poll with files from Claude Code JSONL.
   * Adds new files as 'in-context' and updates existing files' visibility.
   */
  addAgentFiles(filePaths: string[]): void {
    for (const filePath of filePaths) {
      // Normalize: could be absolute or relative
      let rel: string;
      if (this.workspaceRoot && filePath.startsWith(this.workspaceRoot.replace(/\\/g, '/'))) {
        rel = filePath.substring(this.workspaceRoot.length + 1).replace(/\\/g, '/');
      } else if (this.workspaceRoot && filePath.replace(/\\/g, '/').startsWith(this.workspaceRoot.replace(/\\/g, '/'))) {
        rel = filePath.replace(/\\/g, '/').substring(this.workspaceRoot.replace(/\\/g, '/').length + 1);
      } else {
        rel = vscode.workspace.asRelativePath(filePath);
      }

      // Skip empty paths (e.g. when filePath is exactly the workspace root)
      if (!rel || rel === '.') continue;

      // Skip absolute paths that are outside the workspace
      // (asRelativePath returns the input unchanged if outside workspace)
      const isAbsolute = /^[a-zA-Z]:[\\/]/.test(filePath) || filePath.startsWith('/');
      if (rel === filePath && isAbsolute) {
        continue;
      }

      const existing = this.trackedFiles.get(rel);
      if (existing) {
        // Update existing: mark in-context if not always-present
        if (existing.visibility !== 'always-present') {
          existing.visibility = 'in-context';
        }
        existing.lastSeenAt = Date.now();
        // Back-fill token cost if it was never populated
        if (existing.tokenCost === 0) {
          this.populateTokenCost(rel, existing.absolutePath);
        }
      } else {
        // Add new tracked file from agent activity
        const category = this.inferCategory(rel);
        const absolutePath = this.workspaceRoot ? `${this.workspaceRoot}/${rel}` : rel;
        this.trackedFiles.set(rel, {
          relativePath: rel,
          absolutePath,
          visibility: 'in-context',
          tokenCost: 0,
          isCritical: false,
          isAlwaysPresent: false,
          trackingReason: 'agent-activity',
          category,
          lastSeenAt: Date.now(),
        });
        // Populate token cost asynchronously — fire-and-forget
        this.populateTokenCost(rel, absolutePath);
      }
    }
  }

  /** Async stat a file and back-fill its tokenCost. Fire-and-forget safe. */
  private async populateTokenCost(relativePath: string, absolutePath: string): Promise<void> {
    try {
      const uri = vscode.Uri.file(absolutePath);
      const stat = await vscode.workspace.fs.stat(uri);
      const file = this.trackedFiles.get(relativePath);
      if (file && file.tokenCost === 0) {
        file.tokenCost = ContextCalculator.estimateTokensFromBytes(stat.size);
      }
    } catch { /* file outside workspace or not yet on disk — leave as 0 */ }
  }

  /** Infer file category from path */
  private inferCategory(relativePath: string): import('../types').FileCategory {
    const lower = relativePath.toLowerCase();
    if (lower.endsWith('.md')) {
      if (lower.includes('architecture') || lower.includes('design')) return 'architecture';
      if (lower.includes('readme') || lower.includes('contributing') || lower.includes('changelog')) return 'documentation';
      if (lower.includes('claude') || lower.includes('agent') || lower.includes('copilot')) return 'agent-instructions';
      if (lower.includes('test') || lower.includes('acceptance')) return 'test';
      if (lower.includes('api')) return 'api-contract';
      return 'documentation';
    }
    if (lower.endsWith('.prisma') || lower.endsWith('.graphql') || lower.endsWith('.sql')) return 'schema';
    if (lower.includes('openapi') || lower.includes('swagger')) return 'api-contract';
    if (lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.yml') || lower.endsWith('.toml')) return 'config';
    if (lower.includes('test') || lower.includes('spec')) return 'test';
    return 'source';
  }

  /** Mark files as lost (after compaction) */
  markLost(paths: string[]): void {
    for (const rel of paths) {
      const file = this.trackedFiles.get(rel);
      if (file && file.visibility === 'in-context') {
        file.visibility = 'lost';
        file.lostAt = Date.now();
      }
    }
  }

  /** Handle auto-inject: re-inject always-present files that fell out of context */
  getFilesNeedingReinjection(): TrackedFile[] {
    const autoInject = vscode.workspace
      .getConfiguration('agentlens')
      .get<boolean>('autoInjectOnLoss', true);

    if (!autoInject) return [];

    return Array.from(this.trackedFiles.values())
      .filter(f => f.isAlwaysPresent && f.visibility === 'lost');
  }

  /** Calculate total token cost of always-present files */
  getAlwaysPresentTokenCost(): number {
    return Array.from(this.trackedFiles.values())
      .filter(f => f.isAlwaysPresent)
      .reduce((sum, f) => sum + f.tokenCost, 0);
  }

  /** Check if always-present files exceed the context budget */
  exceedsContextBudget(maxContextTokens: number): boolean {
    const maxPercent = vscode.workspace
      .getConfiguration('agentlens')
      .get<number>('alwaysPresentMaxPercent', 50);
    const budget = (maxPercent / 100) * maxContextTokens;
    return this.getAlwaysPresentTokenCost() > budget;
  }

  /** Toggle always-present status */
  toggleAlwaysPresent(relativePath: string): boolean {
    const file = this.trackedFiles.get(relativePath);
    if (file) {
      file.isAlwaysPresent = !file.isAlwaysPresent;
      if (file.isAlwaysPresent) {
        file.visibility = 'always-present';
        file.trackingReason = 'always-present';
      } else {
        file.visibility = 'watched';
        file.trackingReason = 'auto-detected';
      }
      return file.isAlwaysPresent;
    }
    return false;
  }

  /** Toggle critical status */
  toggleCritical(relativePath: string): boolean {
    const file = this.trackedFiles.get(relativePath);
    if (file) {
      file.isCritical = !file.isCritical;
      return file.isCritical;
    }
    return false;
  }

  /** Get all tracked files, sorted: always-present first, then in-context, then critical, then rest */
  getTrackedFiles(): TrackedFile[] {
    return Array.from(this.trackedFiles.values())
      .sort((a, b) => {
        const visOrder: Record<FileVisibility, number> = {
          'always-present': 0, 'in-context': 1, 'lost': 2, 'modified': 3, 'watched': 4,
        };
        if (visOrder[a.visibility] !== visOrder[b.visibility]) {
          return visOrder[a.visibility] - visOrder[b.visibility];
        }
        if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
        return a.relativePath.localeCompare(b.relativePath);
      });
  }

  /** Get summary counts */
  getSummary(): {
    total: number; inContext: number; alwaysPresent: number;
    critical: number; criticalInContext: number; lost: number; modified: number;
  } {
    const files = Array.from(this.trackedFiles.values());
    const critical = files.filter(f => f.isCritical);
    return {
      total: files.length,
      inContext: files.filter(f => f.visibility === 'in-context' || f.visibility === 'always-present').length,
      alwaysPresent: files.filter(f => f.isAlwaysPresent).length,
      critical: critical.length,
      criticalInContext: critical.filter(f =>
        f.visibility === 'in-context' || f.visibility === 'always-present'
      ).length,
      lost: files.filter(f => f.visibility === 'lost').length,
      modified: this.modifiedFiles.size,
    };
  }

  dispose(): void {
    this.fileWatcher?.dispose();
  }
}
