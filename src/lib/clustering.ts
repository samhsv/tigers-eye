import type { MarketNode, ClusterCenter, GraphLink, ClusterMode } from '../types';

export interface ClusterConfig {
  centers: Record<string, ClusterCenter>;
  assignments: Map<string, string>;
  labels: { key: string; label: string; position: ClusterCenter; color?: string }[];
}

export function getClusterConfig(mode: ClusterMode, markets: MarketNode[]): ClusterConfig {
  switch (mode) {
    case 'category': return clusterByCategory(markets);
    case 'contestedness': return clusterByContestedness(markets);
    case 'timeHorizon': return clusterByTimeHorizon(markets);
    case 'momentum': return clusterByMomentum(markets);
    case 'volumeTier': return clusterByVolumeTier(markets);
    case 'event': return clusterByEvent(markets);
  }
}

export function computeEventLinks(markets: MarketNode[]): GraphLink[] {
  const groups = new Map<string, string[]>();
  for (const m of markets) {
    const ids = groups.get(m.eventId) || [];
    ids.push(m.id);
    groups.set(m.eventId, ids);
  }
  const links: GraphLink[] = [];
  for (const [, ids] of groups) {
    if (ids.length < 2) continue;
    // Chain links: 0→1, 1→2, etc. (constellation pattern)
    for (let i = 0; i < ids.length - 1; i++) {
      links.push({ source: ids[i], target: ids[i + 1] });
    }
  }
  return links;
}

// ── Category clustering (ring layout) ──

function clusterByCategory(markets: MarketNode[]): ClusterConfig {
  const categories = [...new Set(markets.map(m => m.category))];
  const radius = 300;
  const centers: Record<string, ClusterCenter> = {};
  const assignments = new Map<string, string>();

  categories.forEach((cat, i) => {
    const angle = (i / categories.length) * Math.PI * 2;
    centers[cat] = {
      x: Math.cos(angle) * radius,
      y: ((i * 137.508) % 100) - 50,
      z: Math.sin(angle) * radius,
    };
  });

  for (const m of markets) {
    assignments.set(m.id, m.category);
  }

  return {
    centers,
    assignments,
    labels: categories.map(cat => ({
      key: cat,
      label: cat.toUpperCase(),
      position: { ...centers[cat], y: centers[cat].y + 50 },
    })),
  };
}

// ── Contestedness spectrum (linear layout) ──

function clusterByContestedness(markets: MarketNode[]): ClusterConfig {
  const groups = [
    { key: 'locked', label: 'LOCKED IN', min: 0, max: 0.2, x: -400, color: '#1E3A5F' },
    { key: 'likely', label: 'LIKELY', min: 0.2, max: 0.4, x: -200, color: '#4A90B8' },
    { key: 'leaning', label: 'LEANING', min: 0.4, max: 0.6, x: 0, color: '#8B95A5' },
    { key: 'contested', label: 'CONTESTED', min: 0.6, max: 0.8, x: 200, color: '#E8943A' },
    { key: 'coinflip', label: 'COIN FLIP', min: 0.8, max: 1.01, x: 400, color: '#FF6B1A' },
  ];

  const centers: Record<string, ClusterCenter> = {};
  const assignments = new Map<string, string>();

  for (const g of groups) {
    centers[g.key] = { x: g.x, y: 0, z: 0 };
  }

  for (const m of markets) {
    const group = groups.find(g => m.contestedness >= g.min && m.contestedness < g.max)
      || groups[groups.length - 1];
    assignments.set(m.id, group.key);
  }

  return {
    centers,
    assignments,
    labels: groups.map(g => ({
      key: g.key,
      label: g.label,
      position: { x: g.x, y: 60, z: 0 },
      color: g.color,
    })),
  };
}

// ── Time horizon (ring layout by resolution date) ──

function clusterByTimeHorizon(markets: MarketNode[]): ClusterConfig {
  const now = Date.now();
  const DAY = 86_400_000;
  const groups = [
    { key: 'week', label: 'THIS WEEK', maxDays: 7 },
    { key: 'month', label: 'THIS MONTH', maxDays: 30 },
    { key: 'quarter', label: 'THIS QUARTER', maxDays: 90 },
    { key: 'year', label: 'THIS YEAR', maxDays: 365 },
    { key: 'beyond', label: 'BEYOND', maxDays: Infinity },
  ];

  const radius = 300;
  const centers: Record<string, ClusterCenter> = {};
  groups.forEach((g, i) => {
    const angle = (i / groups.length) * Math.PI * 2;
    centers[g.key] = {
      x: Math.cos(angle) * radius,
      y: 0,
      z: Math.sin(angle) * radius,
    };
  });

  const assignments = new Map<string, string>();
  for (const m of markets) {
    const diffDays = Math.max(0, (new Date(m.endDate).getTime() - now) / DAY);
    const group = groups.find(g => diffDays <= g.maxDays) || groups[groups.length - 1];
    assignments.set(m.id, group.key);
  }

  return {
    centers,
    assignments,
    labels: groups.map(g => ({
      key: g.key,
      label: g.label,
      position: { ...centers[g.key], y: 50 },
    })),
  };
}

// ── Momentum (linear layout by 24h price change) ──

function clusterByMomentum(markets: MarketNode[]): ClusterConfig {
  const groups = [
    { key: 'crashing', label: 'CRASHING', min: -Infinity, max: -0.05, x: -400, color: '#F87171' },
    { key: 'falling', label: 'FALLING', min: -0.05, max: -0.01, x: -200, color: '#F87171' },
    { key: 'stable', label: 'STABLE', min: -0.01, max: 0.01, x: 0, color: '#8B95A5' },
    { key: 'rising', label: 'RISING', min: 0.01, max: 0.05, x: 200, color: '#34D399' },
    { key: 'surging', label: 'SURGING', min: 0.05, max: Infinity, x: 400, color: '#34D399' },
  ];

  const centers: Record<string, ClusterCenter> = {};
  const assignments = new Map<string, string>();

  for (const g of groups) {
    centers[g.key] = { x: g.x, y: 0, z: 0 };
  }

  for (const m of markets) {
    const change = m.oneDayPriceChange;
    const group = groups.find(g => change >= g.min && change < g.max) || groups[2];
    assignments.set(m.id, group.key);
  }

  return {
    centers,
    assignments,
    labels: groups.map(g => ({
      key: g.key,
      label: g.label,
      position: { x: g.x, y: 60, z: 0 },
      color: g.color,
    })),
  };
}

// ── Volume tier (triangle layout) ──

function clusterByVolumeTier(markets: MarketNode[]): ClusterConfig {
  const tiers = [
    { key: 'whale', label: 'WHALE MARKETS', min: 1_000_000, center: { x: 0, y: 150, z: -100 }, color: '#FFB84D' },
    { key: 'midcap', label: 'MID-CAP', min: 100_000, center: { x: -280, y: -50, z: 100 }, color: '#8B95A5' },
    { key: 'small', label: 'SMALL MARKETS', min: 0, center: { x: 280, y: -50, z: 100 }, color: '#4A90B8' },
  ];

  const centers: Record<string, ClusterCenter> = {};
  const assignments = new Map<string, string>();

  for (const t of tiers) {
    centers[t.key] = t.center;
  }

  for (const m of markets) {
    if (m.volume >= 1_000_000) assignments.set(m.id, 'whale');
    else if (m.volume >= 100_000) assignments.set(m.id, 'midcap');
    else assignments.set(m.id, 'small');
  }

  return {
    centers,
    assignments,
    labels: tiers.map(t => ({
      key: t.key,
      label: t.label,
      position: { ...t.center, y: t.center.y + 60 },
      color: t.color,
    })),
  };
}

// ── Event constellation (ring layout, grouped by parent event) ──

function clusterByEvent(markets: MarketNode[]): ClusterConfig {
  const eventGroups = new Map<string, { title: string; markets: MarketNode[] }>();
  for (const m of markets) {
    const existing = eventGroups.get(m.eventId);
    if (existing) {
      existing.markets.push(m);
    } else {
      eventGroups.set(m.eventId, { title: m.eventTitle, markets: [m] });
    }
  }

  // Separate multi-market events from standalone markets
  const multiEvents: { eventId: string; title: string; markets: MarketNode[] }[] = [];
  const singletons: MarketNode[] = [];

  for (const [eventId, group] of eventGroups) {
    if (group.markets.length >= 2) {
      multiEvents.push({ eventId, title: group.title, markets: group.markets });
    } else {
      singletons.push(...group.markets);
    }
  }

  // Sort by total volume so the biggest events get prime positions
  multiEvents.sort((a, b) => {
    const volA = a.markets.reduce((sum, m) => sum + m.volume, 0);
    const volB = b.markets.reduce((sum, m) => sum + m.volume, 0);
    return volB - volA;
  });

  const clusterKeys = [
    ...multiEvents.map(e => e.eventId),
    ...(singletons.length > 0 ? ['_standalone'] : []),
  ];

  const radius = 400;
  const centers: Record<string, ClusterCenter> = {};
  clusterKeys.forEach((key, i) => {
    const angle = (i / clusterKeys.length) * Math.PI * 2;
    centers[key] = {
      x: Math.cos(angle) * radius,
      y: ((i * 137.508) % 120) - 60,
      z: Math.sin(angle) * radius,
    };
  });

  const assignments = new Map<string, string>();
  for (const e of multiEvents) {
    for (const m of e.markets) {
      assignments.set(m.id, e.eventId);
    }
  }
  for (const m of singletons) {
    assignments.set(m.id, '_standalone');
  }

  // Labels only for events with 3+ markets to avoid clutter
  const labels = multiEvents
    .filter(e => e.markets.length >= 3)
    .slice(0, 12)
    .map(e => ({
      key: e.eventId,
      label: e.title.toUpperCase().slice(0, 25),
      position: { ...centers[e.eventId], y: centers[e.eventId].y + 50 },
    }));

  if (singletons.length > 0 && centers['_standalone']) {
    labels.push({
      key: '_standalone',
      label: 'STANDALONE',
      position: { ...centers['_standalone'], y: centers['_standalone'].y + 50 },
    });
  }

  return { centers, assignments, labels };
}
