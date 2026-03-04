import { ContextBreakdown } from '@agentlens/types';

interface ContextBreakdownBarProps {
  breakdown: ContextBreakdown;
  maxTokens: number;
}

const SEGMENT_COLORS: Record<keyof ContextBreakdown, string> = {
  systemPrompt: '#8b5cf6',
  tools: '#3b82f6',
  mcpServers: '#06b6d4',
  conversationHistory: '#22c55e',
  fileContext: '#eab308',
  other: '#6b7280',
};

const SEGMENT_LABELS: Record<keyof ContextBreakdown, string> = {
  systemPrompt: 'System',
  tools: 'Tools',
  mcpServers: 'MCP',
  conversationHistory: 'History',
  fileContext: 'Files',
  other: 'Other',
};

export function ContextBreakdownBar({ breakdown, maxTokens }: ContextBreakdownBarProps) {
  if (maxTokens <= 0) return null;

  const segments = (Object.keys(breakdown) as (keyof ContextBreakdown)[])
    .filter(key => breakdown[key] > 0)
    .map(key => ({
      key,
      label: SEGMENT_LABELS[key],
      tokens: breakdown[key],
      percent: (breakdown[key] / maxTokens) * 100,
      color: SEGMENT_COLORS[key],
    }));

  if (segments.length === 0) return null;

  return (
    <div className="space-y-1">
      {/* Stacked bar */}
      <div className="h-2 flex rounded-full overflow-hidden" style={{ backgroundColor: 'var(--vscode-panel-border, rgba(128,128,128,0.2))' }}>
        {segments.map(seg => (
          <div
            key={seg.key}
            className="h-full transition-all duration-300"
            style={{
              width: `${Math.max(seg.percent, 0.5)}%`,
              backgroundColor: seg.color,
            }}
            title={`${seg.label}: ${seg.tokens.toLocaleString()} tokens (${seg.percent.toFixed(1)}%)`}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
        {segments.map(seg => (
          <span key={seg.key} className="flex items-center gap-1 opacity-70">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
            {seg.label} {seg.percent.toFixed(0)}%
          </span>
        ))}
      </div>
    </div>
  );
}
