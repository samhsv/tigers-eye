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
  const { setGalaxyRef } = useApp();

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
