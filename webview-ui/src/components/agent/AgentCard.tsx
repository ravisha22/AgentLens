import { AgentSession, DetectedModel } from '@agentlens/types';
import { formatDuration, timeAgo } from '../../shared/formatters';

interface AgentCardProps {
  displayName: string;
  isInstalled: boolean;
  sessions: AgentSession[];
  availableModels: DetectedModel[];
}

const STATE_LABELS: Record<string, string> = {
  idle: 'Idle',
  thinking: 'Thinking',
  executing: 'Executing',
  'tool-calling': 'Tool Call',
  'reading-files': 'Reading',
  'writing-code': 'Writing',
  'running-terminal': 'Terminal',
  'waiting-approval': 'Awaiting',
  compacting: 'Compacting',
  completed: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const STATE_COLORS: Record<string, string> = {
  idle: '#6b7280',
  thinking: '#3b82f6',
  executing: '#22c55e',
  'tool-calling': '#8b5cf6',
  'reading-files': '#06b6d4',
  'writing-code': '#eab308',
  'running-terminal': '#f97316',
  'waiting-approval': '#ef4444',
  compacting: '#ef4444',
  completed: '#22c55e',
  failed: '#ef4444',
  cancelled: '#6b7280',
};

export function AgentCard({ displayName, isInstalled, sessions, availableModels }: AgentCardProps) {
  const activeSession = sessions.find(s => s.isActive);
  const displaySession = activeSession ?? sessions[0]; // fall back to last-known session
  const hasActivity = activeSession !== undefined;

  const dotColor = hasActivity ? '#22c55e' : isInstalled ? '#6b7280' : '#ef4444';
  const dotTitle = hasActivity ? 'Active' : isInstalled ? 'Idle' : 'Not found';

  return (
    <div className="border vsc-border rounded p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{displayName}</span>
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: dotColor }}
          title={dotTitle}
        />
      </div>

      {displaySession && (
        <div className="space-y-1 text-[11px]">
          {/* State badge — always shown; idle when no active session */}
          <div className="flex items-center gap-2">
            {hasActivity ? (
              <>
                <span
                  className="vsc-badge"
                  style={{
                    backgroundColor: (STATE_COLORS[activeSession!.state] || '#6b7280') + '22',
                    color: STATE_COLORS[activeSession!.state] || '#6b7280',
                  }}
                >
                  {STATE_LABELS[activeSession!.state] || activeSession!.state}
                </span>
                <span className="opacity-50">
                  {formatDuration(Date.now() - activeSession!.startedAt)}
                </span>
              </>
            ) : (
              <span
                className="vsc-badge"
                style={{ backgroundColor: '#6b728022', color: '#6b7280' }}
              >
                Idle
              </span>
            )}
          </div>

          {/* Session stats — always shown from last-known session */}
          <div className={`flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] ${hasActivity ? 'opacity-60' : 'opacity-40'}`}>
            <span>Turns: {displaySession.turnCount}</span>
            <span>Tools: {displaySession.toolCallCount}</span>
            <span>Files: {displaySession.filesTouchedCount}</span>
            {displaySession.compactionCount > 0 && (
              <span className="zone-orange">Compactions: {displaySession.compactionCount}</span>
            )}
          </div>

          {/* Model + mode — persists through idle */}
          {displaySession.model && (
            <div className={`text-[10px] ${hasActivity ? 'opacity-50' : 'opacity-35'}`}>
              Model: {displaySession.model.name}
              {displaySession.mode && (
                <span className="ml-1">· {displaySession.mode}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Available models — only when no session data exists at all */}
      {!displaySession && availableModels.length > 0 && (
        <div className="text-[10px] opacity-50">
          {availableModels.length} model{availableModels.length !== 1 ? 's' : ''} available
        </div>
      )}
    </div>
  );
}
