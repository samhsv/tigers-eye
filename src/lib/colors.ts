// Maps contestedness (0-1) to Auburn-inspired color gradient
// 0 = consensus (deep navy) → 1 = contested 50/50 (Auburn orange glow)

interface RGB { r: number; g: number; b: number }

const COLOR_STOPS: { position: number; color: RGB }[] = [
  { position: 0.0,  color: { r: 0x1E, g: 0x3A, b: 0x5F } }, // consensus-cold
  { position: 0.25, color: { r: 0x4A, g: 0x90, b: 0xB8 } }, // consensus-cool
  { position: 0.5,  color: { r: 0x8B, g: 0x95, b: 0xA5 } }, // neutral
  { position: 0.75, color: { r: 0xE8, g: 0x94, b: 0x3A } }, // contested-warm
  { position: 1.0,  color: { r: 0xFF, g: 0x6B, b: 0x1A } }, // contested-hot
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function contestednessToColor(contestedness: number): string {
  const t = Math.max(0, Math.min(1, contestedness));

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const lower = COLOR_STOPS[i];
    const upper = COLOR_STOPS[i + 1];

    if (t >= lower.position && t <= upper.position) {
      const segmentT = (t - lower.position) / (upper.position - lower.position);
      return rgbToHex(
        lerp(lower.color.r, upper.color.r, segmentT),
        lerp(lower.color.g, upper.color.g, segmentT),
        lerp(lower.color.b, upper.color.b, segmentT),
      );
    }
  }

  return '#FF6B1A';
}

const CATEGORY_COLORS: Record<string, string> = {
  'Politics': '#E85D3A',
  'Crypto': '#F0B90B',
  'Sports': '#4CAF50',
  'Pop Culture': '#E040FB',
  'Science': '#00BCD4',
  'Business': '#FF9800',
  'Finance': '#8BC34A',
  'Technology': '#2196F3',
  'World': '#9C27B0',
  'Entertainment': '#FF4081',
  'Climate': '#009688',
  'AI': '#7C4DFF',
  'Elections': '#F44336',
  'Other': '#8B95A5',
};

export function categoryToColor(category: string): string {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS['Other'];
}

export const COLORS = {
  BG_PRIMARY: '#0A0E1A',
  BG_SECONDARY: '#111827',
  BG_CARD: '#1A1F2E',
  AUBURN_ORANGE: '#DD550C',
  AUBURN_GLOW: '#FF6B1A',
  AUBURN_NAVY: '#0C2340',
  TEXT_PRIMARY: '#E8ECF1',
  TEXT_SECONDARY: '#8B95A5',
  TEXT_ACCENT: '#FF6B1A',
  TEXT_DATA: '#A0F0C0',
  AI_ACCENT: '#FFB84D',
} as const;
