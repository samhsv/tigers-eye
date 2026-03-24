import type { MarketNode, ColorMode, SizeMode } from '../types';
import { contestednessToColor, categoryToColor } from './colors';

// ── Gradient interpolation ──

interface RGB { r: number; g: number; b: number }
interface ColorStop { position: number; color: RGB }

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function interpolateGradient(value: number, stops: ColorStop[]): string {
  const t = Math.max(0, Math.min(1, value));

  for (let i = 0; i < stops.length - 1; i++) {
    const lower = stops[i];
    const upper = stops[i + 1];
    if (t >= lower.position && t <= upper.position) {
      const segmentT = (t - lower.position) / (upper.position - lower.position);
      return rgbToHex(
        lerp(lower.color.r, upper.color.r, segmentT),
        lerp(lower.color.g, upper.color.g, segmentT),
        lerp(lower.color.b, upper.color.b, segmentT),
      );
    }
  }

  return rgbToHex(stops[stops.length - 1].color.r, stops[stops.length - 1].color.g, stops[stops.length - 1].color.b);
}

// ── Color gradients ──

// Momentum: red (falling) → gray (flat) → green (rising)
const MOMENTUM_STOPS: ColorStop[] = [
  { position: 0.0,  color: { r: 0xF8, g: 0x71, b: 0x71 } }, // red — crashing
  { position: 0.35, color: { r: 0xF8, g: 0x71, b: 0x71 } }, // red — falling
  { position: 0.5,  color: { r: 0x8B, g: 0x95, b: 0xA5 } }, // gray — flat
  { position: 0.65, color: { r: 0x34, g: 0xD3, b: 0x99 } }, // green — rising
  { position: 1.0,  color: { r: 0x34, g: 0xD3, b: 0x99 } }, // green — surging
];

// Spread: tight/efficient (blue) → wide/inefficient (orange)
const SPREAD_COLOR_STOPS: ColorStop[] = [
  { position: 0.0,  color: { r: 0x1E, g: 0x3A, b: 0x5F } }, // deep navy — very tight
  { position: 0.25, color: { r: 0x4A, g: 0x90, b: 0xB8 } }, // cool blue
  { position: 0.5,  color: { r: 0x8B, g: 0x95, b: 0xA5 } }, // neutral gray
  { position: 0.75, color: { r: 0xE8, g: 0x94, b: 0x3A } }, // warm orange
  { position: 1.0,  color: { r: 0xFF, g: 0x6B, b: 0x1A } }, // hot orange — very wide
];

// Liquidity ratio: shallow/thin (orange) → deep/healthy (blue)
// Inverted from spread — high ratio = good = cool
const LIQUIDITY_RATIO_STOPS: ColorStop[] = [
  { position: 0.0,  color: { r: 0xFF, g: 0x6B, b: 0x1A } }, // hot orange — no liquidity
  { position: 0.25, color: { r: 0xE8, g: 0x94, b: 0x3A } }, // warm
  { position: 0.5,  color: { r: 0x8B, g: 0x95, b: 0xA5 } }, // neutral
  { position: 0.75, color: { r: 0x4A, g: 0x90, b: 0xB8 } }, // cool
  { position: 1.0,  color: { r: 0x1E, g: 0x3A, b: 0x5F } }, // deep navy — deep liquidity
];

// ── Color computation ──

function momentumToNormalized(change: number): number {
  // Clamp to ±10% range, map to 0-1
  const clamped = Math.max(-0.10, Math.min(0.10, change));
  return (clamped + 0.10) / 0.20;
}

function computeSpreadColors(markets: MarketNode[]): Map<string, string> {
  // Use 95th percentile as max to avoid outlier distortion
  const spreads = markets.map(m => m.spread).filter(s => s > 0).sort((a, b) => a - b);
  const p95 = spreads.length > 0 ? spreads[Math.floor(spreads.length * 0.95)] : 0.10;
  const maxSpread = Math.max(p95, 0.01); // floor to avoid division by zero

  const result = new Map<string, string>();
  for (const m of markets) {
    const normalized = Math.min(m.spread / maxSpread, 1);
    result.set(m.id, interpolateGradient(normalized, SPREAD_COLOR_STOPS));
  }
  return result;
}

function computeLiquidityRatioColors(markets: MarketNode[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const m of markets) {
    const ratio = m.volume > 0 ? m.liquidity / m.volume : 0;
    // Most ratios fall 0-0.5; clamp to 0-1
    const normalized = Math.min(ratio, 1);
    result.set(m.id, interpolateGradient(normalized, LIQUIDITY_RATIO_STOPS));
  }
  return result;
}

export function computeColors(markets: MarketNode[], mode: ColorMode): Map<string, string> {
  const result = new Map<string, string>();

  switch (mode) {
    case 'contestedness':
      for (const m of markets) {
        result.set(m.id, contestednessToColor(m.contestedness));
      }
      return result;

    case 'momentum':
      for (const m of markets) {
        const normalized = momentumToNormalized(m.oneDayPriceChange);
        result.set(m.id, interpolateGradient(normalized, MOMENTUM_STOPS));
      }
      return result;

    case 'category':
      for (const m of markets) {
        result.set(m.id, categoryToColor(m.category));
      }
      return result;

    case 'spread':
      return computeSpreadColors(markets);

    case 'liquidityRatio':
      return computeLiquidityRatioColors(markets);
  }
}

// ── Size computation ──

export function computeSizes(markets: MarketNode[], mode: SizeMode): Map<string, number> {
  const result = new Map<string, number>();

  switch (mode) {
    case 'volume':
      for (const m of markets) {
        result.set(m.id, Math.max(1, Math.log10(m.volume + 1) * 1.5));
      }
      return result;

    case 'liquidity':
      for (const m of markets) {
        result.set(m.id, Math.max(1, Math.log10(m.liquidity + 1) * 1.5));
      }
      return result;

    case 'activity24h':
      for (const m of markets) {
        result.set(m.id, Math.max(1, Math.log10(m.volume24hr + 1) * 1.5));
      }
      return result;

    case 'contestedness':
      for (const m of markets) {
        // Linear map: 0 → 1.5 (small), 1 → 7 (large)
        result.set(m.id, 1.5 + m.contestedness * 5.5);
      }
      return result;

    case 'spread':
      for (const m of markets) {
        // Spread values are tiny (0.001-0.1), scale up for log differentiation
        result.set(m.id, Math.max(1, Math.log10(m.spread * 10000 + 1) * 1.5));
      }
      return result;
  }
}

// ── Single-market color (for Tooltip/MarketCard accent) ──

export function computeMarketColor(market: MarketNode, mode: ColorMode, allMarkets?: MarketNode[]): string {
  switch (mode) {
    case 'contestedness':
      return contestednessToColor(market.contestedness);
    case 'momentum':
      return interpolateGradient(momentumToNormalized(market.oneDayPriceChange), MOMENTUM_STOPS);
    case 'category':
      return categoryToColor(market.category);
    case 'spread':
    case 'liquidityRatio': {
      // For population-dependent modes, compute from all markets if available
      const markets = allMarkets && allMarkets.length > 0 ? allMarkets : [market];
      const colorMap = mode === 'spread' ? computeSpreadColors(markets) : computeLiquidityRatioColors(markets);
      return colorMap.get(market.id) || '#8B95A5';
    }
  }
}

// ── Legend metadata ──

export interface LegendStop {
  label: string;
  color: string;
}

export interface ColorLegend {
  mode: ColorMode;
  label: string;
  stops: LegendStop[];
}

export function getColorLegend(mode: ColorMode): ColorLegend {
  switch (mode) {
    case 'contestedness':
      return {
        mode, label: 'Contestedness',
        stops: [
          { label: 'Consensus', color: '#1E3A5F' },
          { label: '50/50', color: '#FF6B1A' },
        ],
      };
    case 'momentum':
      return {
        mode, label: 'Momentum',
        stops: [
          { label: 'Falling', color: '#F87171' },
          { label: 'Flat', color: '#8B95A5' },
          { label: 'Rising', color: '#34D399' },
        ],
      };
    case 'category':
      return { mode, label: 'Category', stops: [] };
    case 'spread':
      return {
        mode, label: 'Spread',
        stops: [
          { label: 'Tight', color: '#1E3A5F' },
          { label: 'Wide', color: '#FF6B1A' },
        ],
      };
    case 'liquidityRatio':
      return {
        mode, label: 'Liquidity',
        stops: [
          { label: 'Shallow', color: '#FF6B1A' },
          { label: 'Deep', color: '#1E3A5F' },
        ],
      };
  }
}
