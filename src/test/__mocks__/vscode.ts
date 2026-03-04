/**
 * Minimal vscode module mock for unit tests.
 * Only stubs what the tested modules actually import.
 */
export const workspace = {
  workspaceFolders: [{ uri: { fsPath: '/mock/workspace' }, name: 'mock', index: 0 }],
  getConfiguration: (_section?: string) => ({
    get: <T>(key: string, defaultValue?: T): T => {
      const defaults: Record<string, unknown> = {
        autoDetectCriticalFiles: true,
        criticalFiles: [],
        alwaysPresentFiles: [],
        alwaysPresentMaxPercent: 50,
        autoInjectOnLoss: true,
        pollIntervalSeconds: 5,
        alertThresholds: { warning: 60, danger: 60, critical: 80 },
        showStatusBar: true,
        visibleFileCount: 5,
      };
      return (defaults[key] ?? defaultValue) as T;
    },
  }),
  createFileSystemWatcher: () => ({
    onDidChange: () => ({ dispose: () => {} }),
    onDidCreate: () => ({ dispose: () => {} }),
    onDidDelete: () => ({ dispose: () => {} }),
    dispose: () => {},
  }),
  findFiles: async () => [],
  asRelativePath: (uri: string | { fsPath: string }) =>
    typeof uri === 'string' ? uri : uri.fsPath,
  fs: {
    stat: async () => ({ size: 1000, mtime: Date.now() }),
  },
};

export const window = {
  showInformationMessage: async (..._args: unknown[]) => undefined,
  showWarningMessage: async (..._args: unknown[]) => undefined,
  showErrorMessage: async (..._args: unknown[]) => undefined,
  showInputBox: async () => undefined,
  showTextDocument: async () => undefined,
};

export class EventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];
  event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => { this.listeners = this.listeners.filter(l => l !== listener); } };
  };
  fire(data: T) { this.listeners.forEach(l => l(data)); }
  dispose() { this.listeners = []; }
}

export const Uri = {
  file: (path: string) => ({ fsPath: path, scheme: 'file', path }),
};
