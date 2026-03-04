/**
 * Dashboard View Provider v3 — Thin React App Loader
 * Loads the Vite-built React app from dist/webview/.
 * Forwards messages between webview and StateManager.
 */

import * as vscode from 'vscode';
import { StateManager } from '../core/stateManager';
import { WebviewMessage } from '../types';

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'agentlens.dashboard';

  private view?: vscode.WebviewView;
  private stateSubscription?: vscode.Disposable;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly stateManager: StateManager,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
      ],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg: WebviewMessage) => {
      switch (msg.type) {
        case 'requestRefresh':
          this.sendState();
          break;
        case 'injectFile':
          this.stateManager.injectFile(msg.filePath);
          break;
        case 'toggleAlwaysPresent':
          this.stateManager.toggleAlwaysPresent(msg.filePath);
          break;
        case 'toggleCritical':
          this.stateManager.toggleCritical(msg.filePath);
          break;
        case 'openFile': {
          const folders = vscode.workspace.workspaceFolders;
          if (folders) {
            const uri = vscode.Uri.joinPath(folders[0].uri, msg.filePath);
            vscode.workspace.openTextDocument(uri).then(
              doc => vscode.window.showTextDocument(doc)
            );
          }
          break;
        }
        case 'createDocManifest':
          this.stateManager.createDocManifest();
          break;
        case 'openDocManifest': {
          const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          if (root) {
            const manifestUri = vscode.Uri.file(`${root}/.agentlens/doc-requirements.json`);
            vscode.workspace.openTextDocument(manifestUri).then(
              doc => vscode.window.showTextDocument(doc),
              async () => {
                // File doesn't exist — auto-create from default template then open
                await this.stateManager.createDocManifest();
              }
            );
          }
          break;
        }
        case 'reInjectLostFiles':
          this.stateManager.reInjectLostFiles();
          break;
        case 'createDocFiles':
          this.stateManager.createMissingDocs();
          break;
        case 'updateDocFiles':
          this.stateManager.updateDocs();
          break;
        case 'updateDocFile':
          this.stateManager.updateDocs([msg.docType]);
          break;
      }
    });

    this.stateSubscription = this.stateManager.onStateChanged(state => {
      webviewView.webview.postMessage({ type: 'stateUpdate', state });
    });

    this.sendState();

    webviewView.onDidDispose(() => {
      this.stateSubscription?.dispose();
    });
  }

  private sendState(): void {
    if (this.view) {
      const state = this.stateManager.getState();
      this.view.webview.postMessage({ type: 'stateUpdate', state });
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'main.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'main.css')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>AgentLens</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
