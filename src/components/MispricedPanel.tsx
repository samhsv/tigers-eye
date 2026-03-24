import { useSyncExternalStore, useCallback, useRef } from 'react';
import { useApp } from '../context/useApp';
import { getTopMarketsForAnalysis } from '../lib/polymarket';
import { fetchAIJSON, MODELS, PROMPTS, buildMispricedMessage } from '../lib/ai';
import { priceToPercent } from '../lib/format';
import type { MispricedResponse } from '../types';

// Subscribes to a 1-second tick so React re-renders on each tick
function subscribeTick(callback: () => void) {
  const id = setInterval(callback, 1000);
  return () => clearInterval(id);
}

function useCooldownTimer(cooldownUntil: number | null) {
  const getSnapshot = useCallback(() => {
    if (!cooldownUntil) return { active: false, remaining: '' };
    const diff = cooldownUntil - Date.now();
    if (diff <= 0) return { active: false, remaining: '' };
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return {
      active: true,
      remaining: `${minutes}:${seconds.toString().padStart(2, '0')}`,
    };
  }, [cooldownUntil]);

  const cachedRef = useRef({ active: false, remaining: '' });
  const stableGetSnapshot = useCallback(() => {
    const next = getSnapshot();
    if (next.active === cachedRef.current.active && next.remaining === cachedRef.current.remaining) {
      return cachedRef.current;
    }
    cachedRef.current = next;
    return next;
  }, [getSnapshot]);

  return useSyncExternalStore(subscribeTick, stableGetSnapshot, stableGetSnapshot);
}

export default function MispricedPanel() {
  const { state, dispatch, flyToNode } = useApp();
  const { remaining: cooldownRemaining, active: isOnCooldown } = useCooldownTimer(
    state.mispricedCooldownUntil,
  );

  const handleAnalyze = useCallback(async () => {
    if (state.mispricedLoading || isOnCooldown) return;

    dispatch({ type: 'SET_MISPRICED_LOADING', payload: true });

    try {
      const topMarkets = getTopMarketsForAnalysis(state.markets);
      const result = await fetchAIJSON<MispricedResponse>(
        MODELS.SUPER,
        [
          { role: 'system', content: PROMPTS.MISPRICED_ANALYSIS },
          { role: 'user', content: buildMispricedMessage(topMarkets) },
        ],
        4000,
        0.7,
      );

      dispatch({ type: 'SET_MISPRICED', payload: result.picks });
      dispatch({ type: 'SET_MISPRICED_COOLDOWN', payload: Date.now() + 10 * 60 * 1000 });
    } catch (err) {
      console.error('Mispriced analysis failed:', err);
      dispatch({ type: 'SET_MISPRICED_LOADING', payload: false });
    }
  }, [state.markets, state.mispricedLoading, isOnCooldown, dispatch]);

  return (
    <div className="pb-3">
      {/* Button */}
      <button
        onClick={handleAnalyze}
        disabled={state.mispricedLoading || isOnCooldown}
        className="w-full py-4 rounded-xl font-semibold text-base text-white transition-all disabled:opacity-50"
        style={{
          background: state.mispricedLoading || isOnCooldown
            ? '#3a3a4a'
            : 'linear-gradient(135deg, #DD550C, #FF6B1A)',
          animation:
            !state.mispricedLoading && !isOnCooldown
              ? 'pulse-glow 2s ease-in-out infinite'
              : undefined,
        }}
      >
        {state.mispricedLoading
          ? 'Analyzing...'
          : isOnCooldown
            ? `Refresh in ${cooldownRemaining}`
            : "What's Mispriced?"}
      </button>

      {/* Results */}
      {state.mispricedData && state.mispricedData.length > 0 && (
        <div className="mt-5 space-y-5">
          <div className="border-l-2 border-ai-accent pl-3">
            <span className="text-[11px] uppercase tracking-wider text-ai-accent font-semibold">
              Mispricing Signals
            </span>
          </div>

          {state.mispricedData.map((pick, i) => {
            const minPrice = Math.min(pick.currentPrice, pick.fairPrice);
            const maxPrice = Math.max(pick.currentPrice, pick.fairPrice);
            const gapPp = Math.abs(Math.round((pick.fairPrice - pick.currentPrice) * 100));

            return (
              <button
                key={pick.marketId || i}
                onClick={() => flyToNode(pick.marketId)}
                className="w-full text-left p-5 rounded-xl bg-glass-bg hover:bg-surface-elevated transition-all duration-200 border border-glass-border hover:border-glass-border-hover"
              >
                <p className="text-[13px] text-text-primary font-medium leading-tight mb-3">
                  {pick.question}
                </p>

                {/* Price range visualization */}
                <div className="mb-3">
                  <div className="relative h-6 rounded-md bg-white/[0.04] overflow-hidden">
                    {/* Mispricing range fill */}
                    <div
                      className="absolute top-0 bottom-0 opacity-20"
                      style={{
                        left: `${minPrice * 100}%`,
                        width: `${(maxPrice - minPrice) * 100}%`,
                        background: pick.direction === 'OVER' ? '#34D399' : '#F87171',
                      }}
                    />
                    {/* Current price marker */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-text-secondary z-10"
                      style={{ left: `${pick.currentPrice * 100}%` }}
                    />
                    {/* Fair price marker */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-ai-accent z-10"
                      style={{ left: `${pick.fairPrice * 100}%` }}
                    />
                    {/* Labels inside the bar */}
                    <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px] font-mono">
                      <span className="text-text-secondary">Now {priceToPercent(pick.currentPrice)}</span>
                      <span className="text-ai-accent">Fair {priceToPercent(pick.fairPrice)}</span>
                    </div>
                  </div>
                </div>

                {/* Direction badge + gap */}
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      pick.direction === 'OVER'
                        ? 'bg-yes-green/15 text-yes-green'
                        : 'bg-no-red/15 text-no-red'
                    }`}
                  >
                    {pick.direction === 'OVER' ? 'Undervalued' : 'Overvalued'}
                  </span>
                  <span className="text-[11px] text-text-secondary font-mono">
                    {gapPp}pp gap
                  </span>
                </div>

                <p className="text-xs text-text-secondary/90 leading-relaxed">
                  {pick.reasoning}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
