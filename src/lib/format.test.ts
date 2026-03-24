import { describe, it, expect } from 'vitest';
import {
  formatVolume,
  priceToPercent,
  formatPriceChange,
  formatEndDate,
  truncateQuestion,
  formatDollar,
  contestednessLabel,
} from './format';

describe('formatVolume', () => {
  it('formats billions', () => {
    expect(formatVolume(1_500_000_000)).toBe('1.5B');
    expect(formatVolume(1_000_000_000)).toBe('1.0B');
  });

  it('formats millions', () => {
    expect(formatVolume(2_500_000)).toBe('2.5M');
    expect(formatVolume(1_000_000)).toBe('1.0M');
  });

  it('formats thousands', () => {
    expect(formatVolume(50_000)).toBe('50.0K');
    expect(formatVolume(1_000)).toBe('1.0K');
  });

  it('formats small numbers as-is', () => {
    expect(formatVolume(500)).toBe('500');
    expect(formatVolume(0)).toBe('0');
  });

  it('handles edge cases at boundaries', () => {
    expect(formatVolume(999)).toBe('999');
    expect(formatVolume(1000)).toBe('1.0K');
    expect(formatVolume(999_999)).toBe('1000.0K');
    expect(formatVolume(1_000_000)).toBe('1.0M');
  });
});

describe('priceToPercent', () => {
  it('converts decimal to percentage string', () => {
    expect(priceToPercent(0.73)).toBe('73%');
    expect(priceToPercent(0.5)).toBe('50%');
    expect(priceToPercent(1)).toBe('100%');
    expect(priceToPercent(0)).toBe('0%');
  });

  it('rounds to nearest integer', () => {
    expect(priceToPercent(0.456)).toBe('46%');
    expect(priceToPercent(0.554)).toBe('55%');
  });
});

describe('formatPriceChange', () => {
  it('shows up arrow for positive change', () => {
    expect(formatPriceChange(0.032)).toBe('\u2191 3.2%');
  });

  it('shows down arrow for negative change', () => {
    expect(formatPriceChange(-0.015)).toBe('\u2193 1.5%');
  });

  it('shows right arrow for zero change', () => {
    expect(formatPriceChange(0)).toBe('\u2192 0.0%');
  });
});

describe('formatEndDate', () => {
  it('returns "Expired" for past dates', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(formatEndDate(past)).toBe('Expired');
  });

  it('returns "Today" for today', () => {
    const now = new Date();
    now.setHours(23, 59, 59);
    expect(formatEndDate(now.toISOString())).toBe('Today');
  });

  it('returns "Tomorrow" for next day', () => {
    const tomorrow = new Date(Date.now() + 86400000 + 3600000);
    expect(formatEndDate(tomorrow.toISOString())).toBe('Tomorrow');
  });

  it('returns days for 2-6 days out', () => {
    const threeDays = new Date(Date.now() + 3 * 86400000 + 3600000);
    expect(formatEndDate(threeDays.toISOString())).toBe('3d');
  });

  it('returns weeks for 7-29 days out', () => {
    const twoWeeks = new Date(Date.now() + 14 * 86400000 + 3600000);
    expect(formatEndDate(twoWeeks.toISOString())).toBe('2w');
  });
});

describe('truncateQuestion', () => {
  it('returns short questions unchanged', () => {
    expect(truncateQuestion('Will X happen?')).toBe('Will X happen?');
  });

  it('truncates long questions with ellipsis', () => {
    const long = 'A'.repeat(80);
    const result = truncateQuestion(long, 60);
    expect(result.length).toBe(60);
    expect(result.endsWith('...')).toBe(true);
  });

  it('respects custom maxLength', () => {
    const result = truncateQuestion('A'.repeat(50), 30);
    expect(result.length).toBe(30);
  });

  it('returns exact-length strings unchanged', () => {
    const exact = 'A'.repeat(60);
    expect(truncateQuestion(exact, 60)).toBe(exact);
  });
});

describe('formatDollar', () => {
  it('prepends dollar sign', () => {
    expect(formatDollar(1_000_000)).toBe('$1.0M');
    expect(formatDollar(500)).toBe('$500');
  });
});

describe('contestednessLabel', () => {
  it('returns correct labels for each range', () => {
    expect(contestednessLabel(0.9)).toBe('Toss-Up');
    expect(contestednessLabel(0.7)).toBe('Contested');
    expect(contestednessLabel(0.5)).toBe('Leaning');
    expect(contestednessLabel(0.3)).toBe('Likely');
    expect(contestednessLabel(0.1)).toBe('Strong Consensus');
  });
});
