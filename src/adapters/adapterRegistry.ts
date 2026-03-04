/**
 * Adapter Registry — Aggregates all agent adapters.
 * No internal timers. detectAll() is called by StateManager on each poll cycle.
 */

import * as vscode from 'vscode';
import { IAgentAdapter } from './IAgentAdapter';
import { AgentType, DetectedAgent, DetectedModel, AgentSession } from '../types';

export class AdapterRegistry {
  private adapters: Map<AgentType, IAgentAdapter> = new Map();
  private lastKnownActiveModelId: string | undefined;

  private _onModelChanged = new vscode.EventEmitter<DetectedModel>();
  public readonly onModelChanged = this._onModelChanged.event;

  register(adapter: IAgentAdapter): void {
    this.adapters.set(adapter.agentType, adapter);
  }

  /** Call detect() on all adapters sequentially. Fires onModelChanged if model switches. */
  async detectAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      try {
        await adapter.detect();
      } catch (err) {
        console.warn(`AgentLens: ${adapter.displayName} adapter detect() failed:`, err);
      }
    }

    const previousModelId = this.lastKnownActiveModelId; // snapshot before getActiveModel() mutates
    const current = this.getActiveModel();
    if (current && current.id !== previousModelId) {
      this._onModelChanged.fire(current);
    }
  }

  getAdapter(type: AgentType): IAgentAdapter | undefined {
    return this.adapters.get(type);
  }

  getDetectedAgents(): DetectedAgent[] {
    const agents: DetectedAgent[] = [];
    for (const adapter of this.adapters.values()) {
      const agent = adapter.getAgent();
      if (agent) {
        agents.push(agent);
      }
    }
    return agents;
  }

  /** Get the currently active model with stability logic to prevent flip-flopping. */
  getActiveModel(): DetectedModel | undefined {
    // Priority 1: Model from an active session (most reliable)
    for (const adapter of this.adapters.values()) {
      const session = adapter.getActiveSession();
      if (session?.model) {
        this.lastKnownActiveModelId = session.model.id;
        return session.model;
      }
    }

    // Priority 2: Stick with last known model (prevents flip-flopping)
    if (this.lastKnownActiveModelId) {
      for (const adapter of this.adapters.values()) {
        const model = adapter.getAllModels().find(m => m.id === this.lastKnownActiveModelId);
        if (model) {
          return model;
        }
      }
    }

    // Priority 3: First available model from any adapter
    for (const adapter of this.adapters.values()) {
      const models = adapter.getAllModels();
      if (models.length > 0) {
        this.lastKnownActiveModelId = models[0].id;
        return models[0];
      }
    }

    return undefined;
  }

  getActiveSession(): AgentSession | undefined {
    for (const adapter of this.adapters.values()) {
      const session = adapter.getActiveSession();
      if (session) {
        return session;
      }
    }
    return undefined;
  }

  getAllModels(): DetectedModel[] {
    const models: DetectedModel[] = [];
    for (const adapter of this.adapters.values()) {
      models.push(...adapter.getAllModels());
    }
    return models;
  }

  dispose(): void {
    for (const adapter of this.adapters.values()) {
      adapter.dispose();
    }
    this._onModelChanged.dispose();
  }
}
