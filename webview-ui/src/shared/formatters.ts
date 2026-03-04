import { ContextZone } from '@agentlens/types';

/** Format large numbers: 125000 -> "125K" */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(0)}K`;
  }
  return `${n}`;
}

/** Format percentage with no decimal for whole numbers */
export function formatPercent(n: number): string {
  return n % 1 === 0 ? `${n}%` : `${n.toFixed(1)}%`;
}

/** Time ago: "2m ago", "1h ago" */
export function timeAgo(timestamp: number): string {
  if (!timestamp) return 'never';
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Duration: "5m 20s" */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/** Zone color CSS variable */
export function zoneColor(zone: ContextZone): string {
  return `var(--zone-${zone})`;
}

/** Zone CSS class */
export function zoneClass(zone: ContextZone): string {
  return `zone-${zone}`;
}

/** Zone background CSS class */
export function zoneBgClass(zone: ContextZone): string {
  return `zone-bg-${zone}`;
}

/** Truncate file path for display: "src/core/stateManager.ts" -> "stateManager.ts" */
export function shortPath(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || path;
}

/** Agent type display names */
export function agentDisplayName(type: string): string {
  const names: Record<string, string> = {
    copilot: 'GitHub Copilot',
    'claude-code': 'Claude Code',
    cursor: 'Cursor',
    cline: 'Cline',
    codex: 'Codex CLI',
    unknown: 'Unknown Agent',
  };
  return names[type] || type;
}
