'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Ticket {
  id: string;
  paymentRef: string | null;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  purchasedAt: string;
  event: {
    id: string;
    name: string;
    description: string | null;
    location: string | null;
    eventDate: string | null;
    bannerUrl: string | null;
    category: string | null;
  };
  seat: {
    id: string;
    seatCode: string;
    row: string;
    col: number;
    category: string;
    price: string;
  };
}

export default function MyTicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.replace('/login?redirect=/my-tickets');
      return;
    }

    fetch(`${API}/tickets/my`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || 'Không thể tải danh sách vé');
        }
        return data;
      })
      .then((data) => {
        setTickets(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Lỗi kết nối máy chủ');
        setLoading(false);
      });
  }, [API, router]);

  const categoryColors: Record<string, string> = {
    VVIP: '#BC13FE',
    VIP: '#2563EB',
    GOLD: '#D97706',
    SILVER: '#6B7280',
  };

  const getCategoryLabel = (category: string | null) => {
    switch (category) {
      case 'music':
        return '🎵 Âm nhạc';
      case 'theater':
        return '🎭 Kịch nói';
      case 'sports':
        return '🏃 Thể thao';
      case 'workshop':
        return '🏺 Workshop';
      default:
        return '🎟️ Sự kiện';
    }
  };

  const formatEventDate = (dateStr: string | null, isShort = false) => {
    if (!dateStr) return 'Đang cập nhật';
    const date = new Date(dateStr);
    if (isShort) {
      return date.toLocaleDateString('vi-VN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', color: '#f0f0f0', padding: '2rem 1.5rem' }}>
      {/* Header */}
      <header style={{ maxWidth: 1000, margin: '0 auto 2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button
            onClick={() => router.push('/')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--neon-purple)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600,
              padding: 0,
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            ← Quay lại trang chủ
          </button>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, background: 'linear-gradient(135deg, #fff, #bc13fe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🎫 Vé Của Tôi
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: 1000, margin: '0 auto' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '5rem 0', color: 'var(--text-secondary)' }}>
            <div style={{
              width: 40,
              height: 40,
              border: '3px solid rgba(188,19,254,0.15)',
              borderTop: '3px solid var(--neon-purple)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            <span>Đang tải danh sách vé...</span>
          </div>
        ) : error ? (
          <div style={{ padding: '2rem', background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)', borderRadius: 12, color: '#FF3B30', textAlign: 'center' }}>
            ⚠️ {error}
          </div>
        ) : tickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '6rem 2rem', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>🎫</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Bạn chưa có vé nào</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Hãy tham gia các sự kiện hoành tráng cùng TicketZone ngay hôm nay!</p>
            <button className="btn-neon" onClick={() => router.push('/')} style={{ padding: '0.6rem 1.5rem', fontSize: '0.9rem' }}>
              Khám phá sự kiện
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: '2rem' }}>
            {tickets.map((ticket) => {
              const categoryColor = categoryColors[ticket.seat.category] || '#6B7280';
              return (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  style={{
                    display: 'flex',
                    background: 'rgba(28, 28, 30, 0.65)',
                    borderRadius: 16,
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(10px)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.borderColor = 'rgba(188, 19, 254, 0.3)';
                    e.currentTarget.style.boxShadow = '0 12px 40px rgba(188, 19, 254, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4)';
                  }}
                >
                  {/* Left part: Banner & Info */}
                  <div style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRight: '1px dashed rgba(255, 255, 255, 0.15)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: 4, background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)' }}>
                          {getCategoryLabel(ticket.event.category)}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: 4, background: `${categoryColor}15`, color: categoryColor, border: `1px solid ${categoryColor}30` }}>
                          {ticket.seat.category}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3 }}>
                        {ticket.event.name}
                      </h3>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>📅</span> {formatEventDate(ticket.event.eventDate, true)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span>📍</span> {ticket.event.location || 'Hồ Chí Minh'}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>MÃ VÉ</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'monospace', color: '#fff' }}>{ticket.id.slice(0, 8).toUpperCase()}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--neon-purple)', fontWeight: 600 }}>Chi tiết →</span>
                    </div>
                  </div>

                  {/* Right part: Seat Info & QR code */}
                  <div style={{ width: 140, padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase' }}>GHẾ</span>
                      <span style={{ fontSize: '1.8rem', fontWeight: 900, color: categoryColor, textShadow: `0 0 10px ${categoryColor}40` }}>
                        {ticket.seat.seatCode}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.2rem' }}>Hàng {ticket.seat.row} - Cột {ticket.seat.col}</span>
                    </div>

                    {/* Simulating QR Code */}
                    <div style={{ background: '#fff', padding: '0.4rem', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                      <svg width="60" height="60" viewBox="0 0 29 29" style={{ shapeRendering: 'crispEdges' }}>
                        <path d="M0 0h7v7H0zm22 0h7v7h-7zM0 22h7v7H0zm9-22h2v2H9zm4 0h2v4h-2zm3 0h2v2h-2zm-3 6h2v2h-2zm5 0h2v2h-2zm-9 3h2v2H9zm3 0h4v2h-4zm5 0h2v4h-2zm-5 4h2v2h-2zm3 0h4v2h-4zm5 0h2v2h-2zm-13 4h2v2H9zm3 0h2v2h-2zm3 0h2v2h-2zm4 0h4v2h-4z" fill="#0f0f0f" />
                      </svg>
                    </div>
                  </div>

                  {/* Simulated Ticket Holes at top/bottom border */}
                  <div style={{ position: 'absolute', width: 16, height: 16, borderRadius: '50%', backgroundColor: '#0f0f0f', right: 132, top: -8, border: '1px solid rgba(255, 255, 255, 0.05)', boxSizing: 'border-box' }} />
                  <div style={{ position: 'absolute', width: 16, height: 16, borderRadius: '50%', backgroundColor: '#0f0f0f', right: 132, bottom: -8, border: '1px solid rgba(255, 255, 255, 0.05)', boxSizing: 'border-box' }} />
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <div
          onClick={() => setSelectedTicket(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 450, background: 'linear-gradient(to bottom, #1e1e24, #121215)',
              borderRadius: 24, border: '1px solid rgba(188, 19, 254, 0.25)', boxShadow: '0 20px 50px rgba(188, 19, 254, 0.2)',
              overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative',
            }}
          >
            {/* Modal Header Banner */}
            <div style={{ height: 120, position: 'relative', overflow: 'hidden' }}>
              <img
                src={selectedTicket.event.bannerUrl || 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?q=80&w=600&auto=format&fit=crop'}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, #1e1e24)' }} />
              <button
                onClick={() => setSelectedTicket(null)}
                style={{
                  position: 'absolute', top: '1rem', right: '1rem', width: 30, height: 30, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', fontSize: '1.1rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem 2rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
              {/* Event Name */}
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: categoryColors[selectedTicket.seat.category], textTransform: 'uppercase', letterSpacing: 1 }}>
                  Vé Điện Tử ({selectedTicket.seat.category})
                </span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', marginTop: '0.4rem', lineHeight: 1.3 }}>
                  {selectedTicket.event.name}
                </h2>
              </div>

              {/* simulated QR code */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ background: '#fff', padding: '1rem', borderRadius: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="150" height="150" viewBox="0 0 29 29" style={{ shapeRendering: 'crispEdges' }}>
                    <path d="M0 0h7v7H0zm22 0h7v7h-7zM0 22h7v7H0zm9-22h2v2H9zm4 0h2v4h-2zm3 0h2v2h-2zm-3 6h2v2h-2zm5 0h2v2h-2zm-9 3h2v2H9zm3 0h4v2h-4zm5 0h2v4h-2zm-5 4h2v2h-2zm3 0h4v2h-4zm5 0h2v2h-2zm-13 4h2v2H9zm3 0h2v2h-2zm3 0h2v2h-2zm4 0h4v2h-4z" fill="#0f0f0f" />
                  </svg>
                </div>
                <span style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--text-secondary)', letterSpacing: 1.5 }}>
                  ID: {selectedTicket.id.toUpperCase()}
                </span>
              </div>

              {/* Ticket Information Table */}
              <div style={{ width: '100%', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Khách hàng</span>
                  <span style={{ fontWeight: 600, color: '#fff' }}>{selectedTicket.buyerName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Liên hệ</span>
                  <span style={{ fontWeight: 600, color: '#fff' }}>{selectedTicket.buyerPhone}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Hàng & Ghế</span>
                  <span style={{ fontWeight: 700, color: categoryColors[selectedTicket.seat.category] }}>Hàng {selectedTicket.seat.row} - Ghế {selectedTicket.seat.seatCode}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Giá vé</span>
                  <span style={{ fontWeight: 700, color: '#fff' }}>{Number(selectedTicket.seat.price).toLocaleString('vi-VN')} đ</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Ngày mua</span>
                  <span style={{ fontWeight: 600, color: '#fff' }}>{new Date(selectedTicket.purchasedAt).toLocaleDateString('vi-VN')}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>📍 Địa điểm</span>
                  <span style={{ fontWeight: 600, color: '#fff' }}>{selectedTicket.event.location || 'Hồ Chí Minh'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>📅 Thời gian sự kiện</span>
                  <span style={{ fontWeight: 600, color: '#fff' }}>{formatEventDate(selectedTicket.event.eventDate)}</span>
                </div>
              </div>

              {/* Instructions text */}
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textAlign: 'center', lineHeight: 1.4, margin: 0 }}>
                * Vui lòng xuất trình mã QR này tại quầy soát vé để được vào cổng.<br />
                Mỗi vé chỉ có giá trị cho một lượt quét.
              </p>

              {/* Action Button */}
              <button
                onClick={() => setSelectedTicket(null)}
                style={{
                  width: '100%', padding: '0.75rem', background: 'var(--neon-purple)', border: 'none', borderRadius: 10,
                  color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'background 0.2s',
                  boxShadow: '0 0 15px var(--neon-purple-glow)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#a110d9'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--neon-purple)'}
              >
                Đóng vé
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
