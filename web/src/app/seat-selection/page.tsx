'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SeatMap, Seat } from '@/components/SeatMap';
import { CountdownTimer } from '@/components/CountdownTimer';
import { Suspense } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { ZoneSvgMap } from '@/components/ZoneSvgMap';

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
  const [event, setEvent] = useState<any>(null);

  // Checkout modal state
  const [showCheckout, setShowCheckout] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

  const showToast = useCallback((msg: string) => setToast(msg), []);

  // Zone selection state
  const [viewMode, setViewMode] = useState<'zone' | 'detail'>('zone');
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [zonePrice, setZonePrice] = useState(0);
  const [availableSeatsInZone, setAvailableSeatsInZone] = useState<Seat[]>([]);
  const [quantity, setQuantity] = useState(1);

  const handleZoneSelect = useCallback((zoneName: string, category: string, price: number, availableSeats: Seat[]) => {
    setSelectedZone(zoneName);
    setZonePrice(price);
    setAvailableSeatsInZone(availableSeats);
    setQuantity(1);
    setShowZoneModal(true);
  }, []);

  const handleConfirmZoneSeats = useCallback(() => {
    if (availableSeatsInZone.length < quantity) {
      showToast('⚠️ Không đủ ghế trống trong khu vực này');
      return;
    }
    const chosen = availableSeatsInZone.slice(0, quantity);
    const nextSelectedIds = new Set<string>();
    chosen.forEach(s => nextSelectedIds.add(s.id));
    setSelectedIds(nextSelectedIds);
    setShowZoneModal(false);
    showToast(`✅ Đã chọn ${quantity} ghế trong khu vực ${selectedZone}!`);
  }, [availableSeatsInZone, quantity, selectedZone, showToast]);

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

  // Fetch event details
  useEffect(() => {
    if (!token || !eventId) return;
    fetch(`${API}/events/${eventId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Failed to fetch event');
      })
      .then((data) => setEvent(data))
      .catch((err) => console.error('Error fetching event:', err));
  }, [API, eventId, token]);

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

  // Helper to format event date
  const formatEventDate = (dateStr?: string) => {
    if (!dateStr) return '18:30 - 22:30, 06 Tháng 06, 2026';
    try {
      const d = new Date(dateStr);
      const formattedDate = d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      return `18:30 - 22:30, ${formattedDate}`;
    } catch {
      return '18:30 - 22:30, 06 Tháng 06, 2026';
    }
  };

  // Helper to format zone name to match style: "SKY - LOUNGE"
  const formatZoneName = (name: string) => {
    let formatted = name;
    if (name.includes(' ')) {
      const parts = name.split(' ');
      if (parts.length === 2) {
        formatted = `${parts[0]} - ${parts[1]}`;
      }
    }
    return formatted;
  };

  // Helper to determine Seating vs Standing label
  const getZoneType = (name: string) => {
    const n = name.toUpperCase();
    if (n.includes('GA') || n.includes('FANZONE') || n.includes('OZONE')) {
      return 'Standing';
    }
    return 'Seating';
  };

  const eventLocation = event?.location || 'Vạn Phúc City';

  return (
    <div style={{ minHeight: '100vh', padding: '1.5rem', background: '#09090b', color: '#fff' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.25rem', background: 'linear-gradient(to right, #fff, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              🗺️ Chọn vé & ghế ngồi
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              {viewMode === 'zone' ? 'Chọn khu vực muốn mua trên sơ đồ dưới đây.' : 'Chọn trực tiếp từng ghế mong muốn.'}
            </p>
          </div>

          {/* View Mode Switcher */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => setViewMode('zone')}
              style={{
                background: viewMode === 'zone' ? 'var(--neon-purple)' : 'transparent',
                border: '1px solid rgba(188,19,254,0.4)',
                color: '#fff',
                borderRadius: 8,
                padding: '0.45rem 1rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: viewMode === 'zone' ? '0 0 10px var(--neon-purple-glow)' : 'none',
                fontWeight: 600
              }}
            >
              🗺️ Chọn khu vực nhanh
            </button>
            <button
              onClick={() => setViewMode('detail')}
              style={{
                background: viewMode === 'detail' ? 'var(--neon-purple)' : 'transparent',
                border: '1px solid rgba(188,19,254,0.4)',
                color: '#fff',
                borderRadius: 8,
                padding: '0.45rem 1rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: viewMode === 'detail' ? '0 0 10px var(--neon-purple-glow)' : 'none',
                fontWeight: 600
              }}
            >
              🔲 Sơ đồ chọn từng ghế
            </button>
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Left Column: Sơ đồ SVG hoặc chi tiết ghế */}
          <div style={{ flex: '1 1 750px', minWidth: 0 }}>
            {seats.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '5rem', background: '#121214', borderRadius: 16 }}>
                Không có dữ liệu ghế
              </div>
            ) : viewMode === 'zone' ? (
              <ZoneSvgMap
                seats={seats}
                zones={mapConfig?.zones || []}
                onZoneSelect={handleZoneSelect}
              />
            ) : (
              <SeatMap              
                seats={seats}
                onSeatToggle={handleSeatToggle}
                selectedIds={selectedIds}
                mapConfig={mapConfig}
              />
            )}
          </div>

          {/* Right Column: Sidebar Thông tin sự kiện & Danh sách giá vé */}
          <div style={{
            width: '100%',
            maxWidth: 380,
            flex: '1 0 320px',
            background: '#1f1f23',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
            position: 'sticky',
            top: '1.5rem',
          }}>
            {/* Event Info (Lịch & Địa điểm) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
              {/* Date/Time */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e4e4e7' }}>
                  {formatEventDate(event?.eventDate)}
                </span>
              </div>

              {/* Location */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e4e4e7' }}>
                  {eventLocation}
                </span>
              </div>
            </div>

            {/* Price list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#a1a1aa', margin: '0 0 0.25rem 0' }}>Giá vé</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto', maxHeight: '420px', paddingRight: '0.25rem' }}>
                {mapConfig?.zones?.filter((z: any) => z.id !== 'foh').map((zone: any) => {
                  const availableCount = seats.filter(s => s.category === zone.category && s.status === 'AVAILABLE').length;
                  return (
                    <div
                      key={zone.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.1rem 0',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {/* Color box */}
                        <div
                          style={{
                            width: 26,
                            height: 15,
                            borderRadius: 4,
                            backgroundColor: zone.color,
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#f4f4f5' }}>
                            {formatZoneName(zone.name)} ({getZoneType(zone.name)})
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#a1a1aa' }}>
                            Còn {availableCount} vé
                          </span>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#10b981' }}>
                        {Number(zone.price || 0).toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sticky/Fixed bottom action on Sidebar */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.25rem', marginTop: 'auto' }}>
              {selectedIds.size === 0 ? (
                <button
                  disabled
                  style={{
                    width: '100%',
                    padding: '1rem',
                    background: '#27272a',
                    border: 'none',
                    borderRadius: 12,
                    color: '#71717a',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    cursor: 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s',
                  }}
                >
                  Vui lòng chọn vé <span style={{ fontSize: '1.1rem' }}>»</span>
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Summary of selections */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ color: '#a1a1aa' }}>Đã chọn ({selectedIds.size} ghế):</span>
                      <span style={{ fontWeight: 700, color: '#c084fc', textAlign: 'right', wordBreak: 'break-all', maxWidth: '200px' }}>
                        {selectedSeats.map(s => s.seatCode).join(', ')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                      <span style={{ color: '#a1a1aa' }}>Tổng cộng:</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>
                        {totalPrice.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleLockAndPay}
                    disabled={locking}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      background: 'linear-gradient(135deg, #a855f7 0%, #bc13fe 100%)',
                      border: 'none',
                      borderRadius: 12,
                      color: '#fff',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(188, 19, 254, 0.3)',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    {locking ? 'Đang xử lý...' : 'Thanh toán ngay →'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ Zone Selection Quantity Modal ═══════ */}
      {showZoneModal && selectedZone && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 110, padding: '1rem',
          }}
          onClick={() => setShowZoneModal(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 400, padding: '2rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem', textAlign: 'center' }}>
              🎟️ Chọn số lượng vé
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '1.5rem' }}>
              Khu vực: <strong style={{ color: '#fff' }}>{selectedZone}</strong>
            </p>

            {/* Info Table */}
            <div style={{
              background: 'var(--bg-surface)', borderRadius: 12,
              border: '1px solid rgba(188,19,254,0.15)',
              padding: '1rem', marginBottom: '1.5rem',
              display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.9rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Giá vé</span>
                <span style={{ fontWeight: 700, color: 'var(--neon-purple)' }}>{zonePrice.toLocaleString()}đ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Số ghế trống</span>
                <span style={{ fontWeight: 600, color: '#fff' }}>{availableSeatsInZone.length} ghế</span>
              </div>
            </div>

            {availableSeatsInZone.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <p style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.95rem', margin: 0 }}>
                  ❌ Khu vực này đã hết vé!
                </p>
                <button
                  onClick={() => setShowZoneModal(false)}
                  style={{
                    width: '100%', padding: '0.75rem', background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.2)', color: '#fff',
                    borderRadius: 10, cursor: 'pointer', fontSize: '0.9rem', marginTop: '1.5rem'
                  }}
                >
                  Đóng
                </button>
              </div>
            ) : (
              <>
                {/* Quantity Selector */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Số lượng (Tối đa 4)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      style={{
                        width: 36, height: 36, borderRadius: '50%',
                        border: '1px solid rgba(255,255,255,0.2)', background: 'transparent',
                        color: '#fff', fontSize: '1.2rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      -
                    </button>
                    <span style={{ fontSize: '1.2rem', fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{quantity}</span>
                    <button
                      onClick={() => setQuantity(q => Math.min(Math.min(4, availableSeatsInZone.length), q + 1))}
                      style={{
                        width: 36, height: 36, borderRadius: '50%',
                        border: '1px solid rgba(255,255,255,0.2)', background: 'transparent',
                        color: '#fff', fontSize: '1.2rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Confirm Button */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowZoneModal(false)}
                    style={{
                      flex: 1, padding: '0.75rem',
                      background: 'transparent', border: '1px solid rgba(188,19,254,0.3)',
                      color: 'var(--text-secondary)', borderRadius: 10, cursor: 'pointer', fontSize: '0.9rem',
                    }}
                  >
                    Huỷ
                  </button>
                  <button
                    onClick={handleConfirmZoneSeats}
                    style={{
                      flex: 2, padding: '0.75rem', background: 'var(--neon-purple)',
                      border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700,
                      fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 0 15px var(--neon-purple-glow)'
                    }}
                  >
                    Xác nhận ({ (zonePrice * quantity).toLocaleString() }đ)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Countdown Timer */}
      {timeLeft !== null && (
        <CountdownTimer initialSeconds={timeLeft} onExpired={handleExpired} />
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
