/**
 * Cline Adapter — Detects Cline via extension.
 */

import * as vscode from 'vscode';
import { IAgentAdapter } from './IAgentAdapter';
import { AgentType, DetectedAgent, DetectedModel, AgentSession } from '../types';

export class ClineAdapter implements IAgentAdapter {
  readonly agentType: AgentType = 'cline';
  readonly displayName = 'Cline';

  private installed = false;

  async detect(): Promise<void> {
    this.installed = vscode.extensions.getExtension('saoudrizwan.claude-dev') !== undefined;
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
      extensionId: 'saoudrizwan.claude-dev',
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
