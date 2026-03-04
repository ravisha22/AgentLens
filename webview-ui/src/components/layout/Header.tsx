import { useExtensionState } from '../../hooks/useExtensionState';
import { formatPercent, zoneColor } from '../../shared/formatters';

export function Header() {
  const state = useExtensionState();
  const { context, healthScore, agents, trackedFiles } = state;

  const activeAgent = agents.find(a => a.sessions.some(s => s.isActive));
  const criticalFiles = trackedFiles.filter(f => f.isCritical);
  const criticalInContext = criticalFiles.filter(f => f.visibility === 'in-context' || f.visibility === 'always-present');

  return (
    <div className="px-3 py-2 border-b vsc-border flex items-center justify-between gap-2">
      <div className="flex items-center gap-3 min-w-0">
        {/* Context gauge mini */}
        <div className="flex items-center gap-1.5">
          <svg width="20" height="20" viewBox="0 0 20 20">
            <circle
              cx="10" cy="10" r="8"
              fill="none"
              stroke="var(--vscode-panel-border, rgba(128,128,128,0.35))"
              strokeWidth="3"
            />
            <circle
              cx="10" cy="10" r="8"
              fill="none"
              stroke={zoneColor(context.zone)}
              strokeWidth="3"
              strokeDasharray={`${(context.usagePercent / 100) * 50.27} 50.27`}
              strokeLinecap="round"
              transform="rotate(-90 10 10)"
            />
          </svg>
          <span className="text-xs font-semibold" style={{ color: zoneColor(context.zone) }}>
            {context.dataAvailability === 'available'
              ? formatPercent(context.usagePercent)
              : context.dataAvailability === 'partial' ? '~' : '--'}
          </span>
        </div>

        {/* Critical files indicator */}
        {criticalFiles.length > 0 && (
          <span className="text-xs opacity-70">
            {criticalInContext.length}/{criticalFiles.length} critical
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs">
        {/* Active agent name */}
        {activeAgent && (
          <span className="opacity-70 truncate max-w-[100px]">{activeAgent.displayName}</span>
        )}

        {/* Health badge */}
        <span
          className="vsc-badge"
          style={{
            backgroundColor: healthScore.color + '22',
            color: healthScore.color,
          }}
        >
          {healthScore.overall}
        </span>
      </div>
    </div>
  );
}
