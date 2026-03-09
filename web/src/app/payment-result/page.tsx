'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function PaymentResultContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [message, setMessage] = useState('');

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

  useEffect(() => {
    const verify = async () => {
      try {
        // Forward all VNPay query params to backend for verification
        const queryString = params.toString();
        const res = await fetch(`${API}/payment/vnpay_verify?${queryString}`);
        const data = await res.json();

        if (data.RspCode === '00') {
          setStatus('success');
          setMessage('Thanh toán thành công! Vé của bạn đã được xác nhận.');
        } else {
          setStatus('failed');
          setMessage(data.Message || 'Thanh toán không thành công. Vui lòng thử lại.');
        }
      } catch {
        setStatus('failed');
        setMessage('Không thể kết nối hệ thống xác minh. Vui lòng liên hệ hỗ trợ.');
      }
    };

    if (params.toString()) {
      verify();
    } else {
      setStatus('failed');
      setMessage('Không tìm thấy thông tin thanh toán.');
    }
  }, [params, API]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>
        {status === 'loading' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Đang xác minh thanh toán...
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Vui lòng chờ trong giây lát
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                marginBottom: '0.75rem',
                color: 'var(--neon-purple)',
              }}
            >
              Thanh toán thành công!
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem', lineHeight: 1.6 }}>
              {message}
            </p>

            <div
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 12,
                padding: '1.25rem',
                marginBottom: '2rem',
                border: '1px solid rgba(188,19,254,0.2)',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                Mã giao dịch
              </div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', fontFamily: 'monospace', color: 'var(--neon-purple)' }}>
                {params.get('vnp_TxnRef') || '—'}
              </div>
            </div>

            <button
              className="btn-neon"
              onClick={() => router.push('/')}
              style={{ width: '100%', padding: '0.8rem' }}
            >
              ← Về trang chủ
            </button>
          </>
        )}

        {status === 'failed' && (
          <>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>😔</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--error)' }}>
              Thanh toán thất bại
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem', lineHeight: 1.6 }}>
              {message}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
              <button
                className="btn-neon"
                onClick={() => router.push('/')}
                style={{ width: '100%', padding: '0.8rem' }}
              >
                ← Thử lại từ đầu
              </button>
              <button
                onClick={() => router.push('/')}
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  background: 'transparent',
                  border: '1px solid rgba(188,19,254,0.3)',
                  color: 'var(--text-secondary)',
                  borderRadius: 10,
                  cursor: 'pointer',
                }}
              >
                Về trang chủ
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Đang tải...</p>
        </div>
      }
    >
      <PaymentResultContent />
    </Suspense>
  );
}
