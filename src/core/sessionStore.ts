/**
 * Session Store — JSON file persistence for session summaries.
 * Stores session history at <workspace>/.agentlens/sessions.json
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SessionSummary } from '../types';

const SESSIONS_FILE = '.agentlens/sessions.json';
const MAX_SESSIONS = 100;

export class SessionStore {
  private sessions: SessionSummary[] = [];
  private filePath: string | undefined;

  constructor() {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (root) {
      this.filePath = path.join(root, SESSIONS_FILE);
    }
  }

  async load(): Promise<void> {
    if (!this.filePath) return;

    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          this.sessions = data;
        }
      }
    } catch (err) {
      console.warn('AgentLens: Failed to load session store:', err);
      this.sessions = [];
    }
  }

  async save(): Promise<void> {
    if (!this.filePath) return;

    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.sessions, null, 2), 'utf-8');
    } catch (err) {
      console.warn('AgentLens: Failed to save session store:', err);
    }
  }

  addSession(summary: SessionSummary): void {
    // Update existing or add new
    const idx = this.sessions.findIndex(s => s.id === summary.id);
    if (idx >= 0) {
      this.sessions[idx] = summary;
    } else {
      this.sessions.push(summary);
    }

    // Trim to max
    if (this.sessions.length > MAX_SESSIONS) {
      this.sessions = this.sessions.slice(-MAX_SESSIONS);
    }

    this.save();
  }

  getSessions(): SessionSummary[] {
    return [...this.sessions];
  }

  getSession(id: string): SessionSummary | undefined {
    return this.sessions.find(s => s.id === id);
  }
}
