import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/useApp';
import type { ClusterMode, ColorMode, SizeMode } from '../types';

// ── Cluster lenses ──

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

// ── Color / Size mode options ──

interface ModeOption<T extends string> {
  mode: T;
  label: string;
}

const COLOR_MODES: ModeOption<ColorMode>[] = [
  { mode: 'contestedness', label: 'Odds Heat' },
  { mode: 'momentum', label: 'Momentum' },
  { mode: 'category', label: 'Category' },
  { mode: 'spread', label: 'Spread' },
  { mode: 'liquidityRatio', label: 'Liquidity' },
];

const SIZE_MODES: ModeOption<SizeMode>[] = [
  { mode: 'volume', label: 'Volume' },
  { mode: 'liquidity', label: 'Liquidity' },
  { mode: 'activity24h', label: '24h Activity' },
  { mode: 'contestedness', label: 'Odds Heat' },
  { mode: 'spread', label: 'Spread' },
];

// ── Dropdown selector ──

function ModeSelector<T extends string>({
  label,
  icon,
  options,
  active,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  options: ModeOption<T>[];
  active: T;
  onChange: (mode: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeLabel = options.find(o => o.mode === active)?.label || active;

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, handleClickOutside]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium tracking-wide transition-all whitespace-nowrap ${
          open
            ? 'bg-white/[0.10] text-text-primary'
            : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.06]'
        }`}
      >
        {icon}
        <span className="text-text-secondary/70">{label}</span>
        <span className="text-text-primary">{activeLabel}</span>
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2.5 4L5 6.5L7.5 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 glass-panel rounded-xl py-1.5 min-w-[140px] z-50">
          {options.map(opt => (
            <button
              key={opt.mode}
              onClick={() => { onChange(opt.mode); setOpen(false); }}
              className={`w-full text-left px-4 py-2 text-[11px] font-medium tracking-wide transition-colors ${
                opt.mode === active
                  ? 'text-auburn-glow bg-auburn-orange/15'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.06]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ──

export default function LensBar() {
  const { state, dispatch } = useApp();

  if (!state.dataLoaded) return null;

  return (
    <div className="fixed bottom-24 lg:bottom-6 z-20 left-0 right-0 lg:right-[380px] flex justify-center pointer-events-none">
      <div className="pointer-events-auto flex flex-col items-center gap-2">
        {/* Color / Size selectors */}
        <div className="glass-panel rounded-xl px-2 py-1.5 flex gap-1">
          <ModeSelector
            label="Color:"
            icon={
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" opacity="0.6">
                <circle cx="6" cy="6" r="4" />
              </svg>
            }
            options={COLOR_MODES}
            active={state.activeColorMode}
            onChange={(mode) => dispatch({ type: 'SET_COLOR_MODE', payload: mode })}
          />
          <div className="w-px bg-white/[0.08] my-1" />
          <ModeSelector
            label="Size:"
            icon={
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" opacity="0.6">
                <circle cx="4" cy="8" r="2" />
                <circle cx="9" cy="5" r="3" />
              </svg>
            }
            options={SIZE_MODES}
            active={state.activeSizeMode}
            onChange={(mode) => dispatch({ type: 'SET_SIZE_MODE', payload: mode })}
          />
        </div>

        {/* Cluster buttons */}
        <div className="glass-panel rounded-2xl px-1.5 py-1.5 flex gap-1 max-w-[calc(100vw-2rem)] overflow-x-auto">
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
    </div>
  );
}
