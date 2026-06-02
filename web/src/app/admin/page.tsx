'use client';

import { useEffect, useState } from 'react';

interface Stats {
  totalUsers: number;
  totalEvents: number;
  totalTickets: number;
  totalRevenue: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    fetch(`${API}/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async r => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(data.message || 'Lỗi tải thống kê hệ thống');
        }
        return data;
      })
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Lỗi kết nối đến máy chủ');
        setLoading(false);
      });
  }, [API]);

  const cards = stats ? [
    { icon: '👥', label: 'Người dùng', value: stats.totalUsers?.toLocaleString() || '0', color: '#7C3AED' },
    { icon: '🎵', label: 'Sự kiện', value: stats.totalEvents?.toLocaleString() || '0', color: '#2563EB' },
    { icon: '🎫', label: 'Vé đã bán', value: stats.totalTickets?.toLocaleString() || '0', color: '#059669' },
    {
      icon: '💰',
      label: 'Doanh thu',
      value: `${Number(stats.totalRevenue || 0).toLocaleString('vi-VN')}đ`,
      color: '#D97706',
    },
  ] : [];

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>📊 Dashboard</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.875rem' }}>
        Tổng quan hệ thống TicketZone
      </p>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Đang tải...</p>
      ) : error ? (
        <div style={{
          padding: '1.5rem',
          background: 'rgba(255,59,48,0.1)',
          border: '1px solid rgba(255,59,48,0.2)',
          borderRadius: 8,
          color: '#FF3B30',
          marginBottom: '2rem',
          fontSize: '0.9rem'
        }}>
          ⚠️ {error}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          {cards.map(({ icon, label, value, color }) => (
            <div
              key={label}
              className="card"
              style={{
                padding: '1.5rem',
                borderLeft: `3px solid ${color}`,
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{icon}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>{value}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '3rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          Thao tác nhanh
        </h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { href: '/admin/events', label: '+ Tạo sự kiện mới' },
            { href: '/admin/users', label: '👥 Quản lý users' },
            { href: '/admin/tickets', label: '🎫 Xem vé đã bán' },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="btn-neon"
              style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-block' }}
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
