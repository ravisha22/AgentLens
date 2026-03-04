import { TimelineEvent, ContextThresholds } from '@agentlens/types';

interface SessionTimelineProps {
  events: TimelineEvent[];
  thresholds: ContextThresholds;
}

export function SessionTimeline({ events, thresholds }: SessionTimelineProps) {
  const usageEvents = events.filter(e => e.contextUsageAtTime !== undefined);

  if (usageEvents.length < 2) {
    return (
      <div className="text-[10px] opacity-40 text-center py-2">
        Timeline chart requires more data points.
      </div>
    );
  }

  const width = 280;
  const height = 100;
  const padding = { top: 8, right: 8, bottom: 16, left: 28 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const minTime = usageEvents[0].timestamp;
  const maxTime = usageEvents[usageEvents.length - 1].timestamp;
  const timeRange = Math.max(maxTime - minTime, 1);

  const toX = (t: number) => padding.left + ((t - minTime) / timeRange) * chartW;
  const toY = (pct: number) => padding.top + ((100 - pct) / 100) * chartH;

  // Build path
  const points = usageEvents.map(e => ({
    x: toX(e.timestamp),
    y: toY(e.contextUsageAtTime!),
    zone: e.zone,
    type: e.type,
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  // Zone bands
  const zones = [
    { yStart: 0, yEnd: thresholds.warning, color: 'rgba(34, 197, 94, 0.08)' },
    { yStart: thresholds.warning, yEnd: thresholds.danger, color: 'rgba(234, 179, 8, 0.08)' },
    { yStart: thresholds.danger, yEnd: thresholds.critical, color: 'rgba(249, 115, 22, 0.08)' },
    { yStart: thresholds.critical, yEnd: 100, color: 'rgba(239, 68, 68, 0.08)' },
  ];

  // Compaction markers
  const compactionEvents = usageEvents.filter(e => e.type === 'compaction');

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="mt-1">
      {/* Zone bands */}
      {zones.map((z, i) => (
        <rect
          key={i}
          x={padding.left}
          y={toY(z.yEnd)}
          width={chartW}
          height={toY(z.yStart) - toY(z.yEnd)}
          fill={z.color}
        />
      ))}

      {/* Threshold lines */}
      {[thresholds.warning, thresholds.danger, thresholds.critical].map((t, i) => (
        <line
          key={i}
          x1={padding.left}
          y1={toY(t)}
          x2={width - padding.right}
          y2={toY(t)}
          stroke="var(--vscode-panel-border, rgba(128,128,128,0.2))"
          strokeDasharray="2,2"
          strokeWidth={0.5}
        />
      ))}

      {/* Y-axis labels */}
      {[0, 25, 50, 75, 100].map(v => (
        <text
          key={v}
          x={padding.left - 4}
          y={toY(v) + 3}
          fontSize={7}
          fill="var(--vscode-editor-foreground)"
          opacity={0.3}
          textAnchor="end"
        >
          {v}%
        </text>
      ))}

      {/* Usage line */}
      <path
        d={pathD}
        fill="none"
        stroke="var(--vscode-focusBorder, #007acc)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={p.type === 'compaction' ? 3 : 1.5}
          fill={p.type === 'compaction' ? '#f97316' : 'var(--vscode-focusBorder, #007acc)'}
        />
      ))}

      {/* Compaction markers */}
      {compactionEvents.map((e, i) => (
        <line
          key={`c-${i}`}
          x1={toX(e.timestamp)}
          y1={padding.top}
          x2={toX(e.timestamp)}
          y2={height - padding.bottom}
          stroke="#f97316"
          strokeWidth={0.5}
          strokeDasharray="2,2"
          opacity={0.5}
        />
      ))}
    </svg>
  );
}
