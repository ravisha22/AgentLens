/**
 * Cursor Adapter — Detects Cursor IDE via extension and file indicators.
 */

import * as vscode from 'vscode';
import { IAgentAdapter } from './IAgentAdapter';
import { AgentType, DetectedAgent, DetectedModel, AgentSession } from '../types';

export class CursorAdapter implements IAgentAdapter {
  readonly agentType: AgentType = 'cursor';
  readonly displayName = 'Cursor';

  private installed = false;

  async detect(): Promise<void> {
    this.installed = vscode.extensions.getExtension('cursor.cursor') !== undefined;
  }

  isDetected(): boolean {
    return this.installed;
  }

  getAgent(): DetectedAgent | null {
    if (!this.installed) return null;
    return {
      type: this.agentType,
      displayName: this.displayName,
      isInstalled: true,
      extensionId: 'cursor.cursor',
      sessions: [],
      availableModels: [],
    };
  }

  getAllModels(): DetectedModel[] {
    return [];
  }

  getActiveSession(): AgentSession | null {
    return null;
  }

  getTokenUsage(): number {
    return 0;
  }

  dispose(): void {}
}
