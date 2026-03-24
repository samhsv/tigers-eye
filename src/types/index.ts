// ── Raw API response types (what Polymarket actually sends) ──

export interface RawTag {
  id: string;
  label: string;
  slug: string;
}

export interface RawMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  endDate: string;
  description: string;
  outcomes: string; // JSON-encoded string: "[\"Yes\", \"No\"]" — must JSON.parse
  outcomePrices: string; // JSON-encoded string: "[\"0.85\", \"0.15\"]" — must JSON.parse then parseFloat
  volume: string;
  active: boolean;
  closed: boolean;
  volumeNum: number;
  liquidityNum: number;
  liquidity: string;
  volume24hr: number;
  volume1wk: number;
  volume1mo: number;
  clobTokenIds: string[];
  spread: number;
  oneDayPriceChange: number;
  oneHourPriceChange: number;
  oneWeekPriceChange: number;
  lastTradePrice: number;
  bestBid: number;
  bestAsk: number;
  image: string;
  groupItemTitle: string;
}

export interface RawEvent {
  id: string;
  ticker: string;
  slug: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  image: string;
  active: boolean;
  closed: boolean;
  liquidity: number;
  volume: number;
  competitive: number;
  volume24hr: number;
  volume1wk: number;
  markets: RawMarket[];
  tags: RawTag[];
}

// ── Normalized app types ──

export interface MarketNode {
  id: string;
  question: string;
  slug: string;
  conditionId: string;
  eventId: string;
  eventTitle: string;
  category: string;
  outcomePrices: { yes: number; no: number };
  outcomes: string[];
  volume: number;
  liquidity: number;
  volume24hr: number;
  volume1wk: number;
  oneDayPriceChange: number;
  oneWeekPriceChange: number;
  lastTradePrice: number;
  bestBid: number;
  bestAsk: number;
  spread: number;
  endDate: string;
  contestedness: number;
  orbSize: number;
  orbColor: string;
  pulseSpeed: number;
  clobTokenIds: string[];
  image: string;
}

// ── Graph types for react-force-graph-3d ──

export interface GraphNode extends MarketNode {
  group: string;
  val: number;
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  __threeObj?: THREE.Object3D & { userData: NodeUserData };
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface NodeUserData {
  glow: THREE.Mesh;
  coreMat: THREE.MeshBasicMaterial;
  glowMat: THREE.MeshBasicMaterial;
  baseRadius: number;
  pulseSpeed: number;
}

export interface ClusterCenter {
  x: number;
  y: number;
  z: number;
}

export type ClusterMode = 'category' | 'contestedness' | 'timeHorizon' | 'momentum' | 'volumeTier' | 'event';

// ── AI types ──

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIStreamOptions {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
}

export interface MispricedPick {
  marketId: string;
  question: string;
  currentPrice: number;
  fairPrice: number;
  direction: 'OVER' | 'UNDER';
  reasoning: string;
}

export interface MispricedResponse {
  picks: MispricedPick[];
}

// ── App state ──

export interface AppState {
  markets: MarketNode[];
  graphData: GraphData;
  activeCluster: ClusterMode;
  selectedMarket: MarketNode | null;
  hoveredMarket: MarketNode | null;
  feedPanelOpen: boolean;
  mispricedData: MispricedPick[] | null;
  mispricedLoading: boolean;
  mispricedCooldownUntil: number | null;
  aiTake: string;
  aiTakeLoading: boolean;
  dataLoaded: boolean;
  dataError: string | null;
}

export type AppAction =
  | { type: 'SET_MARKETS'; payload: { markets: MarketNode[]; graphData: GraphData } }
  | { type: 'SELECT_MARKET'; payload: MarketNode | null }
  | { type: 'HOVER_MARKET'; payload: MarketNode | null }
  | { type: 'TOGGLE_FEED_PANEL' }
  | { type: 'SET_MISPRICED'; payload: MispricedPick[] }
  | { type: 'SET_MISPRICED_LOADING'; payload: boolean }
  | { type: 'SET_MISPRICED_COOLDOWN'; payload: number }
  | { type: 'APPEND_AI_TAKE'; payload: string }
  | { type: 'RESET_AI_TAKE' }
  | { type: 'SET_AI_TAKE_LOADING'; payload: boolean }
  | { type: 'SET_DATA_LOADED' }
  | { type: 'SET_DATA_ERROR'; payload: string }
  | { type: 'SET_CLUSTER_MODE'; payload: ClusterMode }
  | { type: 'SET_GRAPH_LINKS'; payload: GraphLink[] };

// ── Galaxy view ref ──

export interface GalaxyViewHandle {
  flyToNode: (nodeId: string) => void;
}

// THREE.js namespace import for type references
import type * as THREE from 'three';
