import { useState } from 'react';
import { useExtensionState } from '../../hooks/useExtensionState';
import { DocItem } from './DocItem';
import { postMessage } from '../../vscodeApi';

const STALE_DISMISS_KEY = 'agentlens.staleDismissed';

export function DocsPanel() {
  const { documentationHealth } = useExtensionState();
  const [staleDismissed, setStaleDismissed] = useState(
    () => sessionStorage.getItem(STALE_DISMISS_KEY) === '1'
  );

  const dismissStale = () => {
    sessionStorage.setItem(STALE_DISMISS_KEY, '1');
    setStaleDismissed(true);
  };

  if (documentationHealth.noDocs) {
    return (
      <div className="text-xs opacity-50 text-center py-4 space-y-2">
        <p>No documentation manifest found.</p>
        <button
          className="vsc-button"
          onClick={() => postMessage({ type: 'createDocManifest' })}
        >
          Create Manifest
        </button>
      </div>
    );
  }

  const { items, score, healthyCount, attentionCount, missingCount } = documentationHealth;

  return (
    <div className="space-y-2">
      {/* Score bar */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="opacity-60">
          {healthyCount} healthy · {attentionCount} need attention · {missingCount} missing
        </span>
        <span className="font-semibold">{score}/100</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--vscode-panel-border, rgba(128,128,128,0.2))' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${score}%`,
            backgroundColor: score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444',
          }}
        />
      </div>

      {/* allMissing hint — manifest exists but no doc files on disk yet (Issue 27) */}
      {documentationHealth.allMissing && (
        <p className="text-[10px] opacity-60 text-center">
          No documentation files found. Use "Create Missing Docs" to scaffold them.
        </p>
      )}

      {/* Stale docs 24h warning (Issue 46) */}
      {!staleDismissed && (documentationHealth.staleDocCount24h ?? 0) > 0 && (
        <div className="flex items-center justify-between gap-1 px-2 py-1 rounded text-[10px]"
          style={{ backgroundColor: 'var(--vscode-inputValidation-warningBackground, rgba(234,179,8,0.15))', border: '1px solid var(--vscode-inputValidation-warningBorder, rgba(234,179,8,0.4))' }}>
          <span className="opacity-80">
            {documentationHealth.staleDocCount24h} doc{(documentationHealth.staleDocCount24h ?? 0) > 1 ? 's' : ''} not updated in 24h
          </span>
          <button
            onClick={dismissStale}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 2px' }}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Doc items */}
      <div className="space-y-0">
        {items.map(item => (
          <DocItem key={item.docType} item={item} />
        ))}
      </div>

      {/* Actions row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Create missing docs — shown when any docs are absent */}
        {missingCount > 0 && (
          <button
            className="vsc-button text-[10px]"
            onClick={() => postMessage({ type: 'createDocFiles' })}
            title={`Create ${missingCount} missing documentation file(s)`}
          >
            Create Missing Docs ({missingCount})
          </button>
        )}
        {/* Update docs — shown when at least one doc exists */}
        {items.length > missingCount && (
          <button
            className="vsc-button text-[10px]"
            onClick={() => postMessage({ type: 'updateDocFiles' })}
            title="Regenerate all existing docs from current project files (will overwrite)"
          >
            Update Docs
          </button>
        )}
        <button
          className="text-[10px] opacity-50 hover:opacity-100 cursor-pointer ml-auto"
          style={{ background: 'none', border: 'none', color: 'inherit' }}
          onClick={() => postMessage({ type: 'openDocManifest' })}
        >
          Edit manifest
        </button>
      </div>
    </div>
  );
}
