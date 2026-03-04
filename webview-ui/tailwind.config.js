/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{tsx,ts,jsx,js}'],
  theme: {
    extend: {
      colors: {
        'vsc-bg': 'var(--vscode-editor-background)',
        'vsc-fg': 'var(--vscode-editor-foreground)',
        'vsc-border': 'var(--vscode-panel-border, #333)',
        'vsc-muted': 'var(--vscode-descriptionForeground, #888)',
        'vsc-hover': 'var(--vscode-list-hoverBackground, #2a2d2e)',
        'zone-green': '#22c55e',
        'zone-yellow': '#eab308',
        'zone-orange': '#f97316',
        'zone-red': '#ef4444',
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
