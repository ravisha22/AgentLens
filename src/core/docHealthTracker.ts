/**
 * Documentation Health Tracker v2 — Manifest-Driven
 * 
 * Health is measured based on:
 * 1. Presence of a doc requirements manifest (.agentlens/doc-requirements.json)
 *    - If absent, uses sensible defaults
 * 2. Presence of doc files matching the manifest requirements
 * 3. Doc freshness (staleness detection)
 * 4. Doc depth (word count vs minimum, expected sections)
 * 5. Agent vs human maintenance (detects if last modifier was an agent via git)
 * 
 * If no docs exist at all → score 0, status RED, noDocs=true
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
  DocumentationItem, DocumentationHealth, DocType, DocHealth,
  DocRequirement, DocManifest,
} from '../types';
import { ContextCalculator } from './contextCalculator';

/** Default manifest used when user hasn't created .agentlens/doc-requirements.json */
const DEFAULT_MANIFEST: DocManifest = {
  version: '1.0',
  requirements: [
    {
      docType: 'readme',
      displayName: 'README',
      patterns: ['README.md', 'readme.md'],
      required: true,
      staleDays: 90,
      expectedSections: ['Overview', 'Getting Started', 'Usage'],
      minWordCount: 100,
      maintainer: 'either',
    },
    {
      docType: 'architecture-docs',
      displayName: 'Architecture',
      patterns: ['ARCHITECTURE.md', 'docs/architecture/**/*.md', 'DESIGN.md'],
      required: true,
      staleDays: 60,
      expectedSections: ['Overview', 'Components', 'Data Flow'],
      minWordCount: 200,
      maintainer: 'human',
    },
    {
      docType: 'agent-instructions',
      displayName: 'Agent Instructions',
      patterns: ['CLAUDE.md', '.github/copilot-instructions.md', 'AGENTS.md', '.cursorrules'],
      required: true,
      staleDays: 30,
      minWordCount: 50,
      maintainer: 'human',
    },
    {
      docType: 'api-docs',
      displayName: 'API Documentation',
      patterns: ['openapi.yaml', 'openapi.json', 'swagger.yaml', 'API.md', 'docs/api/**/*.md'],
      required: false,
      staleDays: 30,
      maintainer: 'either',
    },
    {
      docType: 'test-cases',
      displayName: 'Test Documentation',
      patterns: ['TESTING.md', 'test-plan.md', 'tests/README.md'],
      required: false,
      staleDays: 60,
      maintainer: 'either',
    },
    {
      docType: 'acceptance-criteria',
      displayName: 'Acceptance Criteria',
      patterns: ['acceptance-criteria.md', 'docs/acceptance/**/*.md'],
      required: false,
      staleDays: 30,
      maintainer: 'human',
    },
    {
      docType: 'user-docs',
      displayName: 'User Documentation',
      patterns: ['docs/user/**/*.md', 'USER_GUIDE.md', 'USAGE.md'],
      required: false,
      staleDays: 60,
      maintainer: 'either',
    },
    {
      docType: 'changelog',
      displayName: 'Changelog',
      patterns: ['CHANGELOG.md', 'HISTORY.md'],
      required: false,
      staleDays: 30,
      maintainer: 'agent',
    },
    {
      docType: 'runbook',
      displayName: 'Runbook',
      patterns: ['RUNBOOK.md', 'docs/operations/**/*.md'],
      required: false,
      staleDays: 90,
      maintainer: 'human',
    },
  ],
};

export class DocHealthTracker {
  private items: Map<DocType, DocumentationItem> = new Map();
  private manifest: DocManifest = DEFAULT_MANIFEST;
  private usingDefault: boolean = true;
  private isScanning: boolean = false;
  private agentTouchedFiles: Set<string> = new Set(); // Issue 32: tracks session-touched files

  /** Accumulate files touched by the agent this session (union — never shrinks during a session) */
  setAgentTouchedFiles(files: string[]): void {
    for (const f of files) this.agentTouchedFiles.add(f);
  }

  /** Load the manifest from workspace or use defaults */
  async loadManifest(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;

    const manifestPath = path.join(workspaceRoot, '.agentlens', 'doc-requirements.json');
    try {
      const content = await vscode.workspace.fs.readFile(vscode.Uri.file(manifestPath));
      const parsed = JSON.parse(Buffer.from(content).toString('utf-8')) as DocManifest;
      if (parsed.requirements && Array.isArray(parsed.requirements)) {
        this.manifest = parsed;
        this.usingDefault = false;
      }
    } catch {
      // File doesn't exist — use defaults
      this.usingDefault = true;
    }
  }

  /** Scan workspace and assess documentation health against manifest */
  async scan(): Promise<DocumentationHealth> {
    // Guard: skip if a scan is already in progress — prevents concurrent polls
    // from interleaving set() calls into the shared items Map and causing flicker.
    if (this.isScanning) return this.getHealth();
    this.isScanning = true;

    // Build into a fresh map; only swap this.items at the very end so that
    // getHealth() always sees either the previous complete scan or the new one —
    // never an empty or partially-populated intermediate state.
    const newItems = new Map<DocType, DocumentationItem>();
    const now = Date.now();

    try {
      for (const req of this.manifest.requirements) {
        let found = false;

        for (const pattern of req.patterns) {
          try {
            const files = await vscode.workspace.findFiles(
              `**/${pattern}`, '**/node_modules/**', 3
            );
            if (files.length > 0) {
              found = true;
              const file = files[0];
              const stat = await vscode.workspace.fs.stat(file);
              const daysSinceUpdate = Math.floor((now - stat.mtime) / (1000 * 60 * 60 * 24));
              const tokenCost = ContextCalculator.estimateTokensFromBytes(stat.size);

              // Read content for depth analysis
              let wordCount: number | undefined;
              let missingSections: string[] | undefined;
              try {
                const content = await vscode.workspace.fs.readFile(file);
                const text = Buffer.from(content).toString('utf-8');
                wordCount = text.split(/\s+/).filter(Boolean).length;

                // Check for expected sections
                if (req.expectedSections && req.expectedSections.length > 0) {
                  missingSections = [];
                  for (const section of req.expectedSections) {
                    const regex = new RegExp(`^#{1,3}\\s+.*${section}`, 'im');
                    if (!regex.test(text)) {
                      missingSections.push(section);
                    }
                  }
                  if (missingSections.length === 0) missingSections = undefined;
                }
              } catch { /* skip content analysis */ }

              // Determine health
              let health: DocHealth = 'healthy';
              if (daysSinceUpdate > req.staleDays * 2) {
                health = 'outdated';
              } else if (daysSinceUpdate > req.staleDays) {
                health = 'stale';
              }
              // Check depth
              if (health === 'healthy' && req.minWordCount && wordCount !== undefined) {
                if (wordCount < req.minWordCount) {
                  health = 'incomplete';
                }
              }
              // Check missing sections
              if (health === 'healthy' && missingSections && missingSections.length > 0) {
                health = 'incomplete';
              }

              // Detect if last update was by an agent
              const lastUpdatedByAgent = await this.checkIfAgentUpdated(file);

              newItems.set(req.docType, {
                docType: req.docType,
                displayName: req.displayName,
                filePath: vscode.workspace.asRelativePath(file),
                health,
                lastModified: stat.mtime,
                tokenCost,
                inContext: false,
                daysSinceUpdate,
                required: req.required,
                maintainer: req.maintainer,
                missingSections,
                wordCount,
                minWordCount: req.minWordCount,
                lastUpdatedByAgent,
              });
              break;
            }
          } catch { /* continue */ }
        }

        if (!found) {
          newItems.set(req.docType, {
            docType: req.docType,
            displayName: req.displayName,
            health: 'missing',
            inContext: false,
            required: req.required,
            maintainer: req.maintainer,
            minWordCount: req.minWordCount,
          });
        }
      }

      // Atomic swap — replaces the old complete snapshot with the new one.
      // No caller ever sees an empty or partial map.
      this.items = newItems;
    } finally {
      this.isScanning = false;
    }

    return this.getHealth();
  }

  /** Check if the agent touched this file during the current session (Issue 32: Option C) */
  private async checkIfAgentUpdated(fileUri: vscode.Uri): Promise<boolean> {
    const relPath = vscode.workspace.asRelativePath(fileUri).replace(/\\/g, '/');
    const absPath = fileUri.fsPath.replace(/\\/g, '/');
    for (const touchedPath of this.agentTouchedFiles) {
      const n = touchedPath.replace(/\\/g, '/');
      if (n === relPath || n === absPath ||
          absPath.endsWith('/' + n) || n.endsWith('/' + relPath)) {
        return true;
      }
    }
    return false;
  }

  /** Get the full health assessment */
  getHealth(): DocumentationHealth {
    const items = Array.from(this.items.values());
    const total = items.length;

    if (total === 0) {
      return { score: 0, items: [], healthyCount: 0, attentionCount: 0, missingCount: 0, noDocs: true, allMissing: false };
    }

    const healthyCount = items.filter(i => i.health === 'healthy').length;
    const missingCount = items.filter(i => i.health === 'missing').length;
    const attentionCount = items.filter(i =>
      i.health === 'stale' || i.health === 'outdated' || i.health === 'incomplete'
    ).length;

    // Score calculation: required docs weigh 2x
    let maxScore = 0;
    let actualScore = 0;
    for (const item of items) {
      const weight = item.required ? 2 : 1;
      maxScore += weight * 100;
      switch (item.health) {
        case 'healthy': actualScore += weight * 100; break;
        case 'incomplete': actualScore += weight * 60; break;
        case 'stale': actualScore += weight * 40; break;
        case 'outdated': actualScore += weight * 20; break;
        case 'missing': actualScore += 0; break;
      }
    }

    const score = maxScore > 0 ? Math.round((actualScore / maxScore) * 100) : 0;

    // noDocs = no manifest file (total === 0 handled above, so this is always false here)
    // allMissing = manifest exists but every doc file is absent
    const noDocs = false;
    const allMissing = items.every(i => i.health === 'missing');

    // Docs not updated in >24h (existing files only, not missing ones)
    const staleDocCount24h = items.filter(
      i => i.health !== 'missing' && i.daysSinceUpdate !== undefined && i.daysSinceUpdate >= 1
    ).length;

    return { score, items, healthyCount, attentionCount, missingCount, noDocs, allMissing, staleDocCount24h };
  }

  isUsingDefault(): boolean {
    return this.usingDefault;
  }

  /** Generate a default manifest file for the user */
  async createDefaultManifest(): Promise<string> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) throw new Error('No workspace open');

    const dir = path.join(workspaceRoot, '.agentlens');
    const filePath = path.join(dir, 'doc-requirements.json');

    await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
    const content = JSON.stringify(DEFAULT_MANIFEST, null, 2);
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(filePath),
      Buffer.from(content, 'utf-8')
    );

    return filePath;
  }

  /** Create missing documentation files with generated content */
  async createMissingDocs(): Promise<string[]> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) throw new Error('No workspace open');

    const created: string[] = [];

    for (const [docType, item] of this.items) {
      if (item.health !== 'missing') continue;

      const req = this.manifest.requirements.find(r => r.docType === docType);
      if (!req || req.patterns.length === 0) continue;

      // Use the first concrete (non-glob) pattern as the filename
      let fileName = req.patterns[0];
      for (const p of req.patterns) {
        if (!p.includes('*')) { fileName = p; break; }
      }

      const filePath = path.join(workspaceRoot, fileName);
      const dir = path.dirname(filePath);

      try {
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
        const content = await this.generateDocContent(req, workspaceRoot);
        await vscode.workspace.fs.writeFile(
          vscode.Uri.file(filePath),
          Buffer.from(content, 'utf-8')
        );
        created.push(fileName);
      } catch (err) {
        console.warn(`AgentLens: Failed to create ${fileName}:`, err);
      }
    }

    return created;
  }

  /** Update existing (non-missing) documentation files with fresh generated content */
  async updateDocs(docTypes?: string[]): Promise<string[]> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) throw new Error('No workspace open');

    const updated: string[] = [];

    for (const [docType, item] of this.items) {
      if (item.health === 'missing') continue;
      if (docTypes && !docTypes.includes(docType)) continue;
      if (!item.filePath) continue;

      const req = this.manifest.requirements.find(r => r.docType === docType);
      if (!req) continue;

      const absPath = path.join(workspaceRoot, item.filePath);
      try {
        const content = await this.generateDocContent(req, workspaceRoot);
        await vscode.workspace.fs.writeFile(
          vscode.Uri.file(absPath),
          Buffer.from(content, 'utf-8')
        );
        updated.push(item.filePath);
      } catch (err) {
        console.warn(`AgentLens: Failed to update ${item.filePath}:`, err);
      }
    }

    return updated;
  }

  /** Generate doc content — LM API first, structured extraction fallback */
  private async generateDocContent(req: DocRequirement, workspaceRoot: string): Promise<string> {
    const context = await this.collectProjectContext(workspaceRoot);
    const lmContent = await this.tryGenerateWithLM(req, context);
    if (lmContent) return lmContent;
    return this.buildStructuredContent(req, context);
  }

  /** Collect key project files as context strings */
  private async collectProjectContext(workspaceRoot: string): Promise<string> {
    const parts: string[] = [];

    // package.json — Node/JS projects
    try {
      const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(path.join(workspaceRoot, 'package.json')));
      const pkg = JSON.parse(Buffer.from(raw).toString('utf-8'));
      if (pkg.name) parts.push(`Project: ${pkg.name}`);
      if (pkg.description) parts.push(`Description: ${pkg.description}`);
      if (pkg.scripts) parts.push(`Scripts: ${Object.keys(pkg.scripts).join(', ')}`);
      if (pkg.dependencies) parts.push(`Dependencies: ${Object.keys(pkg.dependencies).slice(0, 15).join(', ')}`);
    } catch { /* not Node */ }

    // pyproject.toml — Python projects
    try {
      const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(path.join(workspaceRoot, 'pyproject.toml')));
      const text = Buffer.from(raw).toString('utf-8');
      const nameMatch = text.match(/name\s*=\s*"([^"]+)"/);
      const descMatch = text.match(/description\s*=\s*"([^"]+)"/);
      if (nameMatch) parts.push(`Project (Python): ${nameMatch[1]}`);
      if (descMatch) parts.push(`Description: ${descMatch[1]}`);
    } catch { /* not Python */ }

    // src/ directory listing
    try {
      const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(path.join(workspaceRoot, 'src')));
      parts.push(`Source structure: ${entries.map(([n]) => n).slice(0, 20).join(', ')}`);
    } catch { /* no src/ */ }

    // Existing README first 500 chars
    for (const name of ['README.md', 'readme.md']) {
      try {
        const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(path.join(workspaceRoot, name)));
        const text = Buffer.from(raw).toString('utf-8').substring(0, 500).trim();
        if (text) { parts.push(`README excerpt:\n${text}`); break; }
      } catch { /* skip */ }
    }

    return parts.join('\n');
  }

  /** Try to generate doc content via VS Code LM API (requires Copilot or similar) */
  private async tryGenerateWithLM(req: DocRequirement, context: string): Promise<string | null> {
    try {
      const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
      if (models.length === 0) return null;

      const sectionsHint = req.expectedSections?.length
        ? `\n\nMust include these markdown sections: ${req.expectedSections.join(', ')}`
        : '';
      const wordHint = req.minWordCount ? `\n\nAim for at least ${req.minWordCount} words.` : '';
      const prompt = [
        `Write a "${req.displayName}" markdown document for this project.`,
        '',
        context || 'No project context available.',
        sectionsHint,
        wordHint,
        '',
        `Write only the markdown content. Start with # ${req.displayName}.`,
      ].join('\n');

      const messages = [vscode.LanguageModelChatMessage.User(prompt)];
      const cts = new vscode.CancellationTokenSource();
      const response = await models[0].sendRequest(messages, {}, cts.token);

      let text = '';
      for await (const chunk of response.text) { text += chunk; }
      return text.trim() || null;
    } catch {
      return null;
    }
  }

  /** Build structured content from project context without LM */
  private buildStructuredContent(req: DocRequirement, context: string): string {
    const lines: string[] = [`# ${req.displayName}`, ''];

    const descMatch = context.match(/Description:\s*(.+)/);
    if (descMatch) {
      lines.push(`> ${descMatch[1].trim()}`, '');
    }

    if (req.expectedSections && req.expectedSections.length > 0) {
      for (const section of req.expectedSections) {
        lines.push(`## ${section}`, '', '_TODO: Add content._', '');
      }
    } else {
      lines.push('_TODO: Add content._', '');
    }

    return lines.join('\n');
  }

  dispose(): void { /* nothing to clean up */ }
}
