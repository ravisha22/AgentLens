import { useExtensionState } from '../../hooks/useExtensionState';
import { ContextGauge } from './ContextGauge';
import { ContextBreakdownBar } from './ContextBreakdownBar';
import { CompactionAlert } from './CompactionAlert';
import { formatTokens } from '../../shared/formatters';

export function ContextPanel() {
  const { context, compactionEvents, trackedFiles, agents } = useExtensionState();
  const lostAlwaysPresent = trackedFiles.filter(f => f.visibility === 'lost' && f.isAlwaysPresent);

  // Find the active session's mode for display; fall back to last-known session when idle
  const allSessions = agents.flatMap(a => a.sessions);
  const activeSession = allSessions.find(s => s.isActive);
  const displaySession = activeSession ?? allSessions[0];
  const sessionMode = displaySession?.mode;

  if (context.dataAvailability === 'unavailable') {
    return (
      <div className="text-xs opacity-50 text-center py-4">
        No model detected. Start an AI agent session to see context data.
      </div>
    );
  }

  const isPartial = context.dataAvailability === 'partial';

  return (
    <div className="space-y-3">
      {/* Main gauge + model info */}
      <div className="flex items-center gap-4">
        <ContextGauge
          percent={context.usagePercent}
          zone={context.zone}
          size={80}
        />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="text-sm font-semibold truncate">
            {context.modelName || context.modelId}
          </div>
          <div className="text-xs opacity-60">
            {context.modelFamily}
            {context.modelFamily && context.modelVendor ? ' · ' : ''}
            {context.modelVendor}
            {sessionMode && (
              <span className="ml-1.5 opacity-80"> · {sessionMode}</span>
            )}
          </div>
          <div className="text-xs opacity-70">
            {isPartial ? (
              <span className="italic">Waiting for token data...</span>
            ) : (
              <>
                {formatTokens(context.usedTokens)} / {formatTokens(context.maxInputTokens)} tokens
              </>
            )}
          </div>
          {context.maxOutputTokens > 0 && (
            <div className="text-[10px] opacity-50">
              Output limit: {formatTokens(context.maxOutputTokens)}
            </div>
          )}
        </div>
      </div>

      {/* Zone indicator */}
      <div className="flex items-center gap-2 text-xs">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: `var(--zone-${context.zone})` }}
        />
        <span className="capitalize">{context.zone} zone</span>
        {context.dataSource && (
          <span className="text-[10px] opacity-40 ml-auto">via {context.dataSource}</span>
        )}
      </div>

      {/* Breakdown bar */}
      {context.breakdownAvailable && context.breakdown && (
        <ContextBreakdownBar
          breakdown={context.breakdown}
          maxTokens={context.maxInputTokens}
        />
      )}

      {/* Compaction alert (Phase 2) */}
      <CompactionAlert events={compactionEvents} lostFileCount={lostAlwaysPresent.length} />
    </div>
  );
}
