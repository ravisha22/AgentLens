import { useExtensionState } from '../../hooks/useExtensionState';
import { HealthBadge } from './HealthBadge';

const COMPONENT_LABELS: Record<string, string> = {
  contextEfficiency: 'Context Efficiency',
  criticalFilesCoverage: 'Critical Files',
  documentationHealth: 'Documentation',
  sessionStability: 'Session Stability',
  agentResponsiveness: 'Agent Response',
};

export function HealthPanel() {
  const { healthScore } = useExtensionState();

  return (
    <div className="space-y-3">
      {/* Overall score */}
      <div className="flex items-center gap-3">
        <HealthBadge score={healthScore} />
        <div>
          <div className="text-sm font-semibold" style={{ color: healthScore.color }}>
            {healthScore.label}
          </div>
          <div className="text-[10px] opacity-50">
            Overall health score
          </div>
        </div>
      </div>

      {/* Component breakdown */}
      <div className="space-y-1.5">
        {(Object.entries(healthScore.components) as [string, number][]).map(([key, value]) => (
          <div key={key} className="space-y-0.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="opacity-70">{COMPONENT_LABELS[key] || key}</span>
              <span className="opacity-50">{value}/100</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--vscode-panel-border, rgba(128,128,128,0.2))' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${value}%`,
                  backgroundColor: value >= 70 ? '#22c55e' : value >= 40 ? '#eab308' : '#ef4444',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
