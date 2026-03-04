/**
 * Health Scorer v2
 * Same weighted composite scoring, but now only uses real data inputs.
 */

import {
  HealthScore, ContextState, TrackedFile,
  DocumentationHealth, CompactionEvent, AgentSession,
} from '../types';

export class HealthScorer {
  calculate(
    context: ContextState,
    files: TrackedFile[],
    docHealth: DocumentationHealth,
    compactionEvents: CompactionEvent[],
    activeSession: AgentSession | undefined
  ): HealthScore {
    const contextEfficiency = this.scoreContextEfficiency(context);
    const criticalFilesCoverage = this.scoreCriticalFilesCoverage(files);
    const documentationHealth = docHealth.score;
    const sessionStability = this.scoreSessionStability(compactionEvents, activeSession);
    const agentResponsiveness = this.scoreAgentResponsiveness(activeSession);

    const overall = Math.round(
      contextEfficiency * 0.30 +
      criticalFilesCoverage * 0.25 +
      documentationHealth * 0.15 +
      sessionStability * 0.20 +
      agentResponsiveness * 0.10
    );

    return {
      overall,
      components: { contextEfficiency, criticalFilesCoverage, documentationHealth, sessionStability, agentResponsiveness },
      color: this.getColor(overall),
      label: this.getLabel(overall),
    };
  }

  private scoreContextEfficiency(context: ContextState): number {
    if (context.dataAvailability === 'unavailable') return 50; // neutral when no data
    const pct = context.usagePercent;
    if (pct <= 10) return 60;
    if (pct <= 60) return 100;
    if (pct <= 70) return 90;
    if (pct <= 80) return 70;
    if (pct <= 90) return 45;
    if (pct <= 95) return 25;
    return 10;
  }

  private scoreCriticalFilesCoverage(files: TrackedFile[]): number {
    const critical = files.filter(f => f.isCritical);
    if (critical.length === 0) return 100;
    const inContext = critical.filter(f =>
      f.visibility === 'in-context' || f.visibility === 'always-present'
    ).length;
    return Math.round((inContext / critical.length) * 100);
  }

  private scoreSessionStability(events: CompactionEvent[], session: AgentSession | undefined): number {
    if (!session) return 100;
    const c = session.compactionCount;
    if (c === 0) return 100;
    if (c === 1) return 75;
    if (c === 2) return 50;
    if (c === 3) return 30;
    return 15;
  }

  private scoreAgentResponsiveness(session: AgentSession | undefined): number {
    if (!session) return 50;
    switch (session.state) {
      case 'idle': case 'completed': return 100;
      case 'thinking': case 'executing': case 'tool-calling':
      case 'reading-files': case 'writing-code': case 'running-terminal': return 90;
      case 'waiting-approval': return 70;
      case 'compacting': return 40;
      case 'failed': return 10;
      case 'cancelled': return 30;
      default: return 50;
    }
  }

  private getColor(score: number): string {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#eab308';
    if (score >= 40) return '#f97316';
    return '#ef4444';
  }

  private getLabel(score: number): string {
    if (score >= 80) return 'Healthy';
    if (score >= 60) return 'Fair';
    if (score >= 40) return 'Degraded';
    return 'Critical';
  }
}
