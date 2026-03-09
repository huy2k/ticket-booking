'use client';

import { useEffect, useState, useCallback } from 'react';

interface User {
  id: string;
  email: string | null;
  phone: string | null;
  role: string;
  createdAt: string;
  _count: { tickets: number };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

  const fetchUsers = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${API}/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setUsers(data.users || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [API]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleDelete = async (id: string, email: string | null) => {
    if (!confirm(`Xoá user "${email || id}"? Hành động này không thể hoàn tác.`)) return;
    setDeleting(id);
    const token = localStorage.getItem('auth_token');
    await fetch(`${API}/admin/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await fetchUsers();
    setDeleting(null);
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
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>👥 Người dùng</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Tổng: {total} người dùng</p>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: '2rem', color: 'var(--text-secondary)' }}>Đang tải...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Email / Phone</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Vé đã mua</th>
                <th style={thStyle}>Ngày tạo</th>
                <th style={thStyle}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 500 }}>{user.email || '—'}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{user.phone || ''}</div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: 6, fontSize: '0.75rem',
                      background: user.role === 'ADMIN' ? 'rgba(188,19,254,0.15)' : 'rgba(255,255,255,0.06)',
                      color: user.role === 'ADMIN' ? 'var(--neon-purple)' : 'var(--text-secondary)',
                    }}>
                      {user.role}
                    </span>
                  </td>
                  <td style={tdStyle}>{user._count.tickets}</td>
                  <td style={tdStyle}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {user.role !== 'ADMIN' && (
                      <button
                        onClick={() => handleDelete(user.id, user.email)}
                        disabled={deleting === user.id}
                        style={{
                          padding: '0.35rem 0.75rem', background: 'transparent',
                          border: '1px solid rgba(255,59,48,0.4)', color: '#FF3B30',
                          borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem',
                        }}
                      >
                        {deleting === user.id ? '...' : '🗑 Xoá'}
                      </button>
                    )}
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
