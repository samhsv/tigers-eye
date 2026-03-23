import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/useApp';

export default function LoadingScreen() {
  const { state } = useApp();
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive fading directly from state — no setState in effect body
  const fading = state.dataLoaded;

  // Remove from DOM after fade transition completes
  useEffect(() => {
    if (!fading) return;

    timerRef.current = setTimeout(() => setVisible(false), 700);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fading]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg-primary transition-opacity duration-700"
      style={{ opacity: fading ? 0 : 1 }}
    >
      <h1
        className="text-5xl md:text-7xl font-bold tracking-tight font-[family-name:var(--font-display)]"
        style={{
          animation: 'fadeInUp 0.8s ease-out forwards',
          opacity: 0,
          color: '#FF6B1A',
        }}
      >
        TIGER&apos;S EYE
      </h1>

      <p
        className="mt-4 text-text-secondary text-sm md:text-base tracking-wide"
        style={{
          animation: 'fadeInUp 0.8s ease-out 0.4s forwards',
          opacity: 0,
        }}
      >
        A live map of what humanity thinks happens next.
      </p>

      {state.dataError ? (
        <p
          className="mt-8 text-red-400 text-sm"
          style={{
            animation: 'fadeInUp 0.8s ease-out 0.8s forwards',
            opacity: 0,
          }}
        >
          Failed to load: {state.dataError}
        </p>
      ) : (
        <div
          className="mt-8 w-48 h-0.5 bg-bg-secondary rounded-full overflow-hidden"
          style={{
            animation: 'fadeInUp 0.8s ease-out 0.8s forwards',
            opacity: 0,
          }}
        >
          <div
            className="h-full w-1/3 rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, #FF6B1A, transparent)',
              animation: 'shimmer 1.5s ease-in-out infinite',
            }}
          />
        </div>
      )}
    </div>
  );
}
