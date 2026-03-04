import { useState } from 'react';
import { useExtensionState } from '../../hooks/useExtensionState';
import { FileRow } from './FileRow';
import { CriticalFileWatchlist } from './CriticalFileWatchlist';
import { postMessage } from '../../vscodeApi';

export function FilePanel() {
  const { trackedFiles, context } = useExtensionState();
  const [expanded, setExpanded] = useState(false);

  if (trackedFiles.length === 0) {
    return (
      <div className="text-xs opacity-50 text-center py-4">
        No files tracked yet. Files appear as they're used in agent sessions.
      </div>
    );
  }

  const visibleCount = 5;
  const displayFiles = expanded ? trackedFiles : trackedFiles.slice(0, visibleCount);
  const hasMore = trackedFiles.length > visibleCount;

  const lostFiles = trackedFiles.filter(f => f.visibility === 'lost' && f.isAlwaysPresent);
  const criticalFiles = trackedFiles.filter(f => f.isCritical);
  const criticalInContext = criticalFiles.filter(f => f.visibility === 'in-context' || f.visibility === 'always-present');

  return (
    <div className="space-y-2">
      {/* Critical file watchlist (Phase 2) */}
      {criticalFiles.length > 0 && (
        <CriticalFileWatchlist files={trackedFiles} maxTokens={context.maxInputTokens} />
      )}

      {/* Summary bar */}
      <div className="flex items-center justify-between text-[10px] opacity-60">
        <span>{trackedFiles.length} files tracked</span>
        {criticalFiles.length > 0 && (
          <span>
            {criticalInContext.length}/{criticalFiles.length} critical in context
          </span>
        )}
      </div>

      {/* Lost files warning */}
      {lostFiles.length > 0 && (
        <div className="flex items-center justify-between p-1.5 rounded text-[11px]"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <span className="zone-red">{lostFiles.length} pinned file(s) lost from context</span>
          <button
            className="vsc-button text-[10px] py-0 px-2"
            onClick={() => postMessage({ type: 'reInjectLostFiles' })}
          >
            Re-inject
          </button>
        </div>
      )}

      {/* File list */}
      <div className="space-y-0">
        {displayFiles.map(file => (
          <FileRow key={file.relativePath} file={file} />
        ))}
      </div>

      {/* Show more/less */}
      {hasMore && (
        <button
          className="text-[10px] opacity-50 hover:opacity-100 cursor-pointer w-full text-center"
          style={{ background: 'none', border: 'none', color: 'inherit' }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show less' : `Show ${trackedFiles.length - visibleCount} more...`}
        </button>
      )}
    </div>
  );
}
