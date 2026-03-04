/**
 * Agent Adapter Interface
 * Each adapter detects one AI agent type (Copilot, Claude Code, Cursor, etc.)
 * and provides model/session/token data from that agent.
 */

import { AgentType, DetectedAgent, DetectedModel, AgentSession } from '../types';

export interface IAgentAdapter {
  /** Unique identifier for this adapter */
  readonly agentType: AgentType;

  /** Human-readable name */
  readonly displayName: string;

  /** Detect this agent's presence, sessions, and models. Called each poll cycle. */
  detect(): Promise<void>;

  /** Whether this agent is currently detected (installed/running) */
  isDetected(): boolean;

  /** Get the full agent descriptor */
  getAgent(): DetectedAgent | null;

  /** Get all models this adapter knows about */
  getAllModels(): DetectedModel[];

  /** Get the active session, if any */
  getActiveSession(): AgentSession | null;

  /**
   * Get current token usage from this agent's session.
   * Returns 0 if not available.
   */
  getTokenUsage(): number;

  /** Clean up resources */
  dispose(): void;
}
