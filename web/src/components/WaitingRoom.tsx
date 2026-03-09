'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface CircularProgressProps {
  position: number;
  total: number;
  estimatedMinutes: number;
}

function CircularProgress({ position, total, estimatedMinutes }: CircularProgressProps) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? Math.max(0, (total - position) / total) : 0;
  const offset = circumference * (1 - progress);

  return (
    <div style={{ position: 'relative', width: 220, height: 220, margin: '0 auto' }}>
      <svg width={220} height={220} className="circle-progress">
        <circle className="circle-progress-track" cx={110} cy={110} r={radius} />
        <circle
          className="circle-progress-fill"
          cx={110}
          cy={110}
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
          Số thứ tự
        </div>
        <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--neon-purple)' }}>
          #{position.toLocaleString()}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
          ~{estimatedMinutes} phút
        </div>
      </div>
    </div>
  );
}

function WaveBackground() {
  const bars = Array.from({ length: 24 });
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 80,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 6,
        padding: '0 2rem',
        pointerEvents: 'none',
        opacity: 0.4,
      }}
    >
      {bars.map((_, i) => (
        <span
          key={i}
          className="wave-bar"
          style={{
            height: `${20 + Math.random() * 40}px`,
            animationDelay: `${i * 0.07}s`,
          }}
        />
      ))}
    </div>
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="toast">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <span style={{ fontSize: '0.9rem' }}>🔔 {message}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.1rem' }}>×</button>
      </div>
    </div>
  );
}

interface WaitingRoomProps {
  eventId: string;
  userId: string;
  token: string;
}

export default function WaitingRoom({ eventId, userId, token }: WaitingRoomProps) {
  const [position, setPosition] = useState(0);
  const [total, setTotal] = useState(0);
  const [estimatedMinutes, setEstimatedMinutes] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

  // Fetch queue status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/queue/${eventId}/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPosition(data.position);
        setTotal(data.total);
        setEstimatedMinutes(data.estimatedWaitMinutes);

        // Warn when < 50 people ahead
        if (data.position <= 50 && data.position > 0) {
          setToast('Sắp đến lượt bạn, vui lòng chuẩn bị thông tin thanh toán!');
        }
      }
    } catch {/* ignore */}
  }, [API, eventId, token]);

  // Heartbeat every 5s
  const sendHeartbeat = useCallback(async () => {
    try {
      await fetch(`${API}/queue/heartbeat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {/* ignore */}
  }, [API, token]);

  useEffect(() => {
    // Restore from localStorage
    const saved = localStorage.getItem(`queue_token_${eventId}`);
    if (!saved) {
      localStorage.setItem(`queue_token_${eventId}`, userId);
    }

    fetchStatus();

    // Poll status every 3s (fallback when WebSocket not available)
    const poll = setInterval(fetchStatus, 3000);

    // Heartbeat every 5s
    heartbeatRef.current = setInterval(sendHeartbeat, 5000);

    return () => {
      clearInterval(poll);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [fetchStatus, sendHeartbeat, eventId, userId]);

  // Smooth transition to seat selection
  if (entering) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--bg-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.5s ease',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎟️</div>
          <p style={{ color: 'var(--neon-purple)', fontWeight: 700, fontSize: '1.25rem' }}>
            Đến lượt bạn! Đang chuyển hướng...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Phòng Chờ – Hệ Thống Mua Vé
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Vui lòng giữ trang này mở để duy trì vị trí của bạn
        </p>
      </div>

      {/* Card */}
      <div
        className="card"
        style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}
      >
        <CircularProgress
          position={position}
          total={total}
          estimatedMinutes={estimatedMinutes}
        />

        <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 10,
              padding: '0.875rem 1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Số thứ tự của bạn</span>
            <span style={{ fontWeight: 700, color: 'var(--neon-purple)', fontSize: '1.1rem' }}>
              #{position.toLocaleString()}
            </span>
          </div>
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 10,
              padding: '0.875rem 1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Phía trước còn</span>
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>
              {Math.max(0, position - 1).toLocaleString()} người
            </span>
          </div>
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 10,
              padding: '0.875rem 1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Thời gian chờ ước tính</span>
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>~{estimatedMinutes} phút</span>
          </div>
        </div>

        {/* Heartbeat indicator */}
        <div
          style={{
            marginTop: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--success)',
              display: 'inline-block',
              animation: 'wave-pulse 1.5s ease-in-out infinite',
            }}
          />
          Hệ thống đang hoạt động bình thường
        </div>
      </div>

      {/* Wave animation */}
      <WaveBackground />

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
