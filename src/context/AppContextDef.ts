import { createContext } from 'react';
import type { AppState, AppAction, GalaxyViewHandle } from '../types';

export interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  flyToNode: (nodeId: string) => void;
  setGalaxyRef: (handle: GalaxyViewHandle | null) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);
