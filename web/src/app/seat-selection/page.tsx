'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SeatMap, Seat } from '@/components/SeatMap';
import { CountdownTimer } from '@/components/CountdownTimer';
import { Suspense } from 'react';
import { useSocket } from '@/hooks/useSocket';

const LOCK_DURATION_SECONDS = 10 * 60; // 10 minutes

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="toast" style={{ maxWidth: 320 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '0.875rem' }}>{msg}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>×</button>
      </div>
    </div>
  );
}

function SeatSelectionContent() {
  const router = useRouter();
  const params = useSearchParams();
  const eventId = params.get('eventId') || 'demo-event-001';
  const bookingId = params.get('bookingId');

  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [mapConfig, setMapConfig] = useState<any>(null);

  // Checkout modal state
  const [showCheckout, setShowCheckout] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

  const showToast = useCallback((msg: string) => setToast(msg), []);

  // Auth check
  useEffect(() => {
    const t = localStorage.getItem('auth_token');
    if (!t) { router.replace('/login'); return; }
    setToken(t);
  }, [router]);

  // Calculate remaining booking time based on entry time
  useEffect(() => {
    if (!bookingId) return;

    // Clean up expired booking keys from localStorage to prevent clutter
    try {
      const nowTs = Date.now();
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('booking_expiry_')) {
          const val = localStorage.getItem(key);
          if (val && parseInt(val, 10) < nowTs) {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.error('Error cleaning up localStorage:', e);
    }

    const key = `booking_expiry_${bookingId}`;
    const storedExpiry = localStorage.getItem(key);
    const now = Date.now();
    let expiryTime = 0;

    if (storedExpiry) {
      expiryTime = parseInt(storedExpiry, 10);
    } else {
      expiryTime = now + LOCK_DURATION_SECONDS * 1000;
      localStorage.setItem(key, expiryTime.toString());
    }

    const calculatedTimeLeft = Math.max(0, Math.floor((expiryTime - now) / 1000));
    setTimeLeft(calculatedTimeLeft);
  }, [bookingId]);

  // Fetch seat map
  const fetchSeats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/seats/${eventId}/map`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.seats) {
          setSeats(data.seats);
          setMapConfig(data.mapConfig || null);
        } else {
          setSeats(Array.isArray(data) ? data : []);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [API, eventId, token]);

  // Decode userId from JWT token
  const getUserIdFromToken = (tok: string): string => {
    try {
      const payload = tok.split('.')[1];
      if (!payload) return '';
      return JSON.parse(atob(payload)).id || '';
    } catch {
      return '';
    }
  };
  const userId = getUserIdFromToken(token);

  // Initialize socket and listen for real-time seat updates
  const { sendHeartbeat } = useSocket({
    userId,
    eventId,
    onSeatsUpdate: useCallback(() => {
      console.log('⚡ Sơ đồ ghế đã được thay đổi từ người khác, đang cập nhật...');
      fetchSeats();
    }, [fetchSeats]),
  });

  useEffect(() => {
    if (token) fetchSeats();
  }, [fetchSeats, token]);

  // Heartbeat every 5s to maintain active queue slot via WebSocket
  useEffect(() => {
    if (!token || !userId) return;
    const sendHeart = () => {
      sendHeartbeat(userId, eventId);
    };
    sendHeart();
    const interval = setInterval(sendHeart, 5000);
    return () => clearInterval(interval);
  }, [token, userId, eventId, sendHeartbeat]);

  const handleSeatToggle = useCallback((seat: Seat) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(seat.id)) {
        next.delete(seat.id);
      } else {
        if (next.size >= 4) {
          showToast('⚠️ Tối đa 4 ghế mỗi lần mua');
          return prev;
        }
        next.add(seat.id);
      }
      return next;
    });
  }, [showToast]);

  // Step 1: Lock seats then show checkout form
  const handleLockAndPay = useCallback(async () => {
    if (!bookingId) { showToast('⚠️ Thiếu Booking ID. Vui lòng quay lại trang chủ'); return; }
    if (selectedIds.size === 0) { showToast('Vui lòng chọn ít nhất 1 ghế'); return; }
    setLocking(true);
    try {
      const seatIdArr = Array.from(selectedIds);
      const lockResults = await Promise.allSettled(
        seatIdArr.map((seatId) =>
          fetch(`${API}/seats/lock`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ seatId, bookingId }),
          })
        )
      );

      const failed = lockResults.filter((r) => r.status === 'rejected' ||
        (r.status === 'fulfilled' && !r.value.ok));

      if (failed.length > 0) {
        showToast('❌ Một số ghế đã được người khác chọn. Vui lòng chọn lại.');
        await fetchSeats();
        setSelectedIds(new Set());
        return;
      }

      showToast('✅ Ghế đã được giữ! Vui lòng điền thông tin.');
      setShowCheckout(true);
    } catch {
      showToast('❌ Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLocking(false);
    }
  }, [selectedIds, token, API, fetchSeats, showToast, bookingId]);

  // Step 2: Submit buyer info → create VNPay URL → redirect
  const handleCheckout = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim() || !buyerEmail.trim() || !buyerPhone.trim()) {
      showToast('⚠️ Vui lòng điền đầy đủ thông tin');
      return;
    }

    setSubmitting(true);
    try {
      const seatIdArr = Array.from(selectedIds);
      const selectedSeatsForPay = seats.filter((s) => selectedIds.has(s.id));
      const amount = selectedSeatsForPay.reduce((sum, s) => sum + Number(s.price), 0);

      const payRes = await fetch(`${API}/payment/create_url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          seatIds: seatIdArr,
          bookingId,
          amount,
          buyerName: buyerName.trim(),
          buyerEmail: buyerEmail.trim(),
          buyerPhone: buyerPhone.trim(),
        }),
      });

      if (!payRes.ok) {
        showToast('❌ Không thể tạo đường dẫn thanh toán.');
        return;
      }

      const { url } = await payRes.json();
      if (bookingId) {
        localStorage.removeItem(`booking_expiry_${bookingId}`);
      }
      window.location.assign(url);
    } catch {
      showToast('❌ Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }, [selectedIds, seats, token, API, showToast, buyerName, buyerEmail, buyerPhone, bookingId]);

  const handleExpired = useCallback(() => {
    if (bookingId) {
      localStorage.removeItem(`booking_expiry_${bookingId}`);
    }
    showToast('⏰ Phiên làm việc đã hết hạn!');
    setTimeout(() => router.replace('/'), 2000);
  }, [bookingId, router, showToast]);

  const selectedSeats = seats.filter((s) => selectedIds.has(s.id));
  const totalPrice = selectedSeats.reduce((sum, s) => sum + Number(s.price), 0);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🗺️</div>
          <p>Đang tải sơ đồ ghế...</p>
        </div>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    background: 'var(--bg-surface)',
    border: '1px solid rgba(188,19,254,0.25)',
    borderRadius: 10,
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  return (
    <div style={{ minHeight: '100vh', padding: '1.5rem', paddingBottom: '6rem' }}>
      {/* Header */}
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>🗺️ Chọn ghế</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Nhấn vào ghế để chọn. Tối đa 4 ghế / lần mua.
        </p>
      </div>

      {/* Seat Map */}
      <div style={{ maxWidth: 900, margin: '2rem auto 0' }}>
        {seats.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>Không có dữ liệu ghế</div>
        ) : (
          <SeatMap              
              seats={seats}
              onSeatToggle={handleSeatToggle}
              selectedIds={selectedIds}
              mapConfig={mapConfig}
            />)}
      </div>

      {/* Countdown Timer */}
      {timeLeft !== null && (
        <CountdownTimer initialSeconds={timeLeft} onExpired={handleExpired} />
      )}

      {/* Floating Bar */}
      {selectedIds.size > 0 && !showCheckout && (
        <div className="floating-bar">
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Đã chọn</span>
          <span style={{ fontWeight: 700, color: 'var(--neon-purple)', fontSize: '1.1rem' }}>{selectedIds.size} ghế</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>|</span>
          <span style={{ fontWeight: 700 }}>{totalPrice.toLocaleString()}đ</span>
          <button
            className="btn-neon"
            onClick={handleLockAndPay}
            disabled={locking}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem' }}
          >
            {locking ? 'Đang xử lý...' : 'Thanh toán ngay →'}
          </button>
        </div>
      )}

      {/* ═══════ Checkout Modal ═══════ */}
      {showCheckout && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: '1rem',
          }}
          onClick={() => setShowCheckout(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 440, padding: '2rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem', textAlign: 'center' }}>
              📝 Thông tin người mua
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '1.5rem' }}>
              Vui lòng điền đầy đủ để nhận vé điện tử
            </p>

            {/* Summary */}
            <div style={{
              background: 'var(--bg-surface)', borderRadius: 10,
              padding: '0.75rem 1rem', marginBottom: '1.5rem',
              border: '1px solid rgba(188,19,254,0.15)',
              display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem',
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                {selectedIds.size} ghế: {selectedSeats.map(s => s.seatCode).join(', ')}
              </span>
              <span style={{ fontWeight: 700, color: 'var(--neon-purple)' }}>
                {totalPrice.toLocaleString()}đ
              </span>
            </div>

            <form onSubmit={handleCheckout} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Họ và tên *
                </label>
                <input
                  type="text" value={buyerName} onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Nguyễn Văn A" required style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--neon-purple)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(188,19,254,0.25)'}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Email *
                </label>
                <input
                  type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="email@example.com" required style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--neon-purple)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(188,19,254,0.25)'}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Số điện thoại *
                </label>
                <input
                  type="tel" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="0901234567" required style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--neon-purple)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(188,19,254,0.25)'}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCheckout(false)}
                  style={{
                    flex: 1, padding: '0.75rem',
                    background: 'transparent', border: '1px solid rgba(188,19,254,0.3)',
                    color: 'var(--text-secondary)', borderRadius: 10, cursor: 'pointer', fontSize: '0.9rem',
                  }}
                >
                  ← Quay lại
                </button>
                <button type="submit" className="btn-neon" disabled={submitting} style={{ flex: 2, padding: '0.75rem', fontSize: '0.95rem' }}>
                  {submitting ? 'Đang chuyển hướng...' : '💳 Thanh toán VNPay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

export default function SeatSelectionPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)' }}>Đang tải...</p>
    </div>}>
      <SeatSelectionContent />
    </Suspense>
  );
}
