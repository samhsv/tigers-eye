import type {
  MarketNode,
  SignalType,
  SignalResults,
  ArbitrageSignal,
  CorrelationSignal,
  AnomalySignal,
  SpreadWatchSignal,
} from '../types';

export const SIGNAL_COLORS: Record<SignalType, string> = {
  arbitrage: '#F87171',
  anomaly: '#FBBF24',
  spreadWatch: '#34D399',
  correlation: '#818CF8',
};

export const SIGNAL_PRIORITY: SignalType[] = ['arbitrage', 'anomaly', 'spreadWatch', 'correlation'];

// ── Arbitrage Detector ──
// Group sibling markets by eventId, sum yes prices.
// If |sum - 1.0| > 0.05, the event has mispricing across its markets.

export function detectArbitrage(markets: MarketNode[]): ArbitrageSignal[] {
  const groups = new Map<string, MarketNode[]>();
  for (const m of markets) {
    const list = groups.get(m.eventId) || [];
    list.push(m);
    groups.set(m.eventId, list);
  }

  const signals: ArbitrageSignal[] = [];
  for (const [eventId, siblings] of groups) {
    if (siblings.length < 2) continue;

    const priceSum = siblings.reduce((sum, m) => sum + m.outcomePrices.yes, 0);
    const deviation = priceSum - 1.0;

    if (Math.abs(deviation) > 0.05) {
      signals.push({
        type: 'arbitrage',
        eventId,
        eventTitle: siblings[0].eventTitle,
        marketIds: siblings.map(m => m.id),
        priceSum,
        deviation,
      });
    }
  }

  return signals.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
}

// ── Correlation Spotter ──
// Find markets in DIFFERENT categories with nearly identical price changes
// (within 1 percentage point) in the same direction.

export function detectCorrelations(markets: MarketNode[]): CorrelationSignal[] {
  const movers = markets.filter(m => m.oneDayPriceChange !== 0);
  const signals: CorrelationSignal[] = [];

  for (let i = 0; i < movers.length; i++) {
    for (let j = i + 1; j < movers.length; j++) {
      const a = movers[i];
      const b = movers[j];

      if (a.category === b.category) continue;
      if (Math.sign(a.oneDayPriceChange) !== Math.sign(b.oneDayPriceChange)) continue;
      if (Math.abs(a.oneDayPriceChange - b.oneDayPriceChange) >= 0.01) continue;

      const sharedChange = (a.oneDayPriceChange + b.oneDayPriceChange) / 2;
      signals.push({
        type: 'correlation',
        marketA: a,
        marketB: b,
        sharedChange,
        direction: sharedChange > 0 ? 'up' : 'down',
      });
    }
  }

  return signals
    .sort((a, b) => Math.abs(b.sharedChange) - Math.abs(a.sharedChange))
    .slice(0, 5);
}

// ── Anomaly Detector ──
// Markets with large price moves (>5%) but volume24hr below median.
// Price moved without volume = possible manipulation or news-ahead-of-flow.

export function detectAnomalies(markets: MarketNode[]): AnomalySignal[] {
  const volumes = markets.map(m => m.volume24hr).sort((a, b) => a - b);
  const medianVolume24hr = volumes.length > 0
    ? volumes[Math.floor(volumes.length / 2)]
    : 0;

  const signals: AnomalySignal[] = [];
  for (const m of markets) {
    if (Math.abs(m.oneDayPriceChange) <= 0.05) continue;
    if (m.volume24hr >= medianVolume24hr) continue;
    if (m.volume24hr <= 0) continue;

    signals.push({
      type: 'anomaly',
      market: m,
      priceChange: m.oneDayPriceChange,
      volume24hr: m.volume24hr,
      medianVolume24hr,
    });
  }

  return signals.sort((a, b) => Math.abs(b.priceChange) - Math.abs(a.priceChange));
}

// ── Spread Watch ──
// Markets where spread > 2x category average = inefficient markets.
// Only considers markets with valid order book data (bestBid > 0 && bestAsk > 0).

export function detectSpreadWatch(markets: MarketNode[]): SpreadWatchSignal[] {
  const validMarkets = markets.filter(m => m.bestBid > 0 && m.bestAsk > 0);

  // Compute average spread per category
  const categorySpreads = new Map<string, { total: number; count: number }>();
  for (const m of validMarkets) {
    const entry = categorySpreads.get(m.category) || { total: 0, count: 0 };
    entry.total += m.spread;
    entry.count += 1;
    categorySpreads.set(m.category, entry);
  }

  const categoryAvgs = new Map<string, number>();
  for (const [cat, { total, count }] of categorySpreads) {
    categoryAvgs.set(cat, total / count);
  }

  const signals: SpreadWatchSignal[] = [];
  for (const m of validMarkets) {
    const avg = categoryAvgs.get(m.category);
    if (!avg || avg <= 0) continue;

    const ratio = m.spread / avg;
    if (ratio <= 2) continue;

    signals.push({
      type: 'spreadWatch',
      market: m,
      spread: m.spread,
      categoryAvg: avg,
      ratio,
    });
  }

  return signals
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 5);
}

// ── Build flagged node map ──
// Collects which node IDs are affected by which signal types.
// Each node's signal types are sorted by priority (highest first).

function buildFlaggedNodeMap(
  arbitrage: ArbitrageSignal[],
  correlations: CorrelationSignal[],
  anomalies: AnomalySignal[],
  spreadWatch: SpreadWatchSignal[],
): Map<string, SignalType[]> {
  const map = new Map<string, Set<SignalType>>();

  function add(id: string, type: SignalType) {
    const set = map.get(id) || new Set();
    set.add(type);
    map.set(id, set);
  }

  for (const s of arbitrage) {
    for (const id of s.marketIds) add(id, 'arbitrage');
  }
  for (const s of correlations) {
    add(s.marketA.id, 'correlation');
    add(s.marketB.id, 'correlation');
  }
  for (const s of anomalies) {
    add(s.market.id, 'anomaly');
  }
  for (const s of spreadWatch) {
    add(s.market.id, 'spreadWatch');
  }

  // Convert sets to sorted arrays (by priority)
  const result = new Map<string, SignalType[]>();
  for (const [id, set] of map) {
    result.set(id, SIGNAL_PRIORITY.filter(t => set.has(t)));
  }
  return result;
}

// ── Main entry point ──

export function computeAllSignals(markets: MarketNode[]): SignalResults {
  const arbitrage = detectArbitrage(markets);
  const correlations = detectCorrelations(markets);
  const anomalies = detectAnomalies(markets);
  const spreadWatch = detectSpreadWatch(markets);
  const flaggedNodeIds = buildFlaggedNodeMap(arbitrage, correlations, anomalies, spreadWatch);

  return { arbitrage, correlations, anomalies, spreadWatch, flaggedNodeIds };
}
