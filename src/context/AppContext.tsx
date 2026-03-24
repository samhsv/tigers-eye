import {
  useReducer,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { AppState, AppAction, GalaxyViewHandle } from '../types';
import { fetchMarkets, buildGraphData } from '../lib/polymarket';
import { computeEventLinks } from '../lib/clustering';
import { streamAIResponse, MODELS, PROMPTS, buildMarketAnalysisMessage } from '../lib/ai';
import { AppContext } from './AppContextDef';

// ── Initial state ──
const initialState: AppState = {
  markets: [],
  graphData: { nodes: [], links: [] },
  activeCluster: 'category',
  activeColorMode: 'contestedness',
  activeSizeMode: 'volume',
  selectedMarket: null,
  hoveredMarket: null,
  feedPanelOpen: true,
  mispricedData: null,
  mispricedLoading: false,
  mispricedCooldownUntil: null,
  aiTake: '',
  aiTakeLoading: false,
  dataLoaded: false,
  dataError: null,
};

// ── Reducer ──
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_MARKETS':
      return {
        ...state,
        markets: action.payload.markets,
        graphData: action.payload.graphData,
      };
    case 'SELECT_MARKET':
      return {
        ...state,
        selectedMarket: action.payload,
        aiTake: '',
        aiTakeLoading: action.payload !== null,
      };
    case 'HOVER_MARKET':
      return { ...state, hoveredMarket: action.payload };
    case 'TOGGLE_FEED_PANEL':
      return { ...state, feedPanelOpen: !state.feedPanelOpen };
    case 'SET_MISPRICED':
      return { ...state, mispricedData: action.payload, mispricedLoading: false };
    case 'SET_MISPRICED_LOADING':
      return { ...state, mispricedLoading: action.payload };
    case 'SET_MISPRICED_COOLDOWN':
      return { ...state, mispricedCooldownUntil: action.payload };
    case 'APPEND_AI_TAKE':
      return { ...state, aiTake: state.aiTake + action.payload };
    case 'RESET_AI_TAKE':
      return { ...state, aiTake: '', aiTakeLoading: false };
    case 'SET_AI_TAKE_LOADING':
      return { ...state, aiTakeLoading: action.payload };
    case 'SET_DATA_LOADED':
      return { ...state, dataLoaded: true };
    case 'SET_DATA_ERROR':
      return { ...state, dataError: action.payload };
    case 'SET_CLUSTER_MODE':
      return { ...state, activeCluster: action.payload };
    case 'SET_GRAPH_LINKS':
      if (action.payload.length === 0 && state.graphData.links.length === 0) return state;
      return { ...state, graphData: { nodes: state.graphData.nodes, links: action.payload } };
    case 'SET_COLOR_MODE':
      return { ...state, activeColorMode: action.payload };
    case 'SET_SIZE_MODE':
      return { ...state, activeSizeMode: action.payload };
    default:
      return state;
  }
}

// ── Provider ──
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const galaxyHandleRef = useRef<GalaxyViewHandle | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);

  // Fetch markets on mount
  useEffect(() => {
    fetchMarkets()
      .then(markets => {
        const graphData = buildGraphData(markets);
        dispatch({ type: 'SET_MARKETS', payload: { markets, graphData } });
        dispatch({ type: 'SET_DATA_LOADED' });
      })
      .catch((err: Error) => {
        console.error('Failed to fetch markets:', err);
        dispatch({ type: 'SET_DATA_ERROR', payload: err.message });
        dispatch({ type: 'SET_DATA_LOADED' });
      });
  }, []);

  // Stream AI analysis when a market is selected
  useEffect(() => {
    if (!state.selectedMarket) return;

    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;

    const market = state.selectedMarket;

    streamAIResponse({
      model: MODELS.NANO,
      messages: [
        { role: 'system', content: PROMPTS.MARKET_ANALYSIS },
        { role: 'user', content: buildMarketAnalysisMessage(market) },
      ],
      maxTokens: 1000,
      temperature: 0.8,
      onChunk: (text) => dispatch({ type: 'APPEND_AI_TAKE', payload: text }),
      onDone: () => dispatch({ type: 'SET_AI_TAKE_LOADING', payload: false }),
      onError: (err) => {
        console.error('AI stream error:', err);
        dispatch({ type: 'SET_AI_TAKE_LOADING', payload: false });
      },
      signal: controller.signal,
    });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedMarket?.id]);

  // Update graph links based on cluster mode
  useEffect(() => {
    if (!state.markets.length) return;
    const links = state.activeCluster === 'event'
      ? computeEventLinks(state.markets)
      : [];
    dispatch({ type: 'SET_GRAPH_LINKS', payload: links });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeCluster, state.markets]);

  const setGalaxyRef = useCallback((handle: GalaxyViewHandle | null) => {
    galaxyHandleRef.current = handle;
  }, []);

  const flyToNode = useCallback(
    (nodeId: string) => {
      const market = state.markets.find(m => m.id === nodeId);
      if (!market) return;

      galaxyHandleRef.current?.flyToNode(nodeId);
      dispatch({ type: 'SELECT_MARKET', payload: market });
    },
    [state.markets],
  );

  return (
    <AppContext.Provider value={{ state, dispatch, flyToNode, setGalaxyRef }}>
      {children}
    </AppContext.Provider>
  );
}
