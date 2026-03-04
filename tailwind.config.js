/** @type {import('tailwindcss').Config} */
export default {
  content: ['./webview-ui/src/**/*.{tsx,ts}'],
  theme: {
    extend: {
      colors: {
        'vsc-bg': 'var(--vscode-editor-background)',
        'vsc-fg': 'var(--vscode-editor-foreground)',
        'vsc-border': 'var(--vscode-panel-border, #333)',
        'vsc-muted': 'var(--vscode-descriptionForeground, #888)',
        'vsc-hover': 'var(--vscode-list-hoverBackground, #2a2d2e)',
        'vsc-input': 'var(--vscode-input-background, #3c3c3c)',
        'vsc-badge-bg': 'var(--vscode-badge-background, #4d4d4d)',
        'vsc-badge-fg': 'var(--vscode-badge-foreground, #fff)',
        'vsc-button': 'var(--vscode-button-background, #0e639c)',
        'vsc-button-fg': 'var(--vscode-button-foreground, #fff)',
        'vsc-button-hover': 'var(--vscode-button-hoverBackground, #1177bb)',
        'vsc-sidebar-bg': 'var(--vscode-sideBar-background, #252526)',
        'vsc-sidebar-fg': 'var(--vscode-sideBar-foreground, #cccccc)',
        'zone-green': '#22c55e',
        'zone-yellow': '#eab308',
        'zone-orange': '#f97316',
        'zone-red': '#ef4444',
        'zone-blue': '#3b82f6',
      },
      fontSize: {
        'xxs': ['9px', { lineHeight: '12px' }],
        'xs': ['10px', { lineHeight: '14px' }],
        'sm': ['11px', { lineHeight: '16px' }],
        'base': ['12px', { lineHeight: '18px' }],
      },
    },
  },
  plugins: [],
};
