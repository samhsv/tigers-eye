import { useMemo, useState, useCallback } from 'react';
import { useApp } from '../context/useApp';
import {
  getBiggestMovers,
  getHighestVolume,
  getMostActive,
  getClosestCalls,
} from '../lib/polymarket';
import { priceToPercent, formatDollar, formatPriceChange, formatSpreadRatio } from '../lib/format';
import { computeAllSignals, SIGNAL_COLORS } from '../lib/signals';
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
      className="group w-full text-left px-3.5 py-3 hover:bg-white/[0.06] rounded-lg transition-all duration-150 flex items-center justify-between gap-4"
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
  sectionKey,
  isCollapsed,
  onToggle,
  children,
}: {
  title: string;
  icon: string;
  sectionKey: string;
  isCollapsed: boolean;
  onToggle: (key: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-5 mb-5 section-card overflow-hidden">
      {/* Clickable header */}
      <button
        onClick={() => onToggle(sectionKey)}
        className="w-full flex items-center gap-2.5 px-4 py-3.5 hover:bg-white/[0.03] transition-colors rounded-xl"
      >
        <span className="text-sm">{icon}</span>
        <span className="text-xs uppercase tracking-wider text-text-secondary font-semibold flex-1 text-left">
          {title}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 12 12"
          fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          className={`text-text-secondary transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>

      {/* Collapsible body */}
      <div
        className={`transition-all duration-200 ease-in-out ${
          isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'
        }`}
      >
        <div className="px-2 pt-1 pb-3 space-y-1">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function FeedPanel() {
  const { state, dispatch, flyToNode } = useApp();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleSection = useCallback((key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const feeds = useMemo(() => {
    if (!state.markets.length) return null;
    return {
      movers: getBiggestMovers(state.markets),
      volume: getHighestVolume(state.markets),
      active: getMostActive(state.markets),
      closest: getClosestCalls(state.markets),
    };
  }, [state.markets]);

  const signals = useMemo(() => {
    if (!state.markets.length) return null;
    return computeAllSignals(state.markets);
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
        className={`fixed top-0 right-0 z-20 h-full w-[380px] glass-panel border-l border-white/[0.06] overflow-y-auto transition-transform duration-300
          ${state.feedPanelOpen ? 'translate-x-0' : 'translate-x-full'}
          lg:translate-x-0 lg:rounded-none`}
      >
        {/* Header */}
        <div className="px-6 pt-7 pb-5 flex items-start justify-between">
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
        <FeedSection title="Biggest Movers" icon="🔥"
          sectionKey="movers" isCollapsed={!!collapsed['movers']} onToggle={toggleSection}>
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
        <FeedSection title="Highest Stakes" icon="💰"
          sectionKey="volume" isCollapsed={!!collapsed['volume']} onToggle={toggleSection}>
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
        <FeedSection title="Most Active" icon="⚡"
          sectionKey="active" isCollapsed={!!collapsed['active']} onToggle={toggleSection}>
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
        <FeedSection title="Closest Calls" icon="🎯"
          sectionKey="closest" isCollapsed={!!collapsed['closest']} onToggle={toggleSection}>
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

        {/* Signals */}
        {signals && (
          <FeedSection title="Signals" icon="📡"
            sectionKey="signals" isCollapsed={!!collapsed['signals']} onToggle={toggleSection}>
            {signals.arbitrage.length === 0 && signals.anomalies.length === 0 &&
             signals.spreadWatch.length === 0 && signals.correlations.length === 0 && (
              <p className="px-3.5 py-3 text-[12px] text-text-secondary/60 italic">
                No signals detected
              </p>
            )}

            {signals.arbitrage.length > 0 && (
              <div className="mt-2 mb-3">
                <div className="border-l-2 pl-3 mb-2" style={{ borderColor: SIGNAL_COLORS.arbitrage }}>
                  <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: SIGNAL_COLORS.arbitrage }}>
                    Arbitrage
                  </span>
                </div>
                {signals.arbitrage.map(s => (
                  <button
                    key={s.eventId}
                    onClick={() => flyToNode(s.marketIds[0])}
                    className="group w-full text-left px-3.5 py-3 hover:bg-white/[0.06] rounded-lg transition-all duration-150"
                  >
                    <span className="text-[13px] text-text-primary/90 leading-snug line-clamp-2 group-hover:text-text-primary transition-colors block">
                      {s.eventTitle}
                    </span>
                    <span className="text-[11px] font-mono mt-1 block" style={{ color: SIGNAL_COLORS.arbitrage }}>
                      {s.marketIds.length} markets · sum {(s.priceSum * 100).toFixed(0)}%
                      {' '}({s.deviation > 0 ? '+' : ''}{(s.deviation * 100).toFixed(1)}pp)
                    </span>
                  </button>
                ))}
              </div>
            )}

            {signals.anomalies.length > 0 && (
              <div className="mt-4 mb-3">
                <div className="border-l-2 pl-3 mb-2" style={{ borderColor: SIGNAL_COLORS.anomaly }}>
                  <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: SIGNAL_COLORS.anomaly }}>
                    Anomalies
                  </span>
                </div>
                {signals.anomalies.map(s => (
                  <FeedItem
                    key={s.market.id}
                    market={s.market}
                    onClick={() => flyToNode(s.market.id)}
                    rightContent={
                      <span style={{ color: SIGNAL_COLORS.anomaly }}>
                        {formatPriceChange(s.priceChange)}
                      </span>
                    }
                  />
                ))}
              </div>
            )}

            {signals.spreadWatch.length > 0 && (
              <div className="mt-4 mb-3">
                <div className="border-l-2 pl-3 mb-2" style={{ borderColor: SIGNAL_COLORS.spreadWatch }}>
                  <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: SIGNAL_COLORS.spreadWatch }}>
                    Wide Spreads
                  </span>
                </div>
                {signals.spreadWatch.map(s => (
                  <FeedItem
                    key={s.market.id}
                    market={s.market}
                    onClick={() => flyToNode(s.market.id)}
                    rightContent={
                      <span style={{ color: SIGNAL_COLORS.spreadWatch }}>
                        {formatSpreadRatio(s.ratio)} avg
                      </span>
                    }
                  />
                ))}
              </div>
            )}

            {signals.correlations.length > 0 && (
              <div className="mt-4 mb-3">
                <div className="border-l-2 pl-3 mb-2" style={{ borderColor: SIGNAL_COLORS.correlation }}>
                  <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: SIGNAL_COLORS.correlation }}>
                    Cross-Category Movers
                  </span>
                </div>
                {signals.correlations.map((s, i) => (
                  <button
                    key={`${s.marketA.id}-${s.marketB.id}-${i}`}
                    onClick={() => flyToNode(s.marketA.id)}
                    className="group w-full text-left px-3.5 py-3 hover:bg-white/[0.06] rounded-lg transition-all duration-150"
                  >
                    <span className="text-[12px] text-text-primary/80 leading-snug line-clamp-1 block">
                      {s.marketA.question}
                    </span>
                    <span className="text-[12px] text-text-primary/80 leading-snug line-clamp-1 block mt-0.5">
                      {s.marketB.question}
                    </span>
                    <span className="text-[11px] font-mono mt-1 block" style={{ color: SIGNAL_COLORS.correlation }}>
                      {s.marketA.category} + {s.marketB.category} · {formatPriceChange(s.sharedChange)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </FeedSection>
        )}

        {/* Mispriced Section */}
        <div className="mx-5 mt-3 mb-4">
          <MispricedPanel />
        </div>

        {/* Bottom padding for mobile */}
        <div className="h-24 lg:h-10" />
      </div>
    </>
  );
}
