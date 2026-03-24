import { useApp } from '../context/useApp';
import type { ClusterMode } from '../types';

interface LensOption {
  mode: ClusterMode;
  label: string;
  icon: React.ReactNode;
}

const LENSES: LensOption[] = [
  {
    mode: 'category',
    label: 'Topic',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <circle cx="4" cy="4" r="1.8" /><circle cx="10" cy="4" r="1.8" />
        <circle cx="4" cy="10" r="1.8" /><circle cx="10" cy="10" r="1.8" />
      </svg>
    ),
  },
  {
    mode: 'contestedness',
    label: 'Odds',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <rect x="1" y="5.5" width="12" height="3" rx="1.5" opacity="0.3" />
        <circle cx="9" cy="7" r="2" />
      </svg>
    ),
  },
  {
    mode: 'timeHorizon',
    label: 'Timeline',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="7" cy="7" r="5" />
        <path d="M7 4.5V7l2 1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    mode: 'momentum',
    label: 'Momentum',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2 10L7 4l5 6" />
      </svg>
    ),
  },
  {
    mode: 'volumeTier',
    label: 'Volume',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <rect x="1" y="8" width="3" height="5" rx="0.5" />
        <rect x="5.5" y="4" width="3" height="9" rx="0.5" />
        <rect x="10" y="1" width="3" height="12" rx="0.5" />
      </svg>
    ),
  },
  {
    mode: 'event',
    label: 'Events',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14">
        <circle cx="3" cy="3" r="1.5" fill="currentColor" />
        <circle cx="11" cy="3" r="1.5" fill="currentColor" />
        <circle cx="7" cy="11" r="1.5" fill="currentColor" />
        <line x1="3" y1="3" x2="11" y2="3" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        <line x1="3" y1="3" x2="7" y2="11" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        <line x1="11" y1="3" x2="7" y2="11" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      </svg>
    ),
  },
];

export default function LensBar() {
  const { state, dispatch } = useApp();

  if (!state.dataLoaded) return null;

  return (
    <div className="fixed bottom-24 lg:bottom-6 z-20 left-0 right-0 lg:right-[380px] flex justify-center pointer-events-none">
      <div className="pointer-events-auto glass-panel rounded-2xl px-1.5 py-1.5 flex gap-1 max-w-[calc(100vw-2rem)] overflow-x-auto">
        {LENSES.map(lens => (
          <button
            key={lens.mode}
            onClick={() => dispatch({ type: 'SET_CLUSTER_MODE', payload: lens.mode })}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium tracking-wide transition-all whitespace-nowrap ${
              state.activeCluster === lens.mode
                ? 'bg-auburn-orange/20 text-auburn-glow'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.06]'
            }`}
          >
            {lens.icon}
            <span>{lens.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
