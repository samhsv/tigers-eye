import { useCallback } from 'react';
import { AppProvider } from './context/AppContext';
import { useApp } from './context/useApp';
import GalaxyView from './components/GalaxyView';
import LoadingScreen from './components/LoadingScreen';
import Tooltip from './components/Tooltip';
import MarketCard from './components/MarketCard';
import FeedPanel from './components/FeedPanel';
import type { GalaxyViewHandle } from './types';

function AppContent() {
  const { state, setGalaxyRef } = useApp();

  const handleRef = useCallback(
    (handle: GalaxyViewHandle | null) => {
      setGalaxyRef(handle);
    },
    [setGalaxyRef],
  );

  return (
    <>
      <GalaxyView ref={handleRef} />
      <LoadingScreen />
      <Tooltip />
      <MarketCard />
      <FeedPanel />
      {/* Persistent branding watermark */}
      {state.dataLoaded && !state.selectedMarket && (
        <div className="fixed bottom-5 left-5 z-10 pointer-events-none">
          <span className="text-[13px] font-semibold tracking-tight text-text-primary/20 font-display">
            TIGER&apos;S EYE
          </span>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
