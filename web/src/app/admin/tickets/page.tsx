'use client';

import { useEffect, useState, useCallback } from 'react';

interface Ticket {
  id: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  paymentRef: string | null;
  purchasedAt: string;
  user: { email: string | null; phone: string | null };
  event: { name: string };
  seat: { seatCode: string; category: string; price: string };
}

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

  const fetchTickets = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${API}/admin/tickets`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setTickets(data.tickets || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [API]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const thStyle: React.CSSProperties = {
    padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem',
    color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase',
    letterSpacing: '0.05em', borderBottom: '1px solid rgba(188,19,254,0.12)',
    whiteSpace: 'nowrap',
  };
  const tdStyle: React.CSSProperties = {
    padding: '0.75rem 1rem', fontSize: '0.8rem',
    borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap',
  };

  const categoryColor: Record<string, string> = {
    VVIP: '#BC13FE',
    VIP: '#2563EB',
    GOLD: '#D97706',
    SILVER: '#6B7280',
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>🎫 Vé đã bán</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Tổng: {total} vé</p>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {loading ? (
          <p style={{ padding: '2rem', color: 'var(--text-secondary)' }}>Đang tải...</p>
        ) : tickets.length === 0 ? (
          <p style={{ padding: '2rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Chưa có vé nào được bán</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr>
                <th style={thStyle}>Người mua</th>
                <th style={thStyle}>Sự kiện</th>
                <th style={thStyle}>Ghế</th>
                <th style={thStyle}>Giá</th>
                <th style={thStyle}>Mã GD</th>
                <th style={thStyle}>Ngày mua</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(ticket => (
                <tr key={ticket.id}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{ticket.buyerName}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{ticket.buyerEmail}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{ticket.buyerPhone}</div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: 'var(--text-primary)' }}>{ticket.event.name}</span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{
                        display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: 4,
                        fontSize: '0.7rem', fontWeight: 700,
                        background: `${categoryColor[ticket.seat.category] || '#6B7280'}20`,
                        color: categoryColor[ticket.seat.category] || '#6B7280',
                      }}>
                        {ticket.seat.category}
                      </span>
                      <span style={{ fontWeight: 600 }}>{ticket.seat.seatCode}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: '#059669', fontWeight: 600 }}>
                      {Number(ticket.seat.price).toLocaleString('vi-VN')}đ
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {ticket.paymentRef?.slice(-8) || '—'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {new Date(ticket.purchasedAt).toLocaleString('vi-VN', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
