import { TrackedFile } from '@agentlens/types';
import { shortPath, formatTokens } from '../../shared/formatters';
import { postMessage } from '../../vscodeApi';

interface CriticalFileWatchlistProps {
  files: TrackedFile[];
  maxTokens: number;
}

export function CriticalFileWatchlist({ files, maxTokens }: CriticalFileWatchlistProps) {
  const criticalFiles = files.filter(f => f.isCritical);

  if (criticalFiles.length === 0) return null;

  const inContext = criticalFiles.filter(
    f => f.visibility === 'in-context' || f.visibility === 'always-present'
  );
  const lost = criticalFiles.filter(f => f.visibility === 'lost');
  const coverage = criticalFiles.length > 0
    ? Math.round((inContext.length / criticalFiles.length) * 100)
    : 0;

  const totalTokenCost = criticalFiles.reduce((sum, f) => sum + f.tokenCost, 0);
  const budgetPercent = maxTokens > 0 ? (totalTokenCost / maxTokens) * 100 : 0;

  return (
    <div className="space-y-2">
      {/* Coverage bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="opacity-70">
            {inContext.length}/{criticalFiles.length} critical files in context
          </span>
          <span className="opacity-50">{coverage}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--vscode-panel-border, rgba(128,128,128,0.2))' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${coverage}%`,
              backgroundColor: coverage === 100 ? '#22c55e' : coverage >= 60 ? '#eab308' : '#ef4444',
            }}
          />
        </div>
      </div>

      {/* File list */}
      <div className="space-y-0.5">
        {criticalFiles.map(file => {
          const isLost = file.visibility === 'lost';
          return (
            <div
              key={file.relativePath}
              className={`flex items-center gap-1.5 text-[11px] py-0.5 ${isLost ? 'opacity-60' : ''}`}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: isLost ? '#ef4444' : '#22c55e' }}
              />
              <span className="truncate flex-1">{shortPath(file.relativePath)}</span>
              {file.tokenCost > 0 && (
                <span className="text-[9px] opacity-40 flex-shrink-0">{formatTokens(file.tokenCost)}</span>
              )}
              {isLost && (
                <button
                  className="vsc-button text-[9px] py-0 px-1 flex-shrink-0"
                  onClick={() => postMessage({ type: 'injectFile', filePath: file.relativePath })}
                >
                  +
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Token budget */}
      {totalTokenCost > 0 && maxTokens > 0 && (
        <div className="text-[9px] opacity-40">
          Critical files: {formatTokens(totalTokenCost)} tokens ({budgetPercent.toFixed(1)}% of context)
        </div>
      )}
    </div>
  );
}
