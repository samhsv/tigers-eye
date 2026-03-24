import { describe, it, expect } from 'vitest';
import { computeColors, computeSizes, computeMarketColor, getColorLegend } from './visualEncoding';
import type { MarketNode, ColorMode, SizeMode } from '../types';

function mockMarket(overrides: Partial<MarketNode> = {}): MarketNode {
  return {
    id: 'test-id',
    question: 'Will something happen?',
    slug: 'test-slug',
    conditionId: 'cond-1',
    eventId: 'evt-1',
    eventTitle: 'Test Event',
    category: 'Politics',
    outcomePrices: { yes: 0.65, no: 0.35 },
    outcomes: ['Yes', 'No'],
    volume: 100000,
    liquidity: 50000,
    volume24hr: 5000,
    volume1wk: 20000,
    oneDayPriceChange: 0.02,
    oneWeekPriceChange: 0.05,
    lastTradePrice: 0.65,
    bestBid: 0.64,
    bestAsk: 0.66,
    spread: 0.02,
    endDate: '2099-12-31T00:00:00Z',
    contestedness: 0.7,
    orbSize: 3,
    orbColor: '#E8943A',
    pulseSpeed: 0.5,
    clobTokenIds: ['token-1'],
    image: '',
    ...overrides,
  };
}

const HEX_REGEX = /^#[0-9a-f]{6}$/i;

// ── Color computation tests ──

describe('computeColors', () => {
  const markets = [
    mockMarket({ id: 'a', contestedness: 0.1, oneDayPriceChange: -0.08, category: 'Crypto', spread: 0.01, volume: 100000, liquidity: 80000 }),
    mockMarket({ id: 'b', contestedness: 0.9, oneDayPriceChange: 0.05, category: 'Sports', spread: 0.08, volume: 50000, liquidity: 5000 }),
    mockMarket({ id: 'c', contestedness: 0.5, oneDayPriceChange: 0, category: 'Politics', spread: 0.03, volume: 200000, liquidity: 40000 }),
  ];

  it('contestedness mode returns valid hex for all markets', () => {
    const colors = computeColors(markets, 'contestedness');
    expect(colors.size).toBe(3);
    for (const hex of colors.values()) {
      expect(hex).toMatch(HEX_REGEX);
    }
  });

  it('contestedness colors differ by contestedness value', () => {
    const colors = computeColors(markets, 'contestedness');
    expect(colors.get('a')).not.toBe(colors.get('b'));
  });

  it('momentum mode: negative change → reddish, positive → greenish, zero → grayish', () => {
    const colors = computeColors(markets, 'momentum');
    expect(colors.size).toBe(3);
    for (const hex of colors.values()) {
      expect(hex).toMatch(HEX_REGEX);
    }
    // All three should be different
    expect(colors.get('a')).not.toBe(colors.get('b'));
    expect(colors.get('b')).not.toBe(colors.get('c'));
  });

  it('category mode returns different colors for different categories', () => {
    const colors = computeColors(markets, 'category');
    expect(colors.get('a')).not.toBe(colors.get('b'));
    expect(colors.get('a')).not.toBe(colors.get('c'));
  });

  it('spread mode returns valid hex', () => {
    const colors = computeColors(markets, 'spread');
    expect(colors.size).toBe(3);
    for (const hex of colors.values()) {
      expect(hex).toMatch(HEX_REGEX);
    }
  });

  it('liquidityRatio mode returns valid hex', () => {
    const colors = computeColors(markets, 'liquidityRatio');
    expect(colors.size).toBe(3);
    for (const hex of colors.values()) {
      expect(hex).toMatch(HEX_REGEX);
    }
  });

  it('handles zero volume in liquidityRatio without error', () => {
    const zeroVol = [mockMarket({ id: 'z', volume: 0, liquidity: 0 })];
    const colors = computeColors(zeroVol, 'liquidityRatio');
    expect(colors.get('z')).toMatch(HEX_REGEX);
  });

  it('handles zero spread', () => {
    const zeroSpread = [mockMarket({ id: 'z', spread: 0 })];
    const colors = computeColors(zeroSpread, 'spread');
    expect(colors.get('z')).toMatch(HEX_REGEX);
  });

  it('handles empty market array', () => {
    const allModes: ColorMode[] = ['contestedness', 'momentum', 'category', 'spread', 'liquidityRatio'];
    for (const mode of allModes) {
      const colors = computeColors([], mode);
      expect(colors.size).toBe(0);
    }
  });

  it('handles single market', () => {
    const single = [mockMarket({ id: 'only' })];
    const allModes: ColorMode[] = ['contestedness', 'momentum', 'category', 'spread', 'liquidityRatio'];
    for (const mode of allModes) {
      const colors = computeColors(single, mode);
      expect(colors.size).toBe(1);
      expect(colors.get('only')).toMatch(HEX_REGEX);
    }
  });
});

// ── Size computation tests ──

describe('computeSizes', () => {
  const markets = [
    mockMarket({ id: 'a', volume: 1000000, liquidity: 500000, volume24hr: 50000, contestedness: 0.1, spread: 0.01 }),
    mockMarket({ id: 'b', volume: 1000, liquidity: 100, volume24hr: 10, contestedness: 0.9, spread: 0.10 }),
  ];

  it('volume mode: high volume → larger size', () => {
    const sizes = computeSizes(markets, 'volume');
    expect(sizes.get('a')!).toBeGreaterThan(sizes.get('b')!);
  });

  it('liquidity mode: high liquidity → larger size', () => {
    const sizes = computeSizes(markets, 'liquidity');
    expect(sizes.get('a')!).toBeGreaterThan(sizes.get('b')!);
  });

  it('activity24h mode: high activity → larger size', () => {
    const sizes = computeSizes(markets, 'activity24h');
    expect(sizes.get('a')!).toBeGreaterThan(sizes.get('b')!);
  });

  it('contestedness mode: high contestedness → larger size', () => {
    const sizes = computeSizes(markets, 'contestedness');
    expect(sizes.get('b')!).toBeGreaterThan(sizes.get('a')!);
  });

  it('spread mode: wider spread → larger size', () => {
    const sizes = computeSizes(markets, 'spread');
    expect(sizes.get('b')!).toBeGreaterThan(sizes.get('a')!);
  });

  it('all sizes are >= 1 (minimum radius)', () => {
    const allModes: SizeMode[] = ['volume', 'liquidity', 'activity24h', 'contestedness', 'spread'];
    for (const mode of allModes) {
      const sizes = computeSizes(markets, mode);
      for (const size of sizes.values()) {
        expect(size).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('handles zero values', () => {
    const zeroMarket = [mockMarket({ id: 'z', volume: 0, liquidity: 0, volume24hr: 0, contestedness: 0, spread: 0 })];
    const allModes: SizeMode[] = ['volume', 'liquidity', 'activity24h', 'contestedness', 'spread'];
    for (const mode of allModes) {
      const sizes = computeSizes(zeroMarket, mode);
      expect(sizes.get('z')).toBeGreaterThanOrEqual(1);
    }
  });

  it('handles empty array', () => {
    const allModes: SizeMode[] = ['volume', 'liquidity', 'activity24h', 'contestedness', 'spread'];
    for (const mode of allModes) {
      const sizes = computeSizes([], mode);
      expect(sizes.size).toBe(0);
    }
  });
});

// ── computeMarketColor tests ──

describe('computeMarketColor', () => {
  it('returns valid hex for all modes', () => {
    const market = mockMarket();
    const allModes: ColorMode[] = ['contestedness', 'momentum', 'category', 'spread', 'liquidityRatio'];
    for (const mode of allModes) {
      expect(computeMarketColor(market, mode)).toMatch(HEX_REGEX);
    }
  });

  it('spread mode with allMarkets context works', () => {
    const markets = [
      mockMarket({ id: 'a', spread: 0.01 }),
      mockMarket({ id: 'b', spread: 0.10 }),
    ];
    const colorA = computeMarketColor(markets[0], 'spread', markets);
    const colorB = computeMarketColor(markets[1], 'spread', markets);
    expect(colorA).toMatch(HEX_REGEX);
    expect(colorB).toMatch(HEX_REGEX);
    expect(colorA).not.toBe(colorB);
  });

  it('momentum: extreme negative returns red-ish', () => {
    const falling = mockMarket({ oneDayPriceChange: -0.10 });
    const color = computeMarketColor(falling, 'momentum');
    // Red channel should dominate — parse hex
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    expect(r).toBeGreaterThan(g);
  });

  it('momentum: extreme positive returns green-ish', () => {
    const rising = mockMarket({ oneDayPriceChange: 0.10 });
    const color = computeMarketColor(rising, 'momentum');
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    expect(g).toBeGreaterThan(r);
  });

  it('momentum: zero change returns neutral gray', () => {
    const flat = mockMarket({ oneDayPriceChange: 0 });
    const color = computeMarketColor(flat, 'momentum');
    // Gray: R, G, B should be close to each other
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    expect(Math.abs(r - g)).toBeLessThan(20);
    expect(Math.abs(g - b)).toBeLessThan(20);
  });
});

// ── Legend tests ──

describe('getColorLegend', () => {
  it('returns legend for all modes', () => {
    const allModes: ColorMode[] = ['contestedness', 'momentum', 'category', 'spread', 'liquidityRatio'];
    for (const mode of allModes) {
      const legend = getColorLegend(mode);
      expect(legend.mode).toBe(mode);
      expect(legend.label).toBeTruthy();
    }
  });

  it('momentum legend has 3 stops', () => {
    const legend = getColorLegend('momentum');
    expect(legend.stops.length).toBe(3);
  });

  it('category legend has empty stops (colors are per-category)', () => {
    const legend = getColorLegend('category');
    expect(legend.stops.length).toBe(0);
  });
});
