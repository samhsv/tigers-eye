import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { priceToPercent, formatDollar } from '../lib/format';

export default function Tooltip() {
  const { state } = useApp();
  const posRef = useRef({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      if (tooltipRef.current) {
        tooltipRef.current.style.left = `${e.clientX + 14}px`;
        tooltipRef.current.style.top = `${e.clientY - 10}px`;
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Don't show on touch devices
  if ('ontouchstart' in window) return null;
  if (!state.hoveredMarket) return null;

  const market = state.hoveredMarket;

  return (
    <div
      ref={tooltipRef}
      className="fixed z-40 pointer-events-none max-w-xs px-3 py-2 rounded-lg bg-bg-card/95 border border-white/10 backdrop-blur-sm"
      style={{
        left: posRef.current.x + 14,
        top: posRef.current.y - 10,
      }}
    >
      <p className="text-xs text-text-primary leading-tight mb-1">
        {market.question}
      </p>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-text-data font-mono font-medium">
          YES {priceToPercent(market.outcomePrices.yes)}
        </span>
        <span className="text-text-secondary">
          {formatDollar(market.volume)} vol
        </span>
      </div>
    </div>
  );
}
