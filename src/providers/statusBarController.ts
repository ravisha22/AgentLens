/**
 * Status Bar Controller v2
 * Shows compact summary: context %, model, health score
 */

import * as vscode from 'vscode';
import { DashboardState } from '../types';

export class StatusBarController {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = 'agentlens.toggleDashboard';
    this.item.tooltip = 'AgentLens — Click to open dashboard';
    this.item.text = '$(eye) AgentLens';
    this.item.show();
  }

  update(state: DashboardState): void {
    const c = state.context;
    const h = state.healthScore;

    if (c.dataAvailability === 'unavailable') {
      this.item.text = `$(eye) AgentLens: No model`;
      this.item.backgroundColor = undefined;
      return;
    }

    const icon = c.zone === 'red' ? '$(warning)' : c.zone === 'orange' ? '$(alert)' : '$(eye)';

    if (c.dataAvailability === 'available') {
      this.item.text = `${icon} ${c.usagePercent}% | ${c.modelFamily} | H:${h.overall}`;
    } else {
      this.item.text = `${icon} ${c.modelFamily} | H:${h.overall}`;
    }

    if (c.zone === 'red') {
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (c.zone === 'orange') {
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this.item.backgroundColor = undefined;
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
