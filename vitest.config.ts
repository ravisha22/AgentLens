import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    include: [
      'src/test/**/*.test.ts',
      'webview-ui/src/test/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@agentlens/types': path.resolve(__dirname, 'src/types'),
      vscode: path.resolve(__dirname, 'src/test/__mocks__/vscode.ts'),
    },
  },
});
