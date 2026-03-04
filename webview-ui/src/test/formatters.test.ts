import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatTokens,
  formatPercent,
  timeAgo,
  formatDuration,
  zoneColor,
  zoneClass,
  zoneBgClass,
  shortPath,
  agentDisplayName,
} from '../shared/formatters';

describe('formatTokens', () => {
  it('formats millions', () => {
    expect(formatTokens(1_000_000)).toBe('1.0M');
    expect(formatTokens(2_500_000)).toBe('2.5M');
    expect(formatTokens(10_000_000)).toBe('10.0M');
  });

  it('formats thousands', () => {
    expect(formatTokens(1_000)).toBe('1K');
    expect(formatTokens(125_000)).toBe('125K');
    expect(formatTokens(999_999)).toBe('1000K');
  });

  it('formats small numbers as-is', () => {
    expect(formatTokens(0)).toBe('0');
    expect(formatTokens(1)).toBe('1');
    expect(formatTokens(999)).toBe('999');
  });
});

describe('formatPercent', () => {
  it('formats whole numbers without decimals', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(50)).toBe('50%');
    expect(formatPercent(100)).toBe('100%');
  });

  it('formats decimals with one decimal place', () => {
    expect(formatPercent(33.3)).toBe('33.3%');
    expect(formatPercent(99.9)).toBe('99.9%');
    expect(formatPercent(0.5)).toBe('0.5%');
  });
});

describe('timeAgo', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns "never" for falsy timestamps', () => {
    expect(timeAgo(0)).toBe('never');
  });

  it('formats seconds', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_030_000);
    expect(timeAgo(1_000_000_000)).toBe('30s ago');
  });

  it('formats minutes', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_300_000);
    expect(timeAgo(1_000_000_000)).toBe('5m ago');
  });

  it('formats hours', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_007_200_000);
    expect(timeAgo(1_000_000_000)).toBe('2h ago');
  });

  it('formats days', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_172_800_000);
    expect(timeAgo(1_000_000_000)).toBe('2d ago');
  });
});

describe('formatDuration', () => {
  it('formats seconds only', () => {
    expect(formatDuration(5_000)).toBe('5s');
    expect(formatDuration(59_000)).toBe('59s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(65_000)).toBe('1m 5s');
    expect(formatDuration(320_000)).toBe('5m 20s');
    expect(formatDuration(3_599_000)).toBe('59m 59s');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(3_600_000)).toBe('1h 0m');
    expect(formatDuration(7_320_000)).toBe('2h 2m');
    expect(formatDuration(86_400_000)).toBe('24h 0m');
  });
});

describe('zoneColor', () => {
  it('returns CSS variable for each zone', () => {
    expect(zoneColor('green')).toBe('var(--zone-green)');
    expect(zoneColor('yellow')).toBe('var(--zone-yellow)');
    expect(zoneColor('orange')).toBe('var(--zone-orange)');
    expect(zoneColor('red')).toBe('var(--zone-red)');
  });
});

describe('zoneClass', () => {
  it('returns CSS class for each zone', () => {
    expect(zoneClass('green')).toBe('zone-green');
    expect(zoneClass('red')).toBe('zone-red');
  });
});

describe('zoneBgClass', () => {
  it('returns background CSS class for each zone', () => {
    expect(zoneBgClass('green')).toBe('zone-bg-green');
    expect(zoneBgClass('orange')).toBe('zone-bg-orange');
  });
});

describe('shortPath', () => {
  it('extracts filename from unix path', () => {
    expect(shortPath('src/core/stateManager.ts')).toBe('stateManager.ts');
  });

  it('extracts filename from windows path', () => {
    expect(shortPath('src\\core\\stateManager.ts')).toBe('stateManager.ts');
  });

  it('returns filename when no directory', () => {
    expect(shortPath('index.ts')).toBe('index.ts');
  });

  it('handles empty string', () => {
    expect(shortPath('')).toBe('');
  });
});

describe('agentDisplayName', () => {
  it('maps known agent types', () => {
    expect(agentDisplayName('copilot')).toBe('GitHub Copilot');
    expect(agentDisplayName('claude-code')).toBe('Claude Code');
    expect(agentDisplayName('cursor')).toBe('Cursor');
    expect(agentDisplayName('cline')).toBe('Cline');
    expect(agentDisplayName('codex')).toBe('Codex CLI');
    expect(agentDisplayName('unknown')).toBe('Unknown Agent');
  });

  it('returns raw type for unmapped agents', () => {
    expect(agentDisplayName('some-new-agent')).toBe('some-new-agent');
  });
});
