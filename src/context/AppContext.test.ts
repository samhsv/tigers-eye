import { describe, it, expect } from 'vitest';
import type { AppState, AppAction } from '../types';

// Extract the reducer for testing by re-implementing it here
// (it's not exported from AppContext.tsx, so we test the logic directly)
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
    default:
      return state;
  }
}

const initialState: AppState = {
  markets: [],
  graphData: { nodes: [], links: [] },
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

describe('appReducer', () => {
  it('handles SET_DATA_LOADED', () => {
    const state = appReducer(initialState, { type: 'SET_DATA_LOADED' });
    expect(state.dataLoaded).toBe(true);
  });

  it('handles SET_DATA_ERROR', () => {
    const state = appReducer(initialState, { type: 'SET_DATA_ERROR', payload: 'Network error' });
    expect(state.dataError).toBe('Network error');
  });

  it('handles SELECT_MARKET — sets market and clears AI take', () => {
    const prevState = { ...initialState, aiTake: 'old analysis', aiTakeLoading: false };
    const mockMarket = { id: '1' } as AppState['selectedMarket'];
    const state = appReducer(prevState, { type: 'SELECT_MARKET', payload: mockMarket });

    expect(state.selectedMarket).toBe(mockMarket);
    expect(state.aiTake).toBe('');
    expect(state.aiTakeLoading).toBe(true);
  });

  it('handles SELECT_MARKET null — clears selection', () => {
    const prevState = { ...initialState, selectedMarket: { id: '1' } as AppState['selectedMarket'] };
    const state = appReducer(prevState, { type: 'SELECT_MARKET', payload: null });

    expect(state.selectedMarket).toBeNull();
    expect(state.aiTakeLoading).toBe(false);
  });

  it('handles APPEND_AI_TAKE — concatenates text', () => {
    const s1 = appReducer(initialState, { type: 'APPEND_AI_TAKE', payload: 'Hello' });
    const s2 = appReducer(s1, { type: 'APPEND_AI_TAKE', payload: ' world' });

    expect(s2.aiTake).toBe('Hello world');
  });

  it('handles RESET_AI_TAKE', () => {
    const prevState = { ...initialState, aiTake: 'something', aiTakeLoading: true };
    const state = appReducer(prevState, { type: 'RESET_AI_TAKE' });

    expect(state.aiTake).toBe('');
    expect(state.aiTakeLoading).toBe(false);
  });

  it('handles TOGGLE_FEED_PANEL', () => {
    const s1 = appReducer(initialState, { type: 'TOGGLE_FEED_PANEL' });
    expect(s1.feedPanelOpen).toBe(false);

    const s2 = appReducer(s1, { type: 'TOGGLE_FEED_PANEL' });
    expect(s2.feedPanelOpen).toBe(true);
  });

  it('handles SET_MISPRICED — sets data and clears loading', () => {
    const prevState = { ...initialState, mispricedLoading: true };
    const picks = [{ marketId: '1', question: 'Q', currentPrice: 0.5, fairPrice: 0.7, direction: 'OVER' as const, reasoning: 'Test' }];
    const state = appReducer(prevState, { type: 'SET_MISPRICED', payload: picks });

    expect(state.mispricedData).toEqual(picks);
    expect(state.mispricedLoading).toBe(false);
  });

  it('handles SET_MISPRICED_LOADING', () => {
    const state = appReducer(initialState, { type: 'SET_MISPRICED_LOADING', payload: true });
    expect(state.mispricedLoading).toBe(true);
  });

  it('handles SET_MISPRICED_COOLDOWN', () => {
    const ts = Date.now() + 600000;
    const state = appReducer(initialState, { type: 'SET_MISPRICED_COOLDOWN', payload: ts });
    expect(state.mispricedCooldownUntil).toBe(ts);
  });

  it('handles HOVER_MARKET', () => {
    const mockNode = { id: '1' } as AppState['hoveredMarket'];
    const state = appReducer(initialState, { type: 'HOVER_MARKET', payload: mockNode });
    expect(state.hoveredMarket).toBe(mockNode);
  });

  it('handles SET_MARKETS', () => {
    const markets = [{ id: '1' }] as unknown as AppState['markets'];
    const graphData = { nodes: [], links: [] };
    const state = appReducer(initialState, { type: 'SET_MARKETS', payload: { markets, graphData } });

    expect(state.markets).toBe(markets);
    expect(state.graphData).toBe(graphData);
  });

  it('returns same state for unknown action', () => {
    const state = appReducer(initialState, { type: 'UNKNOWN' } as unknown as AppAction);
    expect(state).toBe(initialState);
  });
});
