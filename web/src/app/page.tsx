'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Event {
  id: string;
  name: string;
  description: string;
  saleStartAt: string | null;
  totalSeats: number;
}

export default function HomePage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    setIsLoggedIn(!!token);

    // Fetch events from API
    fetch(`${API}/events`)
      .then((res) => res.json())
      .then((data) => {
        setEvents(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [API]);

  const handleBuyTicket = useCallback(async (eventId: string) => {
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }

    setJoiningId(eventId);
    setError('');
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`${API}/queue/${eventId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Lỗi hệ thống, vui lòng thử lại');
        setJoiningId(null);
        return;
      }

      if (data.entered) {
        // Direct entry — go straight to seat selection
        router.push(`/seat-selection?eventId=${eventId}&bookingId=${data.bookingId}`);
      } else {
        // Must wait in queue
        router.push(`/waiting-room?eventId=${eventId}&bookingId=${data.bookingId}`);
      }
    } catch {
      setError('Không thể kết nối đến máy chủ');
      setJoiningId(null);
    }
  }, [isLoggedIn, API, router]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    setIsLoggedIn(false);
  }, []);

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Navbar */}
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 2rem',
          borderBottom: '1px solid rgba(188,19,254,0.15)',
          backdropFilter: 'blur(10px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(18,18,18,0.9)',
        }}
      >
        <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--neon-purple)' }}>
          🎟️ TicketZone
        </div>
        <div>
          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              style={{
                background: 'transparent',
                border: '1px solid rgba(188,19,254,0.4)',
                color: 'var(--text-secondary)',
                borderRadius: 8,
                padding: '0.5rem 1rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Đăng xuất
            </button>
          ) : (
            <button className="btn-neon" onClick={() => router.push('/login')} style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}>
              Đăng nhập
            </button>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: '4rem 2rem 3rem',
          textAlign: 'center',
        }}
      >
        {/* Purple glow background */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 600,
            height: 400,
            background: 'radial-gradient(ellipse at center, rgba(188,19,254,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 900,
            lineHeight: 1.15,
            marginBottom: '1rem',
            background: 'linear-gradient(135deg, #fff 0%, #bc13fe 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Sự Kiện Âm Nhạc
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '2.5rem', maxWidth: 560, margin: '0 auto 2.5rem' }}>
          Tuyển tập những show diễn hot nhất hiện nay. Đặt vé tham gia cùng hàng nghìn người hâm mộ.
        </p>

        {error && (
          <p style={{ color: 'var(--error)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>{error}</p>
        )}

        {/* Event List */}
        {loading ? (
          <div style={{ color: 'var(--text-secondary)' }}>Đang tải danh sách sự kiện...</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.5rem',
              maxWidth: 1000,
              margin: '0 auto',
              textAlign: 'left',
            }}
          >
            {events.map((event) => {
                const saleDate = event.saleStartAt
                  ? new Date(event.saleStartAt).toLocaleString('vi-VN', {
                      year: 'numeric', month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })
                  : 'Sắp công bố';
                
                const isJoining = joiningId === event.id;
                const startTime = event.saleStartAt ? new Date(event.saleStartAt).getTime() : 0;
                const isNotYetStarted = startTime > now;

                return (
                  <div key={event.id} className="card" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                      {event.name}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', flex: 1, lineHeight: 1.5 }}>
                      {event.description}
                    </p>
                    
                    <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>📅</span> <span>Mở bán: {saleDate}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>💺</span> <span>Tổng: {event.totalSeats.toLocaleString()} vé chờ mua</span>
                      </div>
                    </div>

                    <button
                      className="btn-neon"
                      onClick={() => handleBuyTicket(event.id)}
                      disabled={isJoining || joiningId !== null || isNotYetStarted}
                      style={{ fontSize: '1rem', padding: '0.8rem 1.5rem', width: '100%', opacity: (joiningId !== null && !isJoining) || isNotYetStarted ? 0.5 : 1 }}
                    >
                      {isJoining ? 'Đang xử lý...' : isNotYetStarted ? 'Sắp mở bán' : '🎫 Mua vé'}
                    </button>
                  </div>
                );
            })}
          </div>
        )}

        {/* System info */}
        <div
          style={{
            marginTop: '4rem',
            display: 'flex',
            justifyContent: 'center',
            gap: '2rem',
            flexWrap: 'wrap',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
          }}
        >
          {[
            '✅ Hàng đợi ảo công bằng (FIFO)',
            '✅ Cập nhật real-time qua WebSocket',
            '✅ Không bán quá số lượng',
            '✅ Giữ vị trí khi tải lại trang',
          ].map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
