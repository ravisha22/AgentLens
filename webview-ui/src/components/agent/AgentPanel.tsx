import { useExtensionState } from '../../hooks/useExtensionState';
import { AgentCard } from './AgentCard';

export function AgentPanel() {
  const { agents } = useExtensionState();

  if (agents.length === 0) {
    return (
      <div className="text-xs opacity-50 text-center py-4">
        No AI agents detected. Install GitHub Copilot, Claude Code, Cursor, or Cline to get started.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {agents.map(agent => (
        <AgentCard
          key={agent.type}
          displayName={agent.displayName}
          isInstalled={agent.isInstalled}
          sessions={agent.sessions}
          availableModels={agent.availableModels}
        />
      ))}
    </div>
  );
}
