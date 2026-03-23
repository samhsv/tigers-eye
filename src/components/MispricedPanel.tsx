import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getTopMarketsForAnalysis } from '../lib/polymarket';
import { fetchAIJSON, MODELS, PROMPTS, buildMispricedMessage } from '../lib/ai';
import { priceToPercent } from '../lib/format';
import type { MispricedResponse } from '../types';

export default function MispricedPanel() {
  const { state, dispatch, flyToNode } = useApp();
  const [cooldownRemaining, setCooldownRemaining] = useState('');

  // Cooldown timer
  useEffect(() => {
    if (!state.mispricedCooldownUntil) return;

    const tick = () => {
      const remaining = state.mispricedCooldownUntil! - Date.now();
      if (remaining <= 0) {
        setCooldownRemaining('');
        return;
      }
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setCooldownRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [state.mispricedCooldownUntil]);

  const isOnCooldown =
    state.mispricedCooldownUntil !== null && state.mispricedCooldownUntil > Date.now();

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
        1000,
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
    <div className="px-3 pb-4">
      {/* Button */}
      <button
        onClick={handleAnalyze}
        disabled={state.mispricedLoading || isOnCooldown}
        className="w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-all disabled:opacity-50"
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
        <div className="mt-3 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-ai-accent font-medium px-1">
            AI thinks the crowd is wrong
          </div>

          {state.mispricedData.map((pick, i) => (
            <button
              key={pick.marketId || i}
              onClick={() => flyToNode(pick.marketId)}
              className="w-full text-left p-3 rounded-lg bg-bg-card/80 hover:bg-bg-card transition-colors border border-white/5"
            >
              <p className="text-xs text-text-primary leading-tight mb-2">
                {pick.question}
              </p>

              {/* Price comparison bar */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-1.5 bg-bg-secondary rounded-full relative">
                  {/* Current price marker */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-text-secondary"
                    style={{ left: `${pick.currentPrice * 100}%` }}
                  />
                  {/* Fair price marker */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-ai-accent"
                    style={{ left: `${pick.fairPrice * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] mb-1.5">
                <span className="text-text-secondary">
                  Now: {priceToPercent(pick.currentPrice)}
                </span>
                <span
                  className={`font-medium px-1.5 py-0.5 rounded text-[9px] ${
                    pick.direction === 'OVER'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {pick.direction}
                </span>
                <span className="text-ai-accent">
                  Fair: {priceToPercent(pick.fairPrice)}
                </span>
              </div>

              <p className="text-[11px] text-text-secondary leading-relaxed">
                {pick.reasoning}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
