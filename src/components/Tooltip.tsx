import { useEffect, useState } from 'react';
import { useApp } from '../context/useApp';
import { priceToPercent, formatDollar, formatPriceChange } from '../lib/format';
import { categoryToColor } from '../lib/colors';
import { computeMarketColor } from '../lib/visualEncoding';

export default function Tooltip() {
  const { state } = useApp();
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Don't show on touch devices
  if ('ontouchstart' in window) return null;
  if (!state.hoveredMarket) return null;

  const market = state.hoveredMarket;
  const catColor = categoryToColor(market.category);
  const accentColor = computeMarketColor(market, state.activeColorMode, state.markets);

  return (
    <div
      className="fixed z-50 pointer-events-none max-w-[280px] rounded-xl overflow-hidden"
      style={{
        left: pos.x + 16,
        top: pos.y - 12,
        animation: 'scaleIn 0.15s ease-out',
      }}
    >
      {/* Accent bar matching active galaxy color */}
      <div className="h-0.5" style={{ background: accentColor }} />

      <div className="glass-panel !border-t-0 !rounded-t-none px-4 py-3">
        {/* Category */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: catColor }}
          />
          <span className="text-[10px] uppercase tracking-wider text-text-secondary font-medium">
            {market.category}
          </span>
        </div>

        {/* Question */}
        <p className="text-[13px] text-text-primary font-medium leading-snug mb-2">
          {market.question}
        </p>

        {/* Data row */}
        <div className="flex items-center gap-3 text-xs">
          <span className="font-mono font-semibold text-yes-green">
            {priceToPercent(market.outcomePrices.yes)} Yes
          </span>
          <span className="text-text-secondary">
            {formatDollar(market.volume)} vol
          </span>
          {market.oneDayPriceChange !== 0 && (
            <span
              className={`font-mono ${
                market.oneDayPriceChange > 0 ? 'text-yes-green' : 'text-no-red'
              }`}
            >
              {formatPriceChange(market.oneDayPriceChange)}
            </span>
          )}
        </div>

        {/* Contestedness mini-bar */}
        <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${market.contestedness * 100}%`,
              background: market.orbColor,
            }}
          />
        </div>
      </div>
    </div>
  );
}
