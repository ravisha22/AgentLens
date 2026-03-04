import { HealthScore } from '@agentlens/types';

interface HealthBadgeProps {
  score: HealthScore;
  size?: 'sm' | 'md';
}

export function HealthBadge({ score, size = 'md' }: HealthBadgeProps) {
  const diameter = size === 'sm' ? 32 : 48;
  const strokeWidth = size === 'sm' ? 3 : 4;
  const radius = (diameter - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score.overall / 100) * circumference;
  const center = diameter / 2;
  const fontSize = size === 'sm' ? 10 : 14;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={diameter} height={diameter} viewBox={`0 0 ${diameter} ${diameter}`}>
        <circle
          cx={center} cy={center} r={radius}
          fill="none"
          stroke="var(--vscode-panel-border, rgba(128,128,128,0.2))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center} cy={center} r={radius}
          fill="none"
          stroke={score.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span
        className="absolute font-bold"
        style={{ fontSize, color: score.color }}
      >
        {score.overall}
      </span>
    </div>
  );
}
