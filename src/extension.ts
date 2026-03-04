/**
 * AgentLens Extension Entry Point v3
 * Wires AdapterRegistry (Copilot, Claude Code, Cursor, Cline) into
 * StateManager with single poll loop. No simulated data.
 */

import * as vscode from 'vscode';
import { AdapterRegistry } from './adapters/adapterRegistry';
import { CopilotAdapter } from './adapters/copilotAdapter';
import { ClaudeCodeAdapter } from './adapters/claudeCodeAdapter';
import { CursorAdapter } from './adapters/cursorAdapter';
import { ClineAdapter } from './adapters/clineAdapter';
import { StateManager } from './core/stateManager';
import { DashboardViewProvider } from './providers/dashboardViewProvider';
import { StatusBarController } from './providers/statusBarController';

let stateManager: StateManager | undefined;
let statusBarController: StatusBarController | undefined;
let registry: AdapterRegistry | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('AgentLens v3: Activating...');

  // Build adapter registry with all agent adapters
  // Claude Code registered first — its model data (from JSONL) is more specific
  // than generic VS Code LM API names, so it should win Priority 3 fallback
  registry = new AdapterRegistry();
  registry.register(new ClaudeCodeAdapter());
  registry.register(new CopilotAdapter());
  registry.register(new CursorAdapter());
  registry.register(new ClineAdapter());

  // StateManager owns the single poll loop
  stateManager = new StateManager(registry);

  // Status bar
  const showStatusBar = vscode.workspace
    .getConfiguration('agentlens')
    .get<boolean>('showStatusBar', true);

  if (showStatusBar) {
    statusBarController = new StatusBarController();
    context.subscriptions.push({ dispose: () => statusBarController?.dispose() });
  }

  // Sidebar dashboard (thin React loader)
  const dashboardProvider = new DashboardViewProvider(context.extensionUri, stateManager);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(DashboardViewProvider.viewType, dashboardProvider)
  );

  // Forward state to status bar
  if (statusBarController) {
    const sb = statusBarController;
    context.subscriptions.push(stateManager.onStateChanged(state => sb.update(state)));
  }

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('agentlens.refreshContext', () => {
      if (stateManager && statusBarController) {
        statusBarController.update(stateManager.getState());
      }
    }),

    vscode.commands.registerCommand('agentlens.toggleDashboard', () => {
      vscode.commands.executeCommand('agentlens.dashboard.focus');
    }),

    vscode.commands.registerCommand('agentlens.configureCriticalFiles', async () => {
      const input = await vscode.window.showInputBox({
        prompt: 'Glob patterns for critical files (comma-separated)',
        placeHolder: '**/ARCHITECTURE.md, **/schema.prisma',
        value: vscode.workspace.getConfiguration('agentlens')
          .get<string[]>('criticalFiles', []).join(', '),
      });
      if (input !== undefined) {
        const patterns = input.split(',').map(p => p.trim()).filter(Boolean);
        await vscode.workspace.getConfiguration('agentlens')
          .update('criticalFiles', patterns, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`AgentLens: Updated critical files (${patterns.length} patterns)`);
      }
    }),

    vscode.commands.registerCommand('agentlens.configureAlwaysPresent', async () => {
      const input = await vscode.window.showInputBox({
        prompt: 'Glob patterns for always-present files (comma-separated). These auto-inject on context loss.',
        placeHolder: '**/CLAUDE.md, **/ARCHITECTURE.md',
        value: vscode.workspace.getConfiguration('agentlens')
          .get<string[]>('alwaysPresentFiles', []).join(', '),
      });
      if (input !== undefined) {
        const patterns = input.split(',').map(p => p.trim()).filter(Boolean);
        await vscode.workspace.getConfiguration('agentlens')
          .update('alwaysPresentFiles', patterns, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`AgentLens: Updated always-present files (${patterns.length} patterns)`);
      }
    }),

    vscode.commands.registerCommand('agentlens.createDocManifest', () => {
      stateManager?.createDocManifest();
    })
  );

  // Watch config changes — reload poll interval if changed
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('agentlens')) {
        vscode.window.showInformationMessage('AgentLens: Configuration updated.');
      }
    })
  );

  // Initialize (async — scans workspace, detects agents, starts poll)
  await stateManager.initialize();
  console.log('AgentLens v3: Activated');
}

export function deactivate(): void {
  stateManager?.dispose();
  statusBarController?.dispose();
}
