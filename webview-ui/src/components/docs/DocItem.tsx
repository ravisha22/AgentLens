import { useState } from 'react';
import { DocumentationItem } from '@agentlens/types';
import { timeAgo } from '../../shared/formatters';
import { postMessage } from '../../vscodeApi';

interface DocItemProps {
  item: DocumentationItem;
}

const HEALTH_COLORS: Record<string, string> = {
  healthy: '#22c55e',
  stale: '#eab308',
  missing: '#ef4444',
  outdated: '#f97316',
  incomplete: '#f97316',
};

const HEALTH_ICONS: Record<string, string> = {
  healthy: '\u2713',
  stale: '\u25CB',
  missing: '\u2717',
  outdated: '\u25CB',
  incomplete: '\u25CB',
};

export function DocItem({ item }: DocItemProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex items-center gap-2 py-1 text-[11px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Health icon */}
      <span
        className="flex-shrink-0 text-xs font-bold"
        style={{ color: HEALTH_COLORS[item.health] || '#6b7280' }}
      >
        {HEALTH_ICONS[item.health] || '?'}
      </span>

      {/* Doc name and info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate">{item.displayName}</span>
          {item.required && (
            <span className="text-[9px] opacity-40">required</span>
          )}
        </div>
        {item.filePath && (
          <div className="text-[9px] opacity-40 truncate">{item.filePath}</div>
        )}
      </div>

      {/* Status info */}
      <div className="flex-shrink-0 text-[9px] opacity-50 text-right">
        {item.health === 'missing' ? (
          <span style={{ color: HEALTH_COLORS.missing }}>Missing</span>
        ) : item.health === 'stale' && item.daysSinceUpdate !== undefined ? (
          <span style={{ color: HEALTH_COLORS.stale }}>{item.daysSinceUpdate}d stale</span>
        ) : item.lastModified ? (
          <span>{timeAgo(item.lastModified)}</span>
        ) : null}
      </div>

      {/* Per-item refresh — revealed on hover, only for existing (non-missing) docs */}
      {item.health !== 'missing' && (
        <button
          className="flex-shrink-0 text-[10px] cursor-pointer transition-opacity"
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            opacity: hovered ? 0.8 : 0,
            padding: '0 2px',
          }}
          title={`Regenerate "${item.displayName}" from current project files (will overwrite)`}
          onClick={() => postMessage({ type: 'updateDocFile', docType: item.docType })}
        >
          ↻
        </button>
      )}

      {/* Context indicator */}
      {item.inContext && (
        <span
          className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: '#22c55e' }}
          title="In context"
        />
      )}
    </div>
  );
}
