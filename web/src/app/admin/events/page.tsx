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
  mapMode: 'grid' as 'grid' | 'coordinate' | 'svg',
  rows: 10,
  cols: 12,
  prices: { vvip: 2500000, vip: 1500000, gold: 800000, silver: 500000 },
  seatsConfigJson: '',
  mapConfigJson: '',
  ticketLimits: { vvip: 20, vip: 40, gold: 60, silver: 100 },
  zonesJson: '',
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
      
      let mapMode: 'grid' | 'coordinate' | 'svg' = 'grid';
      let rows = 10;
      let cols = 12;
      let prices = { vvip: 2500000, vip: 1500000, gold: 800000, silver: 500000 };
      let seatsConfigJson = '';
      let ticketLimits = { vvip: 20, vip: 40, gold: 60, silver: 100 };
      let zonesJson = '';
      
      if (data.mapConfig?.mapMode === 'svg') {
        mapMode = 'svg';
        ticketLimits = data.mapConfig.ticketLimits || ticketLimits;
        if (data.mapConfig.zones) {
          zonesJson = JSON.stringify(data.mapConfig.zones, null, 2);
        }
        const getPrice = (cat: string) => {
          const seat = data.seats?.find((s: any) => s.category.toUpperCase() === cat);
          return seat ? Number(seat.price) : prices[cat.toLowerCase() as keyof typeof prices];
        };
        prices.vvip = getPrice('VVIP');
        prices.vip = getPrice('VIP');
        prices.gold = getPrice('GOLD');
        prices.silver = getPrice('SILVER');
      } else if (data.mapConfig || (data.seats && data.seats.some((s: any) => s.x !== null && s.y !== null))) {
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
        ticketLimits,
        zonesJson,
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
    } else if (form.mapMode === 'svg') {
      let zones = [];
      if (form.zonesJson.trim()) {
        try {
          zones = JSON.parse(form.zonesJson);
        } catch {
          alert('JSON cấu hình vùng SVG không hợp lệ. Vui lòng kiểm tra lại!');
          setSubmitting(false);
          return;
        }
      }
      payload.mapConfig = {
        mapMode: 'svg',
        ticketLimits: form.ticketLimits,
        zones,
      };
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

  const loadDefaultSvgZones = () => {
    const defaultZones = [
      { id: 'cat3a', name: 'CAT 3A', category: 'SILVER', color: '#6b7280', shape: 'rect', x: 50, y: 20, width: 90, height: 80, rx: 6 },
      { id: 'cat3b', name: 'CAT 3B', category: 'SILVER', color: '#6b7280', shape: 'rect', x: 860, y: 20, width: 90, height: 80, rx: 6 },
      { id: 'cat2a', name: 'CAT 2A', category: 'SILVER', color: '#f97316', shape: 'rect', x: 50, y: 110, width: 90, height: 140, rx: 6 },
      { id: 'ga2a', name: 'GA 2A', category: 'SILVER', color: '#fdba74', shape: 'rect', x: 150, y: 90, width: 60, height: 160, rx: 6 },
      { id: 'ga1a', name: 'GA 1A', category: 'SILVER', color: '#f472b6', shape: 'rect', x: 220, y: 90, width: 60, height: 160, rx: 6 },
      { id: 'fanzone1a', name: 'FANZONE 1A', category: 'SILVER', color: '#94a3b8', shape: 'rect', x: 290, y: 90, width: 80, height: 100, rx: 6 },
      { id: 'fanzone2a', name: 'FANZONE 2A', category: 'SILVER', color: '#cbd5e1', shape: 'rect', x: 290, y: 200, width: 100, height: 50, rx: 6 },
      { id: 'fanzone1b', name: 'FANZONE 1B', category: 'SILVER', color: '#94a3b8', shape: 'rect', x: 630, y: 90, width: 80, height: 100, rx: 6 },
      { id: 'fanzone2b', name: 'FANZONE 2B', category: 'SILVER', color: '#cbd5e1', shape: 'rect', x: 610, y: 200, width: 100, height: 50, rx: 6 },
      { id: 'ga1b', name: 'GA 1B', category: 'SILVER', color: '#f472b6', shape: 'rect', x: 720, y: 90, width: 60, height: 160, rx: 6 },
      { id: 'ga2b', name: 'GA 2B', category: 'SILVER', color: '#fdba74', shape: 'rect', x: 790, y: 90, width: 60, height: 160, rx: 6 },
      { id: 'cat2b', name: 'CAT 2B', category: 'SILVER', color: '#f97316', shape: 'rect', x: 860, y: 110, width: 90, height: 140, rx: 6 },
      { id: 'ozone', name: 'OZONE', category: 'GOLD', color: '#a855f7', shape: 'circle', cx: 500, cy: 170, r: 50 },
      { id: 'vipa', name: 'VIP A', category: 'VIP', color: '#ea580c', shape: 'rect', x: 70, y: 270, width: 240, height: 50, rx: 8 },
      { id: 'svipa', name: 'SVIP A', category: 'VVIP', color: '#2563eb', shape: 'rect', x: 320, y: 270, width: 110, height: 50, rx: 8 },
      { id: 'skylounge', name: 'SKY LOUNGE', category: 'VVIP', color: '#eab308', shape: 'rect', x: 440, y: 270, width: 120, height: 50, rx: 8 },
      { id: 'svipb', name: 'SVIP B', category: 'VVIP', color: '#22c55e', shape: 'rect', x: 570, y: 270, width: 110, height: 50, rx: 8 },
      { id: 'vipb', name: 'VIP B', category: 'VIP', color: '#ea580c', shape: 'rect', x: 690, y: 270, width: 240, height: 50, rx: 8 },
      { id: 'cat1a', name: 'CAT 1A', category: 'GOLD', color: '#06b6d4', shape: 'rect', x: 70, y: 340, width: 360, height: 50, rx: 8 },
      { id: 'foh', name: 'FOH', category: 'GOLD', color: '#4b5563', shape: 'rect', x: 440, y: 340, width: 120, height: 50, rx: 8 },
      { id: 'cat1b', name: 'CAT 1B', category: 'GOLD', color: '#06b6d4', shape: 'rect', x: 570, y: 340, width: 360, height: 50, rx: 8 }
    ];
    setForm(f => ({ ...f, zonesJson: JSON.stringify(defaultZones, null, 2) }));
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
                      <option value="grid">Mặc định (Matrix Grid)</option>
                      <option value="svg">Sân khấu SVG (Chọn vùng mua nhanh)</option>
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
                  ) : form.mapMode === 'svg' ? (
                    <>
                      <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: '1rem', border: '1px solid rgba(188,19,254,0.1)' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>🎫 Thiết lập Số vé tối đa & Giá vé theo hạng</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {(['vvip', 'vip', 'gold', 'silver'] as const).map(tier => (
                            <div key={tier} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'center' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Số vé {tier} tối đa *</label>
                                <input type="number" style={inputStyle} min={0} value={form.ticketLimits[tier]}
                                  onChange={e => setForm(f => ({ ...f, ticketLimits: { ...f.ticketLimits, [tier]: Number(e.target.value) } }))} />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Giá vé {tier} (VNĐ) *</label>
                                <input type="number" style={inputStyle} value={form.prices[tier]}
                                  onChange={e => setForm(f => ({ ...f, prices: { ...f.prices, [tier]: Number(e.target.value) } }))} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ marginTop: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Cấu hình toạ độ các vùng SVG (JSON) *
                          </label>
                          <button
                            type="button"
                            onClick={loadDefaultSvgZones}
                            style={{
                              background: 'rgba(188,19,254,0.08)', border: '1px solid var(--neon-purple)',
                              color: 'var(--neon-purple)', borderRadius: 6, padding: '0.25rem 0.6rem',
                              fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(188,19,254,0.15)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(188,19,254,0.08)'}
                          >
                            ⚡ Tải cấu hình mẫu
                          </button>
                        </div>
                        <textarea
                          style={{ ...inputStyle, minHeight: 140, fontFamily: 'monospace', fontSize: '0.78rem', resize: 'vertical' }}
                          value={form.zonesJson}
                          onChange={e => setForm(f => ({ ...f, zonesJson: e.target.value }))}
                          placeholder={`[\n  { "id": "vipa", "name": "VIP A", "category": "VIP", "color": "#ea580c", "shape": "rect", "x": 70, "y": 270, "width": 240, "height": 50 }\n]`}
                          required
                        />
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                        📐 Tổng số vé cho sơ đồ SVG: <strong>{Number(form.ticketLimits.vvip || 0) + Number(form.ticketLimits.vip || 0) + Number(form.ticketLimits.gold || 0) + Number(form.ticketLimits.silver || 0)}</strong> vé
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
