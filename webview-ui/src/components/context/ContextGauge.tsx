import { ContextZone } from '@agentlens/types';
import { zoneColor } from '../../shared/formatters';

interface ContextGaugeProps {
  percent: number;
  zone: ContextZone;
  size?: number;
  strokeWidth?: number;
}

export function ContextGauge({ percent, zone, size = 80, strokeWidth = 8 }: ContextGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
  const center = size / 2;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--vscode-panel-border, rgba(128,128,128,0.2))"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={zoneColor(zone)}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold" style={{ color: zoneColor(zone) }}>
          {Math.round(percent)}%
        </span>
      </div>
    </div>
  );
}
