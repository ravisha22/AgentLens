/**
 * Copilot Adapter — Detects GitHub Copilot via VS Code LM API and extensions.
 * Uses diff-based model updates (not clear-and-rebuild) to prevent flip-flopping.
 */

import * as vscode from 'vscode';
import { IAgentAdapter } from './IAgentAdapter';
import { AgentType, DetectedAgent, DetectedModel, AgentSession } from '../types';

const COPILOT_EXTENSIONS = ['github.copilot', 'github.copilot-chat'];

export class CopilotAdapter implements IAgentAdapter {
  readonly agentType: AgentType = 'copilot';
  readonly displayName = 'GitHub Copilot';

  private models: Map<string, DetectedModel> = new Map();
  private installed = false;
  private extensionId: string | undefined;

  async detect(): Promise<void> {
    // Check extension installation
    this.installed = COPILOT_EXTENSIONS.some(id =>
      vscode.extensions.getExtension(id) !== undefined
    );
    this.extensionId = COPILOT_EXTENSIONS.find(id =>
      vscode.extensions.getExtension(id) !== undefined
    );

    // Enumerate models via LM API (diff-based update)
    try {
      const freshModels = await vscode.lm.selectChatModels({});
      const freshIds = new Set<string>();

      for (const model of freshModels) {
        freshIds.add(model.id);
        if (!this.models.has(model.id)) {
          this.models.set(model.id, {
            id: model.id,
            name: model.name,
            family: model.family,
            vendor: model.vendor,
            maxInputTokens: model.maxInputTokens,
            maxOutputTokens: 0,
            isActive: false,
          });
        } else {
          // Update existing model's specs (they might change)
          const existing = this.models.get(model.id)!;
          existing.maxInputTokens = model.maxInputTokens;
        }
      }

      // Remove models that disappeared
      for (const id of this.models.keys()) {
        if (!freshIds.has(id)) {
          this.models.delete(id);
        }
      }
    } catch {
      // LM API not available
    }
  }

  isDetected(): boolean {
    return this.installed || this.models.size > 0;
  }

  getAgent(): DetectedAgent | null {
    if (!this.isDetected()) return null;
    return {
      type: this.agentType,
      displayName: this.displayName,
      isInstalled: this.installed,
      extensionId: this.extensionId,
      sessions: [],
      availableModels: Array.from(this.models.values()),
    };
  }

  getAllModels(): DetectedModel[] {
    return Array.from(this.models.values());
  }

  getActiveSession(): AgentSession | null {
    return null; // Copilot doesn't expose session data
  }

  getTokenUsage(): number {
    return 0; // Copilot doesn't expose token usage
  }

  dispose(): void {
    this.models.clear();
  }
}
