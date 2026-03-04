import { TimelineEvent as TimelineEventType } from '@agentlens/types';
import { timeAgo, zoneColor } from '../../shared/formatters';

interface TimelineEventProps {
  event: TimelineEventType;
}

const EVENT_ICONS: Record<string, string> = {
  'session-start': '\u25B6',
  'model-change': '\u21C4',
  'file-loaded': '\u2191',
  'file-lost': '\u2193',
  'compaction': '\u26A0',
  'threshold-crossed': '\u26A1',
  'tool-call': '\u2699',
  'agent-state-change': '\u21BB',
  'doc-change': '\u270E',
  'error': '\u2717',
};

const EVENT_COLORS: Record<string, string> = {
  'session-start': '#22c55e',
  'model-change': '#3b82f6',
  'file-loaded': '#22c55e',
  'file-lost': '#ef4444',
  'compaction': '#f97316',
  'threshold-crossed': '#eab308',
  'tool-call': '#8b5cf6',
  'agent-state-change': '#6b7280',
  'doc-change': '#06b6d4',
  'error': '#ef4444',
};

export function TimelineEventRow({ event }: TimelineEventProps) {
  return (
    <div className="flex items-start gap-2 py-1 text-[11px]">
      {/* Timeline dot */}
      <div className="flex flex-col items-center flex-shrink-0 mt-0.5">
        <span
          className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px]"
          style={{
            backgroundColor: (EVENT_COLORS[event.type] || '#6b7280') + '22',
            color: EVENT_COLORS[event.type] || '#6b7280',
          }}
        >
          {EVENT_ICONS[event.type] || '\u25CF'}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate">{event.label}</span>
          {event.zone && (
            <span
              className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: zoneColor(event.zone) }}
            />
          )}
        </div>
        {event.detail && (
          <div className="text-[9px] opacity-40 truncate">{event.detail}</div>
        )}
      </div>

      {/* Timestamp + usage */}
      <div className="flex-shrink-0 text-[9px] opacity-40 text-right">
        <div>{timeAgo(event.timestamp)}</div>
        {event.contextUsageAtTime !== undefined && (
          <div>{event.contextUsageAtTime}%</div>
        )}
      </div>
    </div>
  );
}
