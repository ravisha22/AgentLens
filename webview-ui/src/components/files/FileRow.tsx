import { TrackedFile } from '@agentlens/types';
import { shortPath, formatTokens } from '../../shared/formatters';
import { postMessage } from '../../vscodeApi';

interface FileRowProps {
  file: TrackedFile;
}

const VISIBILITY_COLORS: Record<string, string> = {
  'in-context': '#22c55e',
  'modified': '#3b82f6',
  'always-present': '#8b5cf6',
  'watched': '#6b7280',
  'lost': '#ef4444',
};

const VISIBILITY_LABELS: Record<string, string> = {
  'in-context': 'In context',
  'modified': 'Modified',
  'always-present': 'Pinned',
  'watched': 'Watched',
  'lost': 'Lost',
};

export function FileRow({ file }: FileRowProps) {
  const isLost = file.visibility === 'lost';

  return (
    <div className={`flex items-center gap-1.5 py-0.5 group text-[11px] ${isLost ? 'opacity-60' : ''}`}>
      {/* Visibility indicator */}
      <span
        className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: VISIBILITY_COLORS[file.visibility] || '#6b7280' }}
        title={VISIBILITY_LABELS[file.visibility] || file.visibility}
      />

      {/* Critical marker */}
      {file.isCritical && (
        <span className="text-[9px] zone-orange flex-shrink-0" title="Critical file">!</span>
      )}

      {/* File name */}
      <button
        className="truncate flex-1 text-left cursor-pointer hover:underline"
        style={{ background: 'none', border: 'none', color: 'inherit', padding: 0, font: 'inherit' }}
        onClick={() => postMessage({ type: 'openFile', filePath: file.relativePath })}
        title={file.relativePath}
      >
        {shortPath(file.relativePath)}
      </button>

      {/* Token cost */}
      <span className="text-[9px] opacity-40 flex-shrink-0">
        {file.tokenCost > 0 ? formatTokens(file.tokenCost) : '—'}
      </span>

      {/* Actions (always visible at low opacity, brighten on hover) */}
      <div className="flex gap-0.5 flex-shrink-0">
        {isLost && (
          <button
            className="vsc-button text-[9px] py-0 px-1"
            onClick={() => postMessage({ type: 'injectFile', filePath: file.relativePath })}
            title="Re-inject into context"
          >
            +
          </button>
        )}
        <button
          className="text-[9px] opacity-25 hover:opacity-90 cursor-pointer"
          style={{ background: 'none', border: 'none', color: 'inherit' }}
          onClick={() => postMessage({ type: 'toggleAlwaysPresent', filePath: file.relativePath })}
          title={file.isAlwaysPresent ? 'Unpin from context' : 'Pin to always-present'}
        >
          {file.isAlwaysPresent ? '\u2764' : '\u2661'}
        </button>
        <button
          className="text-[9px] opacity-25 hover:opacity-90 cursor-pointer"
          style={{ background: 'none', border: 'none', color: 'inherit' }}
          onClick={() => postMessage({ type: 'toggleCritical', filePath: file.relativePath })}
          title={file.isCritical ? 'Unmark critical' : 'Mark as critical'}
        >
          {file.isCritical ? '\u2605' : '\u2606'}
        </button>
      </div>
    </div>
  );
}
