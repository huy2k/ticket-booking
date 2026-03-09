'use client';

import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  initialSeconds: number;
  onExpired: () => void;
}

export function CountdownTimer({ initialSeconds, onExpired }: CountdownTimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (seconds <= 0) {
      onExpired();
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, onExpired]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const isCritical = seconds <= 60;

  return (
    <div
      style={{
        position: 'fixed',
        top: '1.25rem',
        right: '1.25rem',
        background: 'var(--bg-card)',
        border: `1px solid ${isCritical ? 'var(--error)' : 'var(--neon-purple)'}`,
        borderRadius: 10,
        padding: '0.5rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        zIndex: 200,
        boxShadow: isCritical ? '0 0 12px rgba(244,67,54,0.4)' : '0 0 12px var(--neon-purple-glow)',
      }}
    >
      <span style={{ fontSize: '1rem' }}>⏱</span>
      <span
        className={isCritical ? 'timer-critical' : ''}
        style={{
          fontWeight: 800,
          fontSize: '1.25rem',
          fontVariantNumeric: 'tabular-nums',
          color: isCritical ? 'var(--error)' : 'var(--neon-purple)',
          letterSpacing: '0.05em',
        }}
      >
        {mm}:{ss}
      </span>
    </div>
  );
}
