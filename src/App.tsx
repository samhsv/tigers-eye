import { useRef } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import GalaxyView from './components/GalaxyView';
import LoadingScreen from './components/LoadingScreen';
import Tooltip from './components/Tooltip';
import MarketCard from './components/MarketCard';
import FeedPanel from './components/FeedPanel';
import type { GalaxyViewHandle } from './types';

function AppContent() {
  const { galaxyRef } = useApp();
  const localRef = useRef<GalaxyViewHandle>(null);

  // Sync the local ref to the context galaxyRef
  const setRef = (handle: GalaxyViewHandle | null) => {
    (localRef as React.MutableRefObject<GalaxyViewHandle | null>).current = handle;
    (galaxyRef as React.MutableRefObject<GalaxyViewHandle | null>).current = handle;
  };

  return (
    <>
      <GalaxyView ref={setRef} />
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
