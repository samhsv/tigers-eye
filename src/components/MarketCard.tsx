import { useApp } from '../context/AppContext';
import { formatDollar, formatEndDate, formatPriceChange } from '../lib/format';
import { categoryToColor } from '../lib/colors';

export default function MarketCard() {
  const { state, dispatch } = useApp();
  const market = state.selectedMarket;

  if (!market) return null;

  const yesPercent = Math.round(market.outcomePrices.yes * 100);
  const noPercent = Math.round(market.outcomePrices.no * 100);

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 z-30 bg-black/30 lg:hidden"
        onClick={() => dispatch({ type: 'SELECT_MARKET', payload: null })}
      />

      {/* Card */}
      <div
        className="fixed z-40 bg-bg-card/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden
          bottom-0 left-0 right-0 max-h-[75vh]
          lg:bottom-auto lg:left-10 lg:right-auto lg:top-1/2 lg:-translate-y-1/2 lg:w-[380px] lg:max-h-[85vh]"
        style={{
          animation: 'fadeInUp 0.3s ease-out',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 pb-0">
          <span
            className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: categoryToColor(market.category) + '20',
              color: categoryToColor(market.category),
            }}
          >
            {market.category}
          </span>
          <button
            onClick={() => dispatch({ type: 'SELECT_MARKET', payload: null })}
            className="text-text-secondary hover:text-text-primary transition-colors text-lg leading-none p-1"
          >
            &times;
          </button>
        </div>

        {/* Question */}
        <div className="px-4 pt-2 pb-3">
          <h2 className="text-base font-semibold text-text-primary leading-snug">
            {market.question}
          </h2>
        </div>

        {/* Odds Display */}
        <div className="px-4 pb-3 flex gap-3">
          <div className="flex-1 bg-bg-secondary rounded-lg p-3 text-center">
            <div className="text-2xl font-bold font-mono text-text-data">
              {yesPercent}%
            </div>
            <div className="text-[10px] uppercase tracking-wider text-text-secondary mt-0.5">
              Yes
            </div>
          </div>
          <div className="flex-1 bg-bg-secondary rounded-lg p-3 text-center">
            <div className="text-2xl font-bold font-mono text-text-secondary">
              {noPercent}%
            </div>
            <div className="text-[10px] uppercase tracking-wider text-text-secondary mt-0.5">
              No
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 pb-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs font-mono text-text-data">
              {formatDollar(market.volume)}
            </div>
            <div className="text-[10px] text-text-secondary">Volume</div>
          </div>
          <div>
            <div className="text-xs font-mono text-text-data">
              {formatDollar(market.liquidity)}
            </div>
            <div className="text-[10px] text-text-secondary">Liquidity</div>
          </div>
          <div>
            <div className="text-xs font-mono text-text-primary">
              {formatEndDate(market.endDate)}
            </div>
            <div className="text-[10px] text-text-secondary">Resolves</div>
          </div>
        </div>

        {/* Price change */}
        {market.oneDayPriceChange !== 0 && (
          <div className="px-4 pb-3">
            <span className="text-xs text-text-secondary">24h: </span>
            <span
              className={`text-xs font-mono font-medium ${
                market.oneDayPriceChange > 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {formatPriceChange(market.oneDayPriceChange)}
            </span>
          </div>
        )}

        {/* Divider */}
        <div className="mx-4 border-t border-white/5" />

        {/* AI Take */}
        <div className="p-4 overflow-y-auto max-h-[200px] lg:max-h-[250px]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-ai-accent" />
            <span className="text-[10px] uppercase tracking-wider text-ai-accent font-medium">
              AI Take
            </span>
          </div>

          {state.aiTakeLoading && !state.aiTake && (
            <div className="flex gap-1 py-2">
              <span
                className="w-1.5 h-1.5 rounded-full bg-ai-accent"
                style={{ animation: 'typing-dot 1.4s infinite 0s' }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-ai-accent"
                style={{ animation: 'typing-dot 1.4s infinite 0.2s' }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-ai-accent"
                style={{ animation: 'typing-dot 1.4s infinite 0.4s' }}
              />
            </div>
          )}

          {state.aiTake && (
            <p className="text-sm text-text-primary leading-relaxed font-mono">
              {state.aiTake}
              {state.aiTakeLoading && (
                <span className="inline-block w-1.5 h-4 bg-ai-accent/70 ml-0.5 animate-pulse" />
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
