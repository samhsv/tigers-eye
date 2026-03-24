import { describe, it, expect } from 'vitest';
import { contestednessToColor, categoryToColor, COLORS } from './colors';

describe('contestednessToColor', () => {
  it('returns deep navy for full consensus (0)', () => {
    const color = contestednessToColor(0);
    expect(color).toBe('#1e3a5f');
  });

  it('returns auburn orange for 50/50 contested (1)', () => {
    const color = contestednessToColor(1);
    expect(color).toBe('#ff6b1a');
  });

  it('returns neutral gray for middle range (0.5)', () => {
    const color = contestednessToColor(0.5);
    expect(color).toBe('#8b95a5');
  });

  it('returns a warm color for contested-warm range (0.75)', () => {
    const color = contestednessToColor(0.75);
    expect(color).toBe('#e8943a');
  });

  it('returns cool blue for consensus-cool range (0.25)', () => {
    const color = contestednessToColor(0.25);
    expect(color).toBe('#4a90b8');
  });

  it('clamps values below 0', () => {
    const color = contestednessToColor(-0.5);
    expect(color).toBe('#1e3a5f');
  });

  it('clamps values above 1', () => {
    const color = contestednessToColor(1.5);
    expect(color).toBe('#ff6b1a');
  });

  it('interpolates between stops', () => {
    const color = contestednessToColor(0.125);
    // Should be between #1e3a5f and #4a90b8
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
    // Red channel should be between 0x1e and 0x4a
    const r = parseInt(color.slice(1, 3), 16);
    expect(r).toBeGreaterThanOrEqual(0x1e);
    expect(r).toBeLessThanOrEqual(0x4a);
  });

  it('returns valid hex for all values 0-1 in 0.1 steps', () => {
    for (let i = 0; i <= 10; i++) {
      const color = contestednessToColor(i / 10);
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('categoryToColor', () => {
  it('returns specific color for known categories', () => {
    expect(categoryToColor('Politics')).toBe('#E85D3A');
    expect(categoryToColor('Crypto')).toBe('#F0B90B');
    expect(categoryToColor('Sports')).toBe('#4CAF50');
  });

  it('returns fallback gray for unknown categories', () => {
    expect(categoryToColor('UnknownCategory')).toBe('#8B95A5');
    expect(categoryToColor('')).toBe('#8B95A5');
  });
});

describe('COLORS constant', () => {
  it('has all expected color values', () => {
    expect(COLORS.BG_PRIMARY).toBe('#0A0E1A');
    expect(COLORS.AUBURN_GLOW).toBe('#FF6B1A');
    expect(COLORS.TEXT_DATA).toBe('#A0F0C0');
    expect(COLORS.AI_ACCENT).toBe('#FFB84D');
  });
});
