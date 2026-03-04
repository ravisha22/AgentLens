/**
 * Context Calculator v3 — Real Data Only
 * Logic unchanged from v2. Now properly wired via StateManager + AdapterRegistry
 * to receive real token usage data from Claude Code JSONL logs.
 */

import { ContextState, ContextThresholds, ContextZone, DetectedModel } from '../types';

export class ContextCalculator {
  private currentModel: DetectedModel | undefined;
  private tokenUsage: number = 0;
  private dataSource: string | undefined;

  setModel(model: DetectedModel): void {
    this.currentModel = model;
  }

  updateUsage(tokens: number, source: string): void {
    this.tokenUsage = tokens;
    this.dataSource = source;
  }

  static estimateTokensFromBytes(bytes: number): number {
    return Math.ceil(bytes / 4);
  }

  getState(thresholds: ContextThresholds): ContextState {
    if (!this.currentModel) {
      return {
        dataAvailability: 'unavailable',
        errorMessage: 'No AI model detected. Ensure an AI extension (Copilot, Claude Code, Cursor) is active.',
        modelId: 'none',
        modelName: 'No Model Detected',
        modelFamily: '',
        modelVendor: '',
        maxInputTokens: 0,
        maxOutputTokens: 0,
        usedTokens: 0,
        usagePercent: 0,
        zone: 'green',
        breakdownAvailable: false,
      };
    }

    const maxTokens = this.currentModel.maxInputTokens;
    if (this.tokenUsage === 0 && !this.dataSource) {
      return {
        dataAvailability: 'partial',
        errorMessage: 'Model detected but token usage data is not yet available. Waiting for agent activity...',
        dataSource: undefined,
        modelId: this.currentModel.id,
        modelName: this.currentModel.name,
        modelFamily: this.currentModel.family,
        modelVendor: this.currentModel.vendor,
        maxInputTokens: maxTokens,
        maxOutputTokens: this.currentModel.maxOutputTokens,
        usedTokens: 0,
        usagePercent: 0,
        zone: 'green',
        breakdownAvailable: false,
      };
    }

    const usagePercent = maxTokens > 0 ? Math.round((this.tokenUsage / maxTokens) * 100) : 0;
    const zone = this.classifyZone(usagePercent, thresholds);

    return {
      dataAvailability: 'available',
      dataSource: this.dataSource,
      modelId: this.currentModel.id,
      modelName: this.currentModel.name,
      modelFamily: this.currentModel.family,
      modelVendor: this.currentModel.vendor,
      maxInputTokens: maxTokens,
      maxOutputTokens: this.currentModel.maxOutputTokens,
      usedTokens: this.tokenUsage,
      usagePercent,
      zone,
      breakdownAvailable: false,
    };
  }

  getModelInfo(): DetectedModel | undefined {
    return this.currentModel;
  }

  private classifyZone(percent: number, t: ContextThresholds): ContextZone {
    if (percent >= t.critical) return 'red';
    if (percent >= t.danger) return 'orange';
    if (percent >= t.warning) return 'yellow';
    return 'green';
  }
}
