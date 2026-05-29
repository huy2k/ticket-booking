'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

interface Event {
  id: string;
  name: string;
  description: string;
  saleStartAt: string | null;
  totalSeats: number;
  location: string | null;
  eventDate: string | null;
  bannerUrl: string | null;
  category: string | null;
}

export default function HomePage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState('all');

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005/api';

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    setIsLoggedIn(!!token);

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
        router.push(`/seat-selection?eventId=${eventId}&bookingId=${data.bookingId}`);
      } else {
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

  const filteredEvents = useMemo(() => {
    if (activeTab === 'all') return events;
    return events.filter((e) => e.category === activeTab);
  }, [events, activeTab]);

  const getCategoryMeta = (category: string | null) => {
    switch (category) {
      case 'music':
        return { label: '🎵 Âm nhạc', color: '#bc13fe', bg: 'rgba(188, 19, 254, 0.15)' };
      case 'theater':
        return { label: '🎭 Kịch nói', color: '#ff007f', bg: 'rgba(255, 0, 127, 0.15)' };
      case 'sports':
        return { label: '🏃 Thể thao', color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.15)' };
      case 'workshop':
        return { label: '🏺 Workshop', color: '#ffb300', bg: 'rgba(255, 179, 0, 0.15)' };
      default:
        return { label: '🎟️ Sự kiện', color: '#a0a0a0', bg: 'rgba(160, 160, 160, 0.15)' };
    }
  };

  const formatEventDate = (dateStr: string | null) => {
    if (!dateStr) return 'Đang cập nhật';
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMinPrice = (category: string | null) => {
    switch (category) {
      case 'music':
        return '600.000 đ';
      case 'theater':
        return '200.000 đ';
      case 'sports':
        return '500.000 đ';
      case 'workshop':
        return '250.000 đ';
      default:
        return '200.000 đ';
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', color: '#f0f0f0' }}>
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 2.5rem',
          borderBottom: '1px solid rgba(188,19,254,0.15)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(15,15,15,0.85)',
        }}
      >
        <div style={{ fontWeight: 900, fontSize: '1.5rem', color: 'var(--neon-purple)', display: 'flex', alignItems: 'center', gap: '0.5rem', letterSpacing: '0.5px' }}>
          <span style={{ fontSize: '1.75rem' }}>🎟️</span> TicketZone
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              style={{
                background: 'transparent',
                border: '1px solid rgba(188,19,254,0.4)',
                color: 'var(--text-secondary)',
                borderRadius: 8,
                padding: '0.5rem 1.2rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(188, 19, 254, 0.1)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              Đăng xuất
            </button>
          ) : (
            <button className="btn-neon" onClick={() => router.push('/login')} style={{ padding: '0.5rem 1.5rem', fontSize: '0.875rem', borderRadius: 8 }}>
              Đăng nhập
            </button>
          )}
        </div>
      </nav>

      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: '5rem 2rem 4rem',
          textAlign: 'center',
          backgroundImage: 'linear-gradient(rgba(15, 15, 15, 0.4), #0f0f0f), url("https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=1400&auto=format&fit=crop")',
          backgroundSize: 'cover',
          backgroundPosition: 'center 30%',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(to bottom, rgba(15,15,15,0.7) 0%, rgba(15,15,15,1) 95%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 800, margin: '0 auto' }}>
          <span
            style={{
              background: 'rgba(188, 19, 254, 0.2)',
              border: '1px solid rgba(188, 19, 254, 0.4)',
              borderRadius: '20px',
              padding: '0.35rem 1rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: '#df7aff',
              display: 'inline-block',
              marginBottom: '1.5rem',
            }}
          >
            🔥 Đang được săn đón nhiều nhất
          </span>
          <h1
            style={{
              fontSize: 'clamp(2.25rem, 6vw, 3.5rem)',
              fontWeight: 950,
              lineHeight: 1.1,
              marginBottom: '1rem',
              background: 'linear-gradient(135deg, #ffffff 30%, #e074ff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.5px',
            }}
          >
            Mua Vé Sự Kiện & Giải Trí
          </h1>
          <p style={{ color: '#b0b0b0', fontSize: '1.15rem', marginBottom: '2.5rem', maxWidth: 620, margin: '0 auto 2.5rem', lineHeight: 1.6 }}>
            Trải nghiệm hệ thống đặt vé thông minh, xếp hàng ảo công bằng, không bỏ lỡ những đêm diễn tuyệt vời nhất Việt Nam.
          </p>

          {error && (
            <div
              style={{
                background: 'rgba(244, 67, 54, 0.1)',
                border: '1px solid var(--error)',
                borderRadius: '8px',
                padding: '0.75rem 1.5rem',
                color: '#ff8a80',
                fontSize: '0.9rem',
                maxWidth: 480,
                margin: '0 auto 1.5rem',
                fontWeight: 500,
              }}
            >
              ⚠️ {error}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem 5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.75rem',
            marginBottom: '3rem',
            flexWrap: 'wrap',
            background: 'rgba(30, 30, 30, 0.5)',
            padding: '0.5rem',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.05)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {[
            { id: 'all', label: '✨ Tất cả' },
            { id: 'music', label: '🎵 Âm nhạc' },
            { id: 'theater', label: '🎭 Kịch nghệ' },
            { id: 'sports', label: '🏃 Thể thao' },
            { id: 'workshop', label: '🏺 Workshop' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: isActive ? 'var(--neon-purple)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.6rem 1.5rem',
                  fontSize: '0.95rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 0 12px var(--neon-purple-glow)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '5rem 0', color: 'var(--text-secondary)' }}>
            <div
              style={{
                width: 40,
                height: 40,
                border: '3px solid rgba(188,19,254,0.15)',
                borderTop: '3px solid var(--neon-purple)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            <span>Đang tải danh sách sự kiện...</span>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📭</span>
            Chưa có sự kiện nào trong danh mục này. Quay lại sau nhé!
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '2rem',
            }}
          >
            {filteredEvents.map((event) => {
              const saleDate = event.saleStartAt
                ? new Date(event.saleStartAt).toLocaleString('vi-VN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Sắp công bố';

              const isJoining = joiningId === event.id;
              const startTime = event.saleStartAt ? new Date(event.saleStartAt).getTime() : 0;
              const isNotYetStarted = startTime > now;
              const catMeta = getCategoryMeta(event.category);

              return (
                <div
                  key={event.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 0,
                    overflow: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.03)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-6px)';
                    e.currentTarget.style.borderColor = 'rgba(188, 19, 254, 0.3)';
                    e.currentTarget.style.boxShadow = '0 12px 30px rgba(188, 19, 254, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.03)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
                  }}
                >
                  <div style={{ position: 'relative', width: '100%', height: '180px', overflow: 'hidden' }}>
                    <img
                      src={event.bannerUrl || 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?q=80&w=600&auto=format&fit=crop'}
                      alt={event.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s' }}
                    />
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(37,37,37,0.95) 100%)' }} />

                    <span
                      style={{
                        position: 'absolute',
                        top: '1rem',
                        left: '1rem',
                        backgroundColor: catMeta.bg,
                        color: catMeta.color,
                        border: `1px solid ${catMeta.color}80`,
                        borderRadius: '6px',
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      {catMeta.label}
                    </span>
                  </div>

                  <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1, backgroundColor: 'var(--bg-card)' }}>
                    <h3
                      style={{
                        fontSize: '1.2rem',
                        fontWeight: 800,
                        marginBottom: '0.75rem',
                        color: '#ffffff',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        height: '3.3rem',
                      }}
                    >
                      {event.name}
                    </h3>
                    <p
                      style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.875rem',
                        marginBottom: '1.25rem',
                        lineHeight: 1.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        height: '2.6rem',
                      }}
                    >
                      {event.description}
                    </p>

                    <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem', color: '#b0b0b0' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1rem' }}>📅</span>
                        <span>Thời gian: {formatEventDate(event.eventDate)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1rem' }}>📍</span>
                        <span style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {event.location || 'Hồ Chí Minh'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        <span>⏱️ Mở bán vé:</span>
                        <span style={{ color: isNotYetStarted ? '#ff9800' : 'var(--success)', fontWeight: 600 }}>
                          {isNotYetStarted ? `Sắp mở bán (${saleDate})` : 'Đang mở bán'}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 'auto',
                        paddingTop: '1.25rem',
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Giá từ</span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ff2d7a' }}>{getMinPrice(event.category)}</span>
                      </div>

                      <button
                        className="btn-neon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBuyTicket(event.id);
                        }}
                        disabled={isJoining || joiningId !== null || isNotYetStarted}
                        style={{
                          fontSize: '0.9rem',
                          padding: '0.5rem 1.25rem',
                          minHeight: '40px',
                          borderRadius: '8px',
                          opacity: (joiningId !== null && !isJoining) || isNotYetStarted ? 0.4 : 1,
                        }}
                      >
                        {isJoining ? 'Đang xếp hàng...' : isNotYetStarted ? 'Chưa mở bán' : '🎫 Mua vé'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div
          style={{
            marginTop: '6rem',
            padding: '3rem 2rem',
            background: 'rgba(30, 30, 30, 0.4)',
            borderRadius: '24px',
            border: '1px solid rgba(188, 19, 254, 0.1)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, textAlign: 'center', marginBottom: '2.5rem', color: '#fff', letterSpacing: '0.5px' }}>
            ⚡ Trải Nghiệm Đặt Vé Đỉnh Cao Tại TicketZone
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '2.5rem',
              textAlign: 'center',
            }}
          >
            {[
              { icon: '⚖️', title: 'Hàng Đợi Ảo Công Bằng', desc: 'Hệ thống xếp hàng FIFO (First In First Out) đảm bảo cơ hội mua vé chia đều và minh bạch cho mọi người hâm mộ.' },
              { icon: '🔌', title: 'Cập Nhật Thời Gian Thực', desc: 'Sơ đồ ghế và vị trí hàng đợi được đồng bộ hóa tức thì thông qua giao thức kết nối Socket.IO tốc độ cao.' },
              { icon: '🛡️', title: 'Chống Bán Quá Số Lượng', desc: 'Hệ thống giữ vị trí và khóa ghế thông minh trong 10 phút để đảm bảo không xảy ra tình trạng bán trùng vé.' },
              { icon: '🔁', title: 'Duy Trì Trạng Thái', desc: 'Yên tâm mua sắm, trạng thái vị trí hàng đợi của bạn được lưu trữ an toàn kể cả khi bạn vô tình tải lại trang web.' },
            ].map((feature, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '2.5rem', marginBottom: '1rem', display: 'block' }}>{feature.icon}</span>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem', color: '#fff' }}>{feature.title}</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
