import { useExtensionState } from '../../hooks/useExtensionState';
import { TimelineEventRow } from './TimelineEvent';
import { SessionTimeline } from './SessionTimeline';

export function TimelinePanel() {
  const { timeline, thresholds } = useExtensionState();

  if (timeline.length === 0) {
    return (
      <div className="text-xs opacity-50 text-center py-4">
        No events yet. Activity will appear here as agents interact with your workspace.
      </div>
    );
  }

  // Show most recent first
  const reversed = [...timeline].reverse();

  return (
    <div className="space-y-2">
      {/* Visual session timeline chart (Phase 2) */}
      <SessionTimeline events={timeline} thresholds={thresholds} />

      {/* Event list */}
      <div className="space-y-0">
        {reversed.map((event, i) => (
          <TimelineEventRow key={`${event.timestamp}-${i}`} event={event} />
        ))}
      </div>
    </div>
  );
}
