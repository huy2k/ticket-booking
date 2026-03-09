'use client';

import { useEffect, useState, useCallback } from 'react';

interface EventData {
  id: string;
  name: string;
  description: string | null;
  saleStartAt: string | null;
  totalSeats: number;
  createdAt: string;
  _count: { seats: number; tickets: number };
}

const defaultForm = {
  name: '',
  description: '',
  saleStartAt: '',
  mapMode: 'grid' as 'grid' | 'coordinate',
  rows: 10,
  cols: 12,
  prices: { vvip: 2500000, vip: 1500000, gold: 800000, silver: 500000 },
  seatsConfigJson: '',
  mapConfigJson: '',
};

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editEvent, setEditEvent] = useState<EventData | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

  const fetchEvents = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${API}/admin/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setEvents(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [API]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const openCreate = () => {
    setEditEvent(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEdit = async (ev: EventData) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API}/admin/events/${ev.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      
      let mapMode: 'grid' | 'coordinate' = 'grid';
      let rows = 10;
      let cols = 12;
      let prices = { vvip: 2500000, vip: 1500000, gold: 800000, silver: 500000 };
      let seatsConfigJson = '';
      
      if (data.mapConfig || (data.seats && data.seats.some((s: any) => s.x !== null && s.y !== null))) {
        mapMode = 'coordinate';
        seatsConfigJson = JSON.stringify(data.seats.map((s: any) => ({
          seatCode: s.seatCode,
          row: s.row,
          col: s.col,
          x: s.x,
          y: s.y,
          category: s.category,
          price: Number(s.price),
          color: s.color,
        })), null, 2);
      } else if (data.seats && data.seats.length > 0) {
        const rowCodes = data.seats.map((s: any) => s.row.charCodeAt(0));
        rows = Math.max(...rowCodes) - 64; // A is 65
        cols = Math.max(...data.seats.map((s: any) => s.col));
        
        const getPrice = (cat: string) => {
          const seat = data.seats.find((s: any) => s.category.toUpperCase() === cat);
          return seat ? Number(seat.price) : prices[cat.toLowerCase() as keyof typeof prices];
        };
        
        prices.vvip = getPrice('VVIP');
        prices.vip = getPrice('VIP');
        prices.gold = getPrice('GOLD');
        prices.silver = getPrice('SILVER');
      }
      
      setEditEvent(ev);
      setForm({
        name: data.name,
        description: data.description || '',
        saleStartAt: data.saleStartAt ? new Date(data.saleStartAt).toISOString().slice(0, 16) : '',
        mapMode,
        rows,
        cols,
        prices,
        mapConfigJson: data.mapConfig ? JSON.stringify(data.mapConfig, null, 2) : '',
        seatsConfigJson,
      });
      setShowModal(true);
    } catch (err) {
      alert('Lỗi khởi tạo màn hình sửa!');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const token = localStorage.getItem('auth_token');

    let payload: any = { ...form };
    if (form.mapMode === 'coordinate') {
      try {
        payload.seatsConfig = JSON.parse(form.seatsConfigJson || '[]');
        payload.mapConfig = form.mapConfigJson ? JSON.parse(form.mapConfigJson) : null;
      } catch (err) {
        alert('JSON không hợp lệ. Vui lòng kiểm tra lại!');
        setSubmitting(false);
        return;
      }
    }

    if (editEvent) {
      await fetch(`${API}/admin/events/${editEvent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`${API}/admin/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
    }

    setSubmitting(false);
    setShowModal(false);
    fetchEvents();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Xoá event "${name}"? Toàn bộ ghế và vé liên quan cũng bị xoá!`)) return;
    setDeleting(id);
    const token = localStorage.getItem('auth_token');
    await fetch(`${API}/admin/events/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await fetchEvents();
    setDeleting(null);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.65rem 1rem',
    background: 'var(--bg-surface)', border: '1px solid rgba(188,19,254,0.25)',
    borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none',
  };
  const thStyle: React.CSSProperties = {
    padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem',
    color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase',
    letterSpacing: '0.05em', borderBottom: '1px solid rgba(188,19,254,0.12)',
  };
  const tdStyle: React.CSSProperties = {
    padding: '0.875rem 1rem', fontSize: '0.875rem',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>🎵 Sự kiện</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Quản lý danh sách sự kiện và ghế ngồi</p>
        </div>
        <button className="btn-neon" onClick={openCreate} style={{ padding: '0.6rem 1.25rem', fontSize: '0.875rem' }}>
          + Tạo sự kiện
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: '2rem', color: 'var(--text-secondary)' }}>Đang tải...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Tên sự kiện</th>
                <th style={thStyle}>Ngày mở bán</th>
                <th style={thStyle}>Ghế</th>
                <th style={thStyle}>Vé bán</th>
                <th style={thStyle}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev.id}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{ev.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                      {ev.description?.slice(0, 60)}{ev.description && ev.description.length > 60 ? '...' : ''}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {ev.saleStartAt ? new Date(ev.saleStartAt).toLocaleDateString('vi-VN') : '—'}
                    </span>
                  </td>
                  <td style={tdStyle}>{ev._count.seats}</td>
                  <td style={tdStyle}>
                    <span style={{ color: '#059669', fontWeight: 600 }}>{ev._count.tickets}</span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => openEdit(ev)}
                        style={{
                          padding: '0.35rem 0.75rem', background: 'transparent',
                          border: '1px solid rgba(188,19,254,0.3)', color: 'var(--neon-purple)',
                          borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem',
                        }}
                      >
                        ✏️ Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(ev.id, ev.name)}
                        disabled={deleting === ev.id}
                        style={{
                          padding: '0.35rem 0.75rem', background: 'transparent',
                          border: '1px solid rgba(255,59,48,0.4)', color: '#FF3B30',
                          borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem',
                        }}
                      >
                        {deleting === ev.id ? '...' : '🗑 Xoá'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Create/Edit */}
      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 520, padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1.5rem' }}>
              {editEvent ? '✏️ Sửa sự kiện' : '🎵 Tạo sự kiện mới'}
            </h2>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Tên sự kiện *</label>
                <input type="text" style={inputStyle} required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="🎵 Concert Tên..." />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Mô tả</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Mô tả ngắn..." />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Ngày & Giờ mở bán</label>
                <input type="datetime-local" style={inputStyle} value={form.saleStartAt}
                  onChange={e => setForm(f => ({ ...f, saleStartAt: e.target.value }))} />
              </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Loại Sơ Đồ Ghế</label>
                    <select
                      style={inputStyle}
                      value={form.mapMode}
                      onChange={e => setForm(f => ({ ...f, mapMode: e.target.value as any }))}
                    >
                      <option value="grid">Grid (Hàng / Cột)</option>
                      <option value="coordinate">Toạ độ (JSON Config)</option>
                    </select>
                  </div>

                  {form.mapMode === 'grid' ? (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Số hàng ghế *</label>
                          <input type="number" style={inputStyle} min={1} max={26} value={form.rows}
                            onChange={e => setForm(f => ({ ...f, rows: Number(e.target.value) }))} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Số cột ghế *</label>
                          <input type="number" style={inputStyle} min={1} max={50} value={form.cols}
                            onChange={e => setForm(f => ({ ...f, cols: Number(e.target.value) }))} />
                        </div>
                      </div>
                      <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: '1rem', border: '1px solid rgba(188,19,254,0.1)' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>💰 Giá vé theo hạng (VNĐ)</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                          {(['vvip', 'vip', 'gold', 'silver'] as const).map(tier => (
                            <div key={tier}>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>{tier}</label>
                              <input type="number" style={inputStyle} value={form.prices[tier]}
                                onChange={e => setForm(f => ({ ...f, prices: { ...f.prices, [tier]: Number(e.target.value) } }))} />
                            </div>
                          ))}
                        </div>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        📐 Tổng số ghế: <strong>{form.rows * form.cols}</strong> ghế
                      </p>
                    </>
                  ) : (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Map Config (Background, Width, Height...)</label>
                        <textarea style={{ ...inputStyle, minHeight: 80, fontFamily: 'monospace', fontSize: '0.8rem' }} value={form.mapConfigJson}
                          onChange={e => setForm(f => ({ ...f, mapConfigJson: e.target.value }))} placeholder={`{"width": 800, "height": 600, "bgImage": "..."}`} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Mảng Ghế Ngồi Config (JSON)</label>
                        <textarea style={{ ...inputStyle, minHeight: 180, fontFamily: 'monospace', fontSize: '0.8rem' }} value={form.seatsConfigJson}
                          onChange={e => setForm(f => ({ ...f, seatsConfigJson: e.target.value }))} placeholder={`[\n  {"seatCode": "VVIP-1", "x": 100, "y": 200, "price": 5000000, "category": "VVIP"}\n]`} />
                      </div>
                    </>
                  )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: '1px solid rgba(188,19,254,0.3)', color: 'var(--text-secondary)', borderRadius: 10, cursor: 'pointer' }}>
                  Huỷ
                </button>
                <button type="submit" className="btn-neon" disabled={submitting} style={{ flex: 2, padding: '0.75rem' }}>
                  {submitting ? 'Đang lưu...' : editEvent ? 'Lưu thay đổi' : 'Tạo sự kiện'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
