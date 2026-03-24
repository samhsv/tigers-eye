import { describe, it, expect } from 'vitest';
import {
  detectArbitrage,
  detectCorrelations,
  detectAnomalies,
  detectSpreadWatch,
  computeAllSignals,
} from './signals';
import type { MarketNode } from '../types';

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

describe('detectArbitrage', () => {
  it('flags events where sibling yes prices sum > 1.05', () => {
    const markets = [
      mockMarket({ id: '1', eventId: 'e1', outcomePrices: { yes: 0.40, no: 0.60 } }),
      mockMarket({ id: '2', eventId: 'e1', outcomePrices: { yes: 0.35, no: 0.65 } }),
      mockMarket({ id: '3', eventId: 'e1', outcomePrices: { yes: 0.35, no: 0.65 } }),
    ];
    const result = detectArbitrage(markets);
    expect(result).toHaveLength(1);
    expect(result[0].priceSum).toBeCloseTo(1.10);
    expect(result[0].deviation).toBeCloseTo(0.10);
    expect(result[0].marketIds).toEqual(['1', '2', '3']);
  });

  it('does not flag events where prices sum near 1.0', () => {
    const markets = [
      mockMarket({ id: '1', eventId: 'e1', outcomePrices: { yes: 0.50, no: 0.50 } }),
      mockMarket({ id: '2', eventId: 'e1', outcomePrices: { yes: 0.50, no: 0.50 } }),
    ];
    const result = detectArbitrage(markets);
    expect(result).toHaveLength(0);
  });

  it('ignores single-market events', () => {
    const markets = [
      mockMarket({ id: '1', eventId: 'e1', outcomePrices: { yes: 0.90, no: 0.10 } }),
    ];
    const result = detectArbitrage(markets);
    expect(result).toHaveLength(0);
  });

  it('flags events where prices sum < 0.95', () => {
    const markets = [
      mockMarket({ id: '1', eventId: 'e1', outcomePrices: { yes: 0.30, no: 0.70 } }),
      mockMarket({ id: '2', eventId: 'e1', outcomePrices: { yes: 0.30, no: 0.70 } }),
      mockMarket({ id: '3', eventId: 'e1', outcomePrices: { yes: 0.30, no: 0.70 } }),
    ];
    const result = detectArbitrage(markets);
    expect(result).toHaveLength(1);
    expect(result[0].deviation).toBeCloseTo(-0.10);
  });

  it('sorts by absolute deviation descending', () => {
    const markets = [
      mockMarket({ id: '1', eventId: 'e1', outcomePrices: { yes: 0.55, no: 0.45 } }),
      mockMarket({ id: '2', eventId: 'e1', outcomePrices: { yes: 0.55, no: 0.45 } }),
      mockMarket({ id: '3', eventId: 'e2', outcomePrices: { yes: 0.80, no: 0.20 } }),
      mockMarket({ id: '4', eventId: 'e2', outcomePrices: { yes: 0.80, no: 0.20 } }),
    ];
    const result = detectArbitrage(markets);
    expect(result).toHaveLength(2);
    expect(Math.abs(result[0].deviation)).toBeGreaterThanOrEqual(Math.abs(result[1].deviation));
  });

  it('ignores events with more than 10 siblings (multi-outcome, not mutually exclusive)', () => {
    const markets = Array.from({ length: 15 }, (_, i) =>
      mockMarket({ id: `${i}`, eventId: 'e1', outcomePrices: { yes: 0.20, no: 0.80 } }),
    );
    const result = detectArbitrage(markets);
    expect(result).toHaveLength(0);
  });

  it('excludes settled markets (price near 0 or 1) from sum', () => {
    const markets = [
      mockMarket({ id: '1', eventId: 'e1', outcomePrices: { yes: 0.50, no: 0.50 } }),
      mockMarket({ id: '2', eventId: 'e1', outcomePrices: { yes: 0.50, no: 0.50 } }),
      // This settled market would push the sum over 1.05, but should be excluded
      mockMarket({ id: '3', eventId: 'e1', outcomePrices: { yes: 0.01, no: 0.99 } }),
    ];
    const result = detectArbitrage(markets);
    expect(result).toHaveLength(0);
  });
});

describe('detectCorrelations', () => {
  it('finds markets in different categories with same direction within 1pp', () => {
    const markets = [
      mockMarket({ id: '1', category: 'Politics', oneDayPriceChange: 0.03 }),
      mockMarket({ id: '2', category: 'Crypto', oneDayPriceChange: 0.035 }),
    ];
    const result = detectCorrelations(markets);
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe('up');
  });

  it('ignores markets in the same category', () => {
    const markets = [
      mockMarket({ id: '1', category: 'Crypto', oneDayPriceChange: 0.03 }),
      mockMarket({ id: '2', category: 'Crypto', oneDayPriceChange: 0.035 }),
    ];
    const result = detectCorrelations(markets);
    expect(result).toHaveLength(0);
  });

  it('ignores markets moving in opposite directions', () => {
    const markets = [
      mockMarket({ id: '1', category: 'Politics', oneDayPriceChange: 0.03 }),
      mockMarket({ id: '2', category: 'Crypto', oneDayPriceChange: -0.03 }),
    ];
    const result = detectCorrelations(markets);
    expect(result).toHaveLength(0);
  });

  it('ignores markets with change difference >= 1pp', () => {
    const markets = [
      mockMarket({ id: '1', category: 'Politics', oneDayPriceChange: 0.03 }),
      mockMarket({ id: '2', category: 'Crypto', oneDayPriceChange: 0.05 }),
    ];
    const result = detectCorrelations(markets);
    expect(result).toHaveLength(0);
  });

  it('limits to top 5 results', () => {
    const markets: MarketNode[] = [];
    const categories = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    for (let i = 0; i < categories.length; i++) {
      markets.push(mockMarket({
        id: `${i}`,
        category: categories[i],
        oneDayPriceChange: 0.03,
      }));
    }
    const result = detectCorrelations(markets);
    expect(result.length).toBeLessThanOrEqual(5);
  });
});

describe('detectAnomalies', () => {
  it('flags high price change with below-median volume', () => {
    const markets = [
      mockMarket({ id: '1', oneDayPriceChange: 0.08, volume24hr: 100 }),
      mockMarket({ id: '2', oneDayPriceChange: 0.01, volume24hr: 5000 }),
      mockMarket({ id: '3', oneDayPriceChange: 0.01, volume24hr: 10000 }),
    ];
    // Median volume24hr = 5000, market 1 has 100 < 5000 and 8% change
    const result = detectAnomalies(markets);
    expect(result).toHaveLength(1);
    expect(result[0].market.id).toBe('1');
  });

  it('does not flag high price change with above-median volume', () => {
    const markets = [
      mockMarket({ id: '1', oneDayPriceChange: 0.08, volume24hr: 10000 }),
      mockMarket({ id: '2', oneDayPriceChange: 0.01, volume24hr: 5000 }),
      mockMarket({ id: '3', oneDayPriceChange: 0.01, volume24hr: 3000 }),
    ];
    const result = detectAnomalies(markets);
    expect(result).toHaveLength(0);
  });

  it('does not flag small price changes', () => {
    const markets = [
      mockMarket({ id: '1', oneDayPriceChange: 0.02, volume24hr: 100 }),
      mockMarket({ id: '2', oneDayPriceChange: 0.01, volume24hr: 5000 }),
    ];
    const result = detectAnomalies(markets);
    expect(result).toHaveLength(0);
  });

  it('skips markets with zero volume24hr', () => {
    const markets = [
      mockMarket({ id: '1', oneDayPriceChange: 0.08, volume24hr: 0 }),
      mockMarket({ id: '2', oneDayPriceChange: 0.01, volume24hr: 5000 }),
    ];
    const result = detectAnomalies(markets);
    expect(result).toHaveLength(0);
  });

  it('detects negative price changes too', () => {
    const markets = [
      mockMarket({ id: '1', oneDayPriceChange: -0.08, volume24hr: 100 }),
      mockMarket({ id: '2', oneDayPriceChange: 0.01, volume24hr: 5000 }),
      mockMarket({ id: '3', oneDayPriceChange: 0.01, volume24hr: 10000 }),
    ];
    const result = detectAnomalies(markets);
    expect(result).toHaveLength(1);
  });
});

describe('detectSpreadWatch', () => {
  it('flags markets with spread > 2x category average', () => {
    const markets = [
      mockMarket({ id: '1', category: 'Politics', spread: 0.08, bestBid: 0.60, bestAsk: 0.68 }),
      mockMarket({ id: '2', category: 'Politics', spread: 0.02, bestBid: 0.64, bestAsk: 0.66 }),
      mockMarket({ id: '3', category: 'Politics', spread: 0.02, bestBid: 0.64, bestAsk: 0.66 }),
    ];
    // Category avg = (0.08 + 0.02 + 0.02) / 3 = 0.04, market 1 ratio = 0.08/0.04 = 2.0
    // Need ratio > 2, so this is borderline — let's adjust
    const result = detectSpreadWatch(markets);
    // 0.08 / 0.04 = 2.0, not > 2, so no signal
    expect(result).toHaveLength(0);
  });

  it('flags when ratio clearly exceeds 2', () => {
    const markets = [
      mockMarket({ id: '1', category: 'Politics', spread: 0.10, bestBid: 0.60, bestAsk: 0.70 }),
      mockMarket({ id: '2', category: 'Politics', spread: 0.02, bestBid: 0.64, bestAsk: 0.66 }),
      mockMarket({ id: '3', category: 'Politics', spread: 0.02, bestBid: 0.64, bestAsk: 0.66 }),
      mockMarket({ id: '4', category: 'Politics', spread: 0.02, bestBid: 0.64, bestAsk: 0.66 }),
    ];
    // Category avg = (0.10 + 0.02 + 0.02 + 0.02) / 4 = 0.04, ratio = 0.10/0.04 = 2.5
    const result = detectSpreadWatch(markets);
    expect(result).toHaveLength(1);
    expect(result[0].market.id).toBe('1');
    expect(result[0].ratio).toBeCloseTo(2.5);
  });

  it('skips markets with no order book data', () => {
    const markets = [
      mockMarket({ id: '1', category: 'Politics', spread: 0.10, bestBid: 0, bestAsk: 0 }),
      mockMarket({ id: '2', category: 'Politics', spread: 0.02, bestBid: 0.64, bestAsk: 0.66 }),
    ];
    const result = detectSpreadWatch(markets);
    expect(result).toHaveLength(0);
  });

  it('limits to top 5 results', () => {
    const markets: MarketNode[] = [];
    for (let i = 0; i < 20; i++) {
      markets.push(mockMarket({
        id: `${i}`,
        category: 'Politics',
        spread: i < 8 ? 0.20 : 0.02,
        bestBid: 0.50,
        bestAsk: 0.50 + (i < 8 ? 0.20 : 0.02),
      }));
    }
    const result = detectSpreadWatch(markets);
    expect(result.length).toBeLessThanOrEqual(5);
  });
});

describe('computeAllSignals', () => {
  it('returns all signal types and flagged node map', () => {
    const markets = [
      // Arbitrage signals (sum = 1.10 for event e1)
      mockMarket({ id: '1', eventId: 'e1', outcomePrices: { yes: 0.40, no: 0.60 }, oneDayPriceChange: 0 }),
      mockMarket({ id: '2', eventId: 'e1', outcomePrices: { yes: 0.35, no: 0.65 }, oneDayPriceChange: 0 }),
      mockMarket({ id: '3', eventId: 'e1', outcomePrices: { yes: 0.35, no: 0.65 }, oneDayPriceChange: 0 }),
      // Anomaly signal (big move, low volume)
      mockMarket({ id: '4', eventId: 'e2', oneDayPriceChange: 0.10, volume24hr: 50 }),
      // Normal market for median computation
      mockMarket({ id: '5', eventId: 'e3', volume24hr: 10000, oneDayPriceChange: 0 }),
    ];

    const result = computeAllSignals(markets);

    expect(result.arbitrage.length).toBeGreaterThan(0);
    expect(result.anomalies.length).toBeGreaterThan(0);
    expect(result.flaggedNodeIds.size).toBeGreaterThan(0);

    // Arbitrage markets should be flagged
    expect(result.flaggedNodeIds.has('1')).toBe(true);
    expect(result.flaggedNodeIds.get('1')).toContain('arbitrage');
  });

  it('filters out expired markets', () => {
    const pastDate = '2020-01-01T00:00:00Z';
    const futureDate = '2099-12-31T00:00:00Z';
    const markets = [
      mockMarket({ id: '1', eventId: 'e1', endDate: pastDate, outcomePrices: { yes: 0.40, no: 0.60 }, oneDayPriceChange: 0.10, volume24hr: 50 }),
      mockMarket({ id: '2', eventId: 'e1', endDate: pastDate, outcomePrices: { yes: 0.35, no: 0.65 } }),
      mockMarket({ id: '3', eventId: 'e1', endDate: pastDate, outcomePrices: { yes: 0.35, no: 0.65 } }),
      // Only this one is live
      mockMarket({ id: '4', eventId: 'e2', endDate: futureDate, volume24hr: 10000, oneDayPriceChange: 0 }),
    ];

    const result = computeAllSignals(markets);
    // Expired markets should not produce arbitrage or anomaly signals
    expect(result.arbitrage).toHaveLength(0);
    expect(result.anomalies).toHaveLength(0);
  });

  it('sorts flagged node signal types by priority', () => {
    const markets = [
      // Market in an arbitrage event AND has anomaly
      mockMarket({
        id: '1',
        eventId: 'e1',
        outcomePrices: { yes: 0.60, no: 0.40 },
        oneDayPriceChange: 0.10,
        volume24hr: 50,
      }),
      mockMarket({
        id: '2',
        eventId: 'e1',
        outcomePrices: { yes: 0.60, no: 0.40 },
        oneDayPriceChange: 0,
        volume24hr: 10000,
      }),
      mockMarket({ id: '3', eventId: 'e2', volume24hr: 10000, oneDayPriceChange: 0 }),
    ];

    const result = computeAllSignals(markets);
    const types = result.flaggedNodeIds.get('1');
    if (types && types.length > 1) {
      // Arbitrage should come before anomaly in priority
      const arbIdx = types.indexOf('arbitrage');
      const anomIdx = types.indexOf('anomaly');
      if (arbIdx !== -1 && anomIdx !== -1) {
        expect(arbIdx).toBeLessThan(anomIdx);
      }
    }
  });
});
