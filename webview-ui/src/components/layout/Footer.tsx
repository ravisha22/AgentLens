import { useExtensionState } from '../../hooks/useExtensionState';
import { timeAgo } from '../../shared/formatters';

export function Footer() {
  const state = useExtensionState();

  return (
    <div className="px-3 py-1.5 border-t vsc-border flex items-center justify-between text-[10px] opacity-50">
      <span>Poll: {state.pollIntervalMs / 1000}s</span>
      <span>
        {state.context.dataSource || 'No data source'}
        {state.lastPollAt ? ` · ${timeAgo(state.lastPollAt)}` : ''}
      </span>
    </div>
  );
}
