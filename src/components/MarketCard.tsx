import { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../context/useApp';
import { formatDollar, formatEndDate, formatPriceChange, contestednessLabel } from '../lib/format';
import { categoryToColor } from '../lib/colors';

export default function MarketCard() {
  const { state, dispatch } = useApp();
  const market = state.selectedMarket;
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    closeTimerRef.current = setTimeout(() => {
      dispatch({ type: 'SELECT_MARKET', payload: null });
      setIsClosing(false);
    }, 200);
  }, [dispatch]);

  // Clear timeout if market changes while closing
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [market]);

  if (!market) return null;

  const yesPercent = Math.round(market.outcomePrices.yes * 100);
  const noPercent = Math.round(market.outcomePrices.no * 100);

  const stats = [
    { label: 'Volume', value: formatDollar(market.volume) },
    { label: 'Liquidity', value: formatDollar(market.liquidity) },
    { label: 'Resolves', value: formatEndDate(market.endDate) },
    ...(market.oneDayPriceChange !== 0
      ? [{
          label: '24h',
          value: formatPriceChange(market.oneDayPriceChange),
          color: market.oneDayPriceChange > 0 ? 'var(--color-yes-green)' : 'var(--color-no-red)',
        }]
      : []),
  ];

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 z-30 bg-black/30 lg:hidden"
        onClick={handleClose}
      />

      {/* Card */}
      <div
        className={`fixed z-40 glass-panel rounded-xl overflow-hidden flex flex-col
          bottom-0 left-0 right-0 max-h-[80vh] rounded-t-2xl
          lg:bottom-auto lg:left-8 lg:right-auto lg:top-1/2 lg:-translate-y-1/2 lg:w-[420px] lg:max-h-[88vh] lg:rounded-xl`}
        style={{
          animation: isClosing
            ? 'slideOutToLeft 0.2s ease-in forwards'
            : 'slideInFromLeft 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.4), 0 0 60px ${market.orbColor}15, 0 0 0 1px rgba(255, 255, 255, 0.03) inset`,
        }}
      >
        {/* Non-scrollable top portion */}
        <div className="shrink-0">
          {/* Accent bar — bridges orb color to card */}
          <div className="h-[3px]" style={{ background: market.orbColor }} />

          {/* Header */}
          <div className="flex items-start justify-between p-5 pb-0">
            <span
              className="text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-md"
              style={{
                backgroundColor: categoryToColor(market.category) + '20',
                color: categoryToColor(market.category),
              }}
            >
              {market.category}
            </span>
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.08] transition-colors text-text-secondary hover:text-text-primary"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          {/* Event title + Question */}
          <div className="px-5 pt-3 pb-4">
            {market.eventTitle && market.eventTitle !== market.question && (
              <p className="text-[11px] text-text-secondary font-medium tracking-wide uppercase mb-1">
                {market.eventTitle}
              </p>
            )}
            <h2 className="text-lg font-semibold text-text-primary leading-snug">
              {market.question}
            </h2>
          </div>

          {/* Data zone */}
          <div className="mx-5 mb-4 section-card p-4">
            {/* Probability gauge */}
            <div className="mb-4">
              <div className="flex items-baseline justify-between mb-2">
                <div>
                  <span className="text-2xl lg:text-3xl font-bold text-yes-green">{yesPercent}</span>
                  <span className="text-lg text-yes-green/60 ml-0.5">%</span>
                  <span className="text-[11px] uppercase tracking-wider text-text-secondary ml-2">Yes</span>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-text-secondary mr-2">No</span>
                  <span className="text-2xl lg:text-3xl font-bold text-no-red/70">{noPercent}</span>
                  <span className="text-lg text-no-red/40 ml-0.5">%</span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${yesPercent}%`,
                    background: 'linear-gradient(90deg, #34D399, #34D399CC)',
                  }}
                />
              </div>
              {/* Anchored contestedness label with side lines */}
              <div className="mt-3 flex items-center justify-center gap-2">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span
                  className="text-[11px] font-medium tracking-wide px-2"
                  style={{ color: market.orbColor }}
                >
                  {contestednessLabel(market.contestedness)}
                </span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>
            </div>

            {/* Internal separator */}
            <div className="h-px bg-white/[0.08] mb-3" />

            {/* Stats row */}
            <div className="flex flex-wrap gap-3">
              {stats.map((stat, i) => (
                <div key={stat.label} className="flex-1 min-w-[60px] text-center flex items-center">
                  {i > 0 && <div className="w-px h-6 bg-white/[0.10] -ml-1.5 mr-1.5 shrink-0" />}
                  <div className="flex-1">
                    <div className="text-[11px] text-text-secondary mb-1">{stat.label}</div>
                    <div
                      className="text-sm font-mono font-medium"
                      style={{ color: (stat as { color?: string }).color || undefined }}
                    >
                      {stat.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Take section — fills remaining space */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5" style={{ background: 'rgba(255, 184, 77, 0.02)' }}>
          <div className="flex items-center gap-2 mb-3">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
              <path d="M7 1l1.5 4.5L13 7l-4.5 1.5L7 13l-1.5-4.5L1 7l4.5-1.5L7 1z" fill="currentColor" className="text-ai-accent" />
            </svg>
            <span className="text-xs uppercase tracking-wider text-ai-accent font-semibold">
              AI Analysis
            </span>
          </div>

          {/* Indeterminate progress bar while loading */}
          {state.aiTakeLoading && !state.aiTake && (
            <>
              <div className="w-full h-0.5 bg-ai-accent/10 overflow-hidden rounded-full mb-3">
                <div
                  className="w-1/3 h-full bg-ai-accent/50 rounded-full"
                  style={{ animation: 'progressIndeterminate 1.5s ease-in-out infinite' }}
                />
              </div>
              <div className="flex gap-1.5 py-2">
                <span
                  className="w-2 h-2 rounded-full bg-ai-accent"
                  style={{ animation: 'typing-dot 1.4s infinite 0s' }}
                />
                <span
                  className="w-2 h-2 rounded-full bg-ai-accent"
                  style={{ animation: 'typing-dot 1.4s infinite 0.2s' }}
                />
                <span
                  className="w-2 h-2 rounded-full bg-ai-accent"
                  style={{ animation: 'typing-dot 1.4s infinite 0.4s' }}
                />
              </div>
            </>
          )}

          {state.aiTake && (
            <p className="text-sm text-text-primary/90 leading-relaxed">
              {state.aiTake}
              {state.aiTakeLoading && (
                <span className="inline-block w-0.5 h-5 bg-ai-accent ml-0.5 animate-pulse" />
              )}
            </p>
          )}

          {!state.aiTakeLoading && !state.aiTake && (
            <p className="text-xs text-text-secondary italic">
              Analysis unavailable
            </p>
          )}
        </div>
      </div>
    </>
  );
}
