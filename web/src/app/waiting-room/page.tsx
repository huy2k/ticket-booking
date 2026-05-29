'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import WaitingRoom from '@/components/WaitingRoom';
import { useSocket } from '@/hooks/useSocket';

function WaitingRoomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const EVENT_ID = searchParams.get('eventId') || 'demo-event-001';
  const bookingId = searchParams.get('bookingId');

  const [state, setState] = useState<{
    userId: string;
    token: string;
    eventId: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [entered, setEntered] = useState(false);

  const handleEnter = useCallback(() => {
    setEntered(true);
    // Short delay for fade-out UX, then navigate
    setTimeout(() => router.push(`/seat-selection?eventId=${EVENT_ID}&bookingId=${bookingId}`), 1200);
  }, [router, EVENT_ID, bookingId]);

  // WebSocket real-time push listener
  useSocket({
    userId: state?.userId,
    eventId: state?.eventId,
    onQueueEnter: handleEnter,
  });

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const userId = localStorage.getItem('user_id');

    if (!token || !userId) {
      router.replace('/login');
      return;
    }

    // Restore queue token so F5 keeps position
    const saved = localStorage.getItem(`queue_position_${EVENT_ID}`);
    if (saved) {
      console.log('[Queue] Restored position from localStorage:', saved);
    }

    setState({ userId, token, eventId: EVENT_ID });
    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚙️</div>
          <p>Đang kết nối hệ thống...</p>
        </div>
      </div>
    );
  }

  if (entered) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--bg-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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

  if (!state) return null;

  return (
    <WaitingRoom
      eventId={state.eventId}
      userId={state.userId}
      token={state.token}
      onEnter={handleEnter}
    />
  );
}

export default function WaitingRoomPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Đang tải phòng chờ...</p>
      </div>
    }>
      <WaitingRoomContent />
    </Suspense>
  );
}
