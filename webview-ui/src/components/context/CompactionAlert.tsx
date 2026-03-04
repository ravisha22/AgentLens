import { useState, useEffect } from 'react';
import { CompactionEvent } from '@agentlens/types';
import { formatTokens, timeAgo } from '../../shared/formatters';
import { postMessage } from '../../vscodeApi';

interface CompactionAlertProps {
  events: CompactionEvent[];
  lostFileCount: number;
}

export function CompactionAlert({ events, lostFileCount }: CompactionAlertProps) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  // Auto-dismiss after 60 seconds
  const recentEvents = events.filter(e => {
    const age = Date.now() - e.timestamp;
    return age < 60_000 && !dismissed.has(e.timestamp);
  });

  // Auto-dismiss timer
  useEffect(() => {
    if (recentEvents.length === 0) return;
    const timer = setTimeout(() => {
      setDismissed(prev => {
        const next = new Set(prev);
        recentEvents.forEach(e => next.add(e.timestamp));
        return next;
      });
    }, 60_000);
    return () => clearTimeout(timer);
  }, [recentEvents.length]);

  if (recentEvents.length === 0) return null;

  const latest = recentEvents[recentEvents.length - 1];

  return (
    <div
      className="p-2 rounded space-y-1.5"
      style={{
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        border: '1px solid rgba(249, 115, 22, 0.4)',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold zone-orange">Compaction Detected</span>
        <button
          className="text-[10px] opacity-50 hover:opacity-100 cursor-pointer"
          style={{ background: 'none', border: 'none', color: 'inherit' }}
          onClick={() => setDismissed(prev => {
            const next = new Set(prev);
            next.add(latest.timestamp);
            return next;
          })}
        >
          Dismiss
        </button>
      </div>

      <div className="text-[11px] space-y-0.5">
        <div className="opacity-70">
          Context dropped from {formatTokens(latest.tokensBefore)} to {formatTokens(latest.tokensAfter)} tokens
          ({formatTokens(latest.tokensFreed)} freed)
        </div>
        {latest.filesLost.length > 0 && (
          <div className="opacity-60">
            {latest.filesLost.length} file(s) lost: {latest.filesLost.slice(0, 3).join(', ')}
            {latest.filesLost.length > 3 && ` +${latest.filesLost.length - 3} more`}
          </div>
        )}
        <div className="text-[9px] opacity-40">{timeAgo(latest.timestamp)}</div>
      </div>

      {lostFileCount > 0 && (
        <button
          className="vsc-button text-[10px] w-full"
          onClick={() => postMessage({ type: 'reInjectLostFiles' })}
        >
          Re-inject {lostFileCount} lost file(s)
        </button>
      )}
    </div>
  );
}
