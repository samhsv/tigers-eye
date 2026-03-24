import { describe, it, expect } from 'vitest';
import { buildGraphData, computeClusterCenters, getClosestCalls, getHighestVolume, getBiggestMovers, getMostActive, getTopMarketsForAnalysis } from './polymarket';
import type { MarketNode } from '../types';

// Helper to create mock MarketNode
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
    endDate: '2025-12-31T00:00:00Z',
    contestedness: 0.7,
    orbSize: 3,
    orbColor: '#E8943A',
    pulseSpeed: 0.5,
    clobTokenIds: ['token-1'],
    image: '',
    ...overrides,
  };
}

describe('buildGraphData', () => {
  it('converts MarketNode[] to GraphData with nodes and empty links', () => {
    const markets = [
      mockMarket({ id: '1', category: 'Crypto' }),
      mockMarket({ id: '2', category: 'Politics' }),
    ];

    const graphData = buildGraphData(markets);

    expect(graphData.nodes).toHaveLength(2);
    expect(graphData.links).toEqual([]);
  });

  it('sets group to category and val to orbSize', () => {
    const market = mockMarket({ category: 'Sports', orbSize: 4.5 });
    const graphData = buildGraphData([market]);

    expect(graphData.nodes[0].group).toBe('Sports');
    expect(graphData.nodes[0].val).toBe(4.5);
  });

  it('preserves all MarketNode fields in GraphNode', () => {
    const market = mockMarket({ question: 'Test question?', volume: 999 });
    const graphData = buildGraphData([market]);

    expect(graphData.nodes[0].question).toBe('Test question?');
    expect(graphData.nodes[0].volume).toBe(999);
  });

  it('returns empty graph for empty input', () => {
    const graphData = buildGraphData([]);
    expect(graphData.nodes).toEqual([]);
    expect(graphData.links).toEqual([]);
  });
});

describe('computeClusterCenters', () => {
  it('returns a center for each category', () => {
    const categories = ['Politics', 'Crypto', 'Sports'];
    const centers = computeClusterCenters(categories);

    expect(Object.keys(centers)).toHaveLength(3);
    expect(centers['Politics']).toBeDefined();
    expect(centers['Crypto']).toBeDefined();
    expect(centers['Sports']).toBeDefined();
  });

  it('places centers in a ring with correct x/z coordinates', () => {
    const categories = ['A', 'B'];
    const centers = computeClusterCenters(categories);

    // First category at angle 0 → x=300, z=0
    expect(centers['A'].x).toBeCloseTo(300, 0);
    expect(centers['A'].z).toBeCloseTo(0, 0);

    // Second category at angle PI → x=-300, z≈0
    expect(centers['B'].x).toBeCloseTo(-300, 0);
    expect(Math.abs(centers['B'].z)).toBeLessThan(1); // sin(PI) ≈ 0
  });

  it('gives y values between -50 and 50', () => {
    const categories = ['A', 'B', 'C', 'D', 'E'];
    const centers = computeClusterCenters(categories);

    for (const cat of categories) {
      expect(centers[cat].y).toBeGreaterThanOrEqual(-50);
      expect(centers[cat].y).toBeLessThanOrEqual(50);
    }
  });

  it('returns empty object for empty categories', () => {
    expect(computeClusterCenters([])).toEqual({});
  });
});

describe('feed panel sorting', () => {
  const markets = [
    mockMarket({ id: '1', contestedness: 0.9, volume: 1000, volume24hr: 100, oneDayPriceChange: 0.01 }),
    mockMarket({ id: '2', contestedness: 0.3, volume: 5000000, volume24hr: 500000, oneDayPriceChange: -0.15 }),
    mockMarket({ id: '3', contestedness: 0.95, volume: 50000, volume24hr: 10000, oneDayPriceChange: 0.08 }),
    mockMarket({ id: '4', contestedness: 0.1, volume: 200000, volume24hr: 300, oneDayPriceChange: 0 }),
    mockMarket({ id: '5', contestedness: 0.5, volume: 100000, volume24hr: 50000, oneDayPriceChange: -0.05 }),
    mockMarket({ id: '6', contestedness: 0.8, volume: 3000000, volume24hr: 200000, oneDayPriceChange: 0.12 }),
  ];

  describe('getClosestCalls', () => {
    it('sorts by contestedness descending', () => {
      const result = getClosestCalls(markets, 3);
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('3'); // 0.95
      expect(result[1].id).toBe('1'); // 0.9
      expect(result[2].id).toBe('6'); // 0.8
    });

    it('respects limit', () => {
      expect(getClosestCalls(markets, 2)).toHaveLength(2);
    });
  });

  describe('getHighestVolume', () => {
    it('sorts by volume descending', () => {
      const result = getHighestVolume(markets, 3);
      expect(result[0].id).toBe('2'); // 5M
      expect(result[1].id).toBe('6'); // 3M
      expect(result[2].id).toBe('4'); // 200K
    });
  });

  describe('getBiggestMovers', () => {
    it('sorts by absolute oneDayPriceChange descending', () => {
      const result = getBiggestMovers(markets, 3);
      expect(result[0].id).toBe('2'); // |-0.15| = 0.15
      expect(result[1].id).toBe('6'); // |0.12| = 0.12
      expect(result[2].id).toBe('3'); // |0.08| = 0.08
    });
  });

  describe('getMostActive', () => {
    it('sorts by volume24hr descending', () => {
      const result = getMostActive(markets, 3);
      expect(result[0].id).toBe('2'); // 500K
      expect(result[1].id).toBe('6'); // 200K
      expect(result[2].id).toBe('5'); // 50K
    });
  });
});

describe('getTopMarketsForAnalysis', () => {
  it('filters out low-volume and low-contestedness markets', () => {
    const markets = [
      mockMarket({ id: '1', volume: 500, contestedness: 0.9 }),    // too low volume
      mockMarket({ id: '2', volume: 100000, contestedness: 0.1 }), // too low contestedness
      mockMarket({ id: '3', volume: 100000, contestedness: 0.5 }), // should pass
    ];

    const result = getTopMarketsForAnalysis(markets, 25);
    expect(result.find(m => m.id === '1')).toBeUndefined();
    expect(result.find(m => m.id === '2')).toBeUndefined();
    expect(result.find(m => m.id === '3')).toBeDefined();
  });

  it('respects the limit parameter', () => {
    const markets = Array.from({ length: 50 }, (_, i) =>
      mockMarket({ id: `${i}`, volume: 100000 + i * 1000, contestedness: 0.5 + (i % 5) * 0.1 }),
    );
    const result = getTopMarketsForAnalysis(markets, 10);
    expect(result).toHaveLength(10);
  });

  it('does not mutate input array', () => {
    const markets = [
      mockMarket({ id: '1', volume: 100000, contestedness: 0.5 }),
      mockMarket({ id: '2', volume: 200000, contestedness: 0.8 }),
    ];
    const original = [...markets];
    getTopMarketsForAnalysis(markets, 25);
    expect(markets).toEqual(original);
  });
});
