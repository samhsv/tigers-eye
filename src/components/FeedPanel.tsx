import { useMemo } from 'react';
import { useApp } from '../context/useApp';
import {
  getBiggestMovers,
  getHighestVolume,
  getMostActive,
  getClosestCalls,
} from '../lib/polymarket';
import { truncateQuestion, priceToPercent, formatDollar, formatPriceChange } from '../lib/format';
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
      className="w-full text-left px-3 py-2 hover:bg-white/5 rounded-lg transition-colors flex items-center justify-between gap-2"
    >
      <span className="text-xs text-text-primary leading-tight flex-1 min-w-0 truncate">
        {truncateQuestion(market.question, 50)}
      </span>
      <span className="text-xs font-mono shrink-0">{rightContent}</span>
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
    <div className="mb-4">
      <div className="flex items-center gap-1.5 px-3 mb-1">
        <span className="text-sm">{icon}</span>
        <span className="text-[10px] uppercase tracking-wider text-text-secondary font-medium">
          {title}
        </span>
      </div>
      <div>{children}</div>
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
        className="fixed bottom-6 right-6 z-30 lg:hidden w-12 h-12 rounded-full bg-auburn-glow text-white flex items-center justify-center shadow-lg"
        style={{ animation: 'pulse-glow 2s ease-in-out infinite' }}
        onClick={() => dispatch({ type: 'TOGGLE_FEED_PANEL' })}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
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
        className={`fixed top-0 right-0 z-20 h-full w-[320px] bg-bg-secondary/95 backdrop-blur-md border-l border-white/5 overflow-y-auto transition-transform duration-300
          ${state.feedPanelOpen ? 'translate-x-0' : 'translate-x-full'}
          lg:translate-x-0`}
      >
        {/* Header */}
        <div className="px-4 pt-5 pb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">
            Market Feed
          </h2>
          <button
            className="lg:hidden text-text-secondary hover:text-text-primary"
            onClick={() => dispatch({ type: 'TOGGLE_FEED_PANEL' })}
          >
            &times;
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
                      ? 'text-green-400'
                      : m.oneDayPriceChange < 0
                        ? 'text-red-400'
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
