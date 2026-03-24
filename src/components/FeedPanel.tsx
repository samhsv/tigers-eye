import { useMemo } from 'react';
import { useApp } from '../context/useApp';
import {
  getBiggestMovers,
  getHighestVolume,
  getMostActive,
  getClosestCalls,
} from '../lib/polymarket';
import { priceToPercent, formatDollar, formatPriceChange } from '../lib/format';
import MispricedPanel from './MispricedPanel';
import type { MarketNode } from '../types';

function FeedItem({
  market,
  rightContent,
  onClick,
}: {
  market: MarketNode;
  rightContent: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left px-3 py-2.5 hover:bg-white/[0.04] rounded-lg transition-all duration-150 flex items-center justify-between gap-3"
    >
      <span className="text-[13px] text-text-primary/90 leading-snug flex-1 min-w-0 line-clamp-2 group-hover:text-text-primary transition-colors">
        {market.question}
      </span>
      <span className="text-xs font-mono shrink-0 tabular-nums">{rightContent}</span>
    </button>
  );
}

function FeedSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 px-5 py-2.5">
        <span className="text-sm">{icon}</span>
        <span className="text-[11px] uppercase tracking-wider text-text-secondary font-semibold">
          {title}
        </span>
        <div className="flex-1 h-px bg-white/[0.04]" />
      </div>
      <div className="px-2">{children}</div>
    </div>
  );
}

export default function FeedPanel() {
  const { state, dispatch, flyToNode } = useApp();

  const feeds = useMemo(() => {
    if (!state.markets.length) return null;
    return {
      movers: getBiggestMovers(state.markets),
      volume: getHighestVolume(state.markets),
      active: getMostActive(state.markets),
      closest: getClosestCalls(state.markets),
    };
  }, [state.markets]);

  if (!state.dataLoaded || !feeds) return null;

  return (
    <>
      {/* Mobile toggle FAB */}
      <button
        className="fixed bottom-6 right-6 z-30 lg:hidden w-14 h-14 rounded-full glass-panel text-white flex items-center justify-center shadow-lg"
        style={{ animation: 'pulse-glow 2s ease-in-out infinite' }}
        onClick={() => dispatch({ type: 'TOGGLE_FEED_PANEL' })}
      >
        <svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor">
          <rect x="2" y="4" width="16" height="2" rx="1" />
          <rect x="2" y="9" width="16" height="2" rx="1" />
          <rect x="2" y="14" width="16" height="2" rx="1" />
        </svg>
      </button>

      {/* Mobile backdrop */}
      {state.feedPanelOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={() => dispatch({ type: 'TOGGLE_FEED_PANEL' })}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-20 h-full w-[340px] glass-panel border-l border-white/[0.06] overflow-y-auto transition-transform duration-300
          ${state.feedPanelOpen ? 'translate-x-0' : 'translate-x-full'}
          lg:translate-x-0 lg:rounded-none`}
      >
        {/* Header */}
        <div className="px-5 pt-6 pb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-primary tracking-tight">
              Market Feed
            </h2>
            <p className="text-[11px] text-text-secondary mt-0.5">
              {state.markets.length} live markets
            </p>
          </div>
          <button
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.08] transition-colors text-text-secondary hover:text-text-primary"
            onClick={() => dispatch({ type: 'TOGGLE_FEED_PANEL' })}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Biggest Movers */}
        <FeedSection title="Biggest Movers" icon="🔥">
          {feeds.movers.map(m => (
            <FeedItem
              key={m.id}
              market={m}
              onClick={() => flyToNode(m.id)}
              rightContent={
                <span
                  className={
                    m.oneDayPriceChange > 0
                      ? 'text-yes-green'
                      : m.oneDayPriceChange < 0
                        ? 'text-no-red'
                        : 'text-text-secondary'
                  }
                >
                  {formatPriceChange(m.oneDayPriceChange)}
                </span>
              }
            />
          ))}
        </FeedSection>

        {/* Highest Stakes */}
        <FeedSection title="Highest Stakes" icon="💰">
          {feeds.volume.map(m => (
            <FeedItem
              key={m.id}
              market={m}
              onClick={() => flyToNode(m.id)}
              rightContent={
                <span className="text-text-data">{formatDollar(m.volume)}</span>
              }
            />
          ))}
        </FeedSection>

        {/* Most Active */}
        <FeedSection title="Most Active" icon="⚡">
          {feeds.active.map(m => (
            <FeedItem
              key={m.id}
              market={m}
              onClick={() => flyToNode(m.id)}
              rightContent={
                <span className="text-text-data">{formatDollar(m.volume24hr)}</span>
              }
            />
          ))}
        </FeedSection>

        {/* Closest Calls */}
        <FeedSection title="Closest Calls" icon="🎯">
          {feeds.closest.map(m => (
            <FeedItem
              key={m.id}
              market={m}
              onClick={() => flyToNode(m.id)}
              rightContent={
                <span className="text-text-data">
                  {priceToPercent(m.outcomePrices.yes)}
                </span>
              }
            />
          ))}
        </FeedSection>

        {/* Mispriced Section */}
        <MispricedPanel />

        {/* Bottom padding for mobile */}
        <div className="h-20 lg:h-8" />
      </div>
    </>
  );
}
