import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { DashboardState } from '@agentlens/types';
import { onMessage, postMessage } from '../vscodeApi';

const defaultState: DashboardState = {
  context: {
    dataAvailability: 'unavailable',
    modelId: '',
    modelName: '',
    modelFamily: '',
    modelVendor: '',
    maxInputTokens: 0,
    maxOutputTokens: 0,
    usedTokens: 0,
    usagePercent: 0,
    zone: 'green',
    breakdownAvailable: false,
  },
  agents: [],
  trackedFiles: [],
  documentationHealth: {
    score: 0,
    items: [],
    healthyCount: 0,
    attentionCount: 0,
    missingCount: 0,
    noDocs: false,
  },
  compactionEvents: [],
  timeline: [],
  healthScore: {
    overall: 0,
    components: {
      contextEfficiency: 0,
      criticalFilesCoverage: 0,
      documentationHealth: 0,
      sessionStability: 0,
      agentResponsiveness: 0,
    },
    color: '#888',
    label: 'Unknown',
  },
  thresholds: { warning: 60, danger: 60, critical: 80 },
  pollIntervalMs: 5000,
  lastPollAt: 0,
};

interface ExtensionStateContextValue {
  state: DashboardState;
}

const ExtensionStateContext = createContext<ExtensionStateContextValue>({
  state: defaultState,
});

export function ExtensionStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DashboardState>(defaultState);

  useEffect(() => {
    const unsubscribe = onMessage((msg) => {
      if (msg.type === 'stateUpdate') {
        setState(msg.state);
      }
    });

    // Request initial state from extension host
    postMessage({ type: 'requestRefresh' });

    return unsubscribe;
  }, []);

  return (
    <ExtensionStateContext.Provider value={{ state }}>
      {children}
    </ExtensionStateContext.Provider>
  );
}

export function useExtensionState(): DashboardState {
  return useContext(ExtensionStateContext).state;
}
