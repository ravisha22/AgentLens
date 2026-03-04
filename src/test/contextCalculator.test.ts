import { describe, it, expect, beforeEach } from 'vitest';
import { ContextCalculator } from '../core/contextCalculator';
import { ContextThresholds, DetectedModel } from '../types';

const defaultThresholds: ContextThresholds = {
  warning: 70,
  danger: 85,
  critical: 95,
};

function makeModel(overrides?: Partial<DetectedModel>): DetectedModel {
  return {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    family: 'opus',
    vendor: 'anthropic',
    maxInputTokens: 200_000,
    maxOutputTokens: 32_000,
    isActive: true,
    ...overrides,
  };
}

describe('ContextCalculator', () => {
  let calc: ContextCalculator;

  beforeEach(() => {
    calc = new ContextCalculator();
  });

  // ── No model set ──────────────────────────────────────────────────────────

  describe('when no model is set', () => {
    it('returns unavailable state', () => {
      const state = calc.getState(defaultThresholds);
      expect(state.dataAvailability).toBe('unavailable');
      expect(state.modelName).toBe('No Model Detected');
      expect(state.usedTokens).toBe(0);
      expect(state.usagePercent).toBe(0);
      expect(state.zone).toBe('green');
      expect(state.errorMessage).toContain('No AI model detected');
    });
  });

  // ── Model set, no usage ───────────────────────────────────────────────────

  describe('when model is set but no usage data', () => {
    it('returns partial state', () => {
      calc.setModel(makeModel());
      const state = calc.getState(defaultThresholds);
      expect(state.dataAvailability).toBe('partial');
      expect(state.modelName).toBe('Claude Opus 4');
      expect(state.usedTokens).toBe(0);
      expect(state.usagePercent).toBe(0);
      expect(state.errorMessage).toContain('token usage data is not yet available');
    });
  });

  // ── Zone classification ───────────────────────────────────────────────────

  describe('zone classification', () => {
    const cases: Array<{ tokens: number; expectedZone: string; label: string }> = [
      { tokens: 0, expectedZone: 'green', label: '0% usage' },
      { tokens: 50_000, expectedZone: 'green', label: '25% usage' },
      { tokens: 138_000, expectedZone: 'green', label: '69% — safely under warning' },
      { tokens: 140_000, expectedZone: 'yellow', label: '70% — at warning threshold' },
      { tokens: 160_000, expectedZone: 'yellow', label: '80% — mid yellow' },
      { tokens: 168_000, expectedZone: 'yellow', label: '84% — safely yellow' },
      { tokens: 170_000, expectedZone: 'orange', label: '85% — at danger threshold' },
      { tokens: 180_000, expectedZone: 'orange', label: '90% — mid orange' },
      { tokens: 188_000, expectedZone: 'orange', label: '94% — safely orange' },
      { tokens: 190_000, expectedZone: 'red', label: '95% — at critical threshold' },
      { tokens: 200_000, expectedZone: 'red', label: '100% — fully used' },
    ];

    cases.forEach(({ tokens, expectedZone, label }) => {
      it(`classifies ${label} as ${expectedZone}`, () => {
        calc.setModel(makeModel());
        calc.updateUsage(tokens, 'test');
        const state = calc.getState(defaultThresholds);
        expect(state.zone).toBe(expectedZone);
      });
    });
  });

  // ── Usage percent rounding ────────────────────────────────────────────────

  describe('usage percent calculation', () => {
    it('rounds to nearest integer', () => {
      calc.setModel(makeModel());
      calc.updateUsage(33_333, 'test'); // 16.667%
      const state = calc.getState(defaultThresholds);
      expect(state.usagePercent).toBe(17);
    });

    it('returns 0% when max tokens is 0', () => {
      calc.setModel(makeModel({ maxInputTokens: 0 }));
      calc.updateUsage(5000, 'test');
      const state = calc.getState(defaultThresholds);
      expect(state.usagePercent).toBe(0);
    });
  });

  // ── Available state fields ────────────────────────────────────────────────

  describe('available state', () => {
    it('includes all model info and data source', () => {
      const model = makeModel();
      calc.setModel(model);
      calc.updateUsage(100_000, 'claude-code-logs');
      const state = calc.getState(defaultThresholds);

      expect(state.dataAvailability).toBe('available');
      expect(state.dataSource).toBe('claude-code-logs');
      expect(state.modelId).toBe(model.id);
      expect(state.modelFamily).toBe('opus');
      expect(state.modelVendor).toBe('anthropic');
      expect(state.maxInputTokens).toBe(200_000);
      expect(state.maxOutputTokens).toBe(32_000);
      expect(state.usedTokens).toBe(100_000);
      expect(state.usagePercent).toBe(50);
      expect(state.breakdownAvailable).toBe(false);
    });
  });

  // ── Custom thresholds ─────────────────────────────────────────────────────

  describe('custom thresholds', () => {
    it('respects non-default thresholds', () => {
      const tight: ContextThresholds = { warning: 50, danger: 60, critical: 75 };
      calc.setModel(makeModel());
      calc.updateUsage(110_000, 'test'); // 55%
      expect(calc.getState(tight).zone).toBe('yellow');
    });
  });

  // ── estimateTokensFromBytes ───────────────────────────────────────────────

  describe('estimateTokensFromBytes', () => {
    it('estimates 1 token per 4 bytes', () => {
      expect(ContextCalculator.estimateTokensFromBytes(1000)).toBe(250);
    });

    it('rounds up for non-divisible sizes', () => {
      expect(ContextCalculator.estimateTokensFromBytes(1001)).toBe(251);
      expect(ContextCalculator.estimateTokensFromBytes(1)).toBe(1);
    });

    it('returns 0 for 0 bytes', () => {
      expect(ContextCalculator.estimateTokensFromBytes(0)).toBe(0);
    });
  });

  // ── getModelInfo ──────────────────────────────────────────────────────────

  describe('getModelInfo', () => {
    it('returns undefined when no model set', () => {
      expect(calc.getModelInfo()).toBeUndefined();
    });

    it('returns the model after setModel', () => {
      const model = makeModel();
      calc.setModel(model);
      expect(calc.getModelInfo()).toBe(model);
    });
  });

  // ── Usage updates override previous values ────────────────────────────────

  describe('usage updates', () => {
    it('replaces previous usage with latest value', () => {
      calc.setModel(makeModel());
      calc.updateUsage(50_000, 'source-a');
      calc.updateUsage(150_000, 'source-b');
      const state = calc.getState(defaultThresholds);
      expect(state.usedTokens).toBe(150_000);
      expect(state.dataSource).toBe('source-b');
      expect(state.usagePercent).toBe(75);
    });
  });
});
