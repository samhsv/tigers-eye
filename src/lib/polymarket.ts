import type { RawEvent, MarketNode, GraphData, GraphNode, ClusterCenter } from '../types';
import { contestednessToColor } from './colors';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// ── Fetch all markets via events endpoint ──
export async function fetchMarkets(): Promise<MarketNode[]> {
  const response = await fetch(`${API_BASE}/api/markets`);
  if (!response.ok) throw new Error(`Failed to fetch markets: ${response.status}`);

  const events: RawEvent[] = await response.json();
  return normalizeEvents(events);
}

// ── Category extraction ──
const CATEGORY_PRIORITY = [
  'Politics', 'Crypto', 'Sports', 'Pop Culture', 'Science',
  'Business', 'Finance', 'Technology', 'World', 'Entertainment',
  'Climate', 'AI', 'Elections',
];

function extractCategory(tags: RawEvent['tags']): string {
  if (!tags || tags.length === 0) return 'Other';

  for (const priority of CATEGORY_PRIORITY) {
    const match = tags.find(t =>
      t.label.toLowerCase().includes(priority.toLowerCase()),
    );
    if (match) return match.label;
  }

  return tags[0]?.label || 'Other';
}

// ── Normalize raw events into MarketNode[] ──
function normalizeEvents(events: RawEvent[]): MarketNode[] {
  const nodes: MarketNode[] = [];

  for (const event of events) {
    const category = extractCategory(event.tags);

    for (const market of event.markets) {
      if (market.closed || !market.active) continue;

      // Parse outcome prices (API returns JSON-encoded string, e.g. "[\"0.85\", \"0.15\"]")
      let parsedPrices: string[] = [];
      try {
        parsedPrices = typeof market.outcomePrices === 'string'
          ? JSON.parse(market.outcomePrices)
          : market.outcomePrices ?? [];
      } catch { /* malformed — leave as empty */ }
      const yesPrice = parseFloat(parsedPrices[0]) || 0;
      const noPrice = parseFloat(parsedPrices[1]) || (1 - yesPrice);

      const volume = market.volumeNum || parseFloat(market.volume) || 0;
      const liquidity = market.liquidityNum || parseFloat(market.liquidity || '0') || 0;

      // Contestedness: 1 = 50/50, 0 = full consensus
      const contestedness = 1 - Math.abs(yesPrice - 0.5) * 2;

      // Log-scaled orb size
      const orbSize = Math.max(1, Math.log10(volume + 1) * 1.5);

      // Pulse speed from 24h activity ratio
      const activityRatio = volume > 0 ? (market.volume24hr / volume) : 0;
      const pulseSpeed = Math.min(activityRatio * 10, 2);

      nodes.push({
        id: market.id,
        question: market.question,
        slug: market.slug,
        conditionId: market.conditionId,
        eventId: event.id,
        eventTitle: event.title,
        category,
        outcomePrices: { yes: yesPrice, no: noPrice },
        outcomes: (() => {
          try {
            return typeof market.outcomes === 'string'
              ? JSON.parse(market.outcomes)
              : market.outcomes ?? ['Yes', 'No'];
          } catch { return ['Yes', 'No']; }
        })(),
        volume,
        liquidity,
        volume24hr: market.volume24hr || 0,
        volume1wk: market.volume1wk || 0,
        oneDayPriceChange: market.oneDayPriceChange || 0,
        oneWeekPriceChange: market.oneWeekPriceChange || 0,
        lastTradePrice: market.lastTradePrice || 0,
        bestBid: market.bestBid || 0,
        bestAsk: market.bestAsk || 0,
        spread: market.spread || 0,
        endDate: market.endDate,
        contestedness,
        orbSize,
        orbColor: contestednessToColor(contestedness),
        pulseSpeed,
        clobTokenIds: market.clobTokenIds || [],
        image: market.image || event.image || '',
      });
    }
  }

  return nodes;
}

// ── Build graph data for react-force-graph-3d ──
export function buildGraphData(markets: MarketNode[]): GraphData {
  const nodes: GraphNode[] = markets.map(m => ({
    ...m,
    group: m.category,
    val: m.orbSize,
  }));

  return { nodes, links: [] };
}

// ── Compute cluster centers arranged in a ring ──
export function computeClusterCenters(categories: string[]): Record<string, ClusterCenter> {
  const centers: Record<string, ClusterCenter> = {};
  const radius = 300;

  categories.forEach((cat, i) => {
    const angle = (i / categories.length) * Math.PI * 2;
    centers[cat] = {
      x: Math.cos(angle) * radius,
      y: (Math.random() - 0.5) * 100,
      z: Math.sin(angle) * radius,
    };
  });

  return centers;
}

// ── Feed panel sorted lists ──
export function getClosestCalls(markets: MarketNode[], limit = 5): MarketNode[] {
  return [...markets]
    .sort((a, b) => b.contestedness - a.contestedness)
    .slice(0, limit);
}

export function getHighestVolume(markets: MarketNode[], limit = 5): MarketNode[] {
  return [...markets]
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limit);
}

export function getBiggestMovers(markets: MarketNode[], limit = 5): MarketNode[] {
  return [...markets]
    .sort((a, b) => Math.abs(b.oneDayPriceChange) - Math.abs(a.oneDayPriceChange))
    .slice(0, limit);
}

export function getMostActive(markets: MarketNode[], limit = 5): MarketNode[] {
  return [...markets]
    .sort((a, b) => b.volume24hr - a.volume24hr)
    .slice(0, limit);
}

export function getTopMarketsForAnalysis(markets: MarketNode[], limit = 25): MarketNode[] {
  return [...markets]
    .filter(m => m.volume > 10000 && m.contestedness > 0.2)
    .sort((a, b) => {
      const scoreA = a.contestedness * 0.4 + Math.log10(a.volume24hr + 1) * 0.3 + Math.log10(a.volume + 1) * 0.3;
      const scoreB = b.contestedness * 0.4 + Math.log10(b.volume24hr + 1) * 0.3 + Math.log10(b.volume + 1) * 0.3;
      return scoreB - scoreA;
    })
    .slice(0, limit);
}
