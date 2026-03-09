'use client';

import { useState, useCallback, useEffect } from 'react';

export interface Seat {
  id: string;
  seatCode: string;
  row: string;
  col: number;
  category: string;
  price: number;
  status: 'AVAILABLE' | 'PENDING' | 'SOLD';
  x?: number | null;
  y?: number | null;
  color?: string | null;
}

interface SeatMapProps {
  seats: Seat[];
  onSeatToggle: (seat: Seat) => void;
  selectedIds: Set<string>;
  mapConfig?: any;
}

function getSeatColor(seat: Seat, isSelected: boolean): string {
  if (isSelected) return '#bc13fe';
  switch (seat.status) {
    case 'SOLD':
      return '#424242';
    case 'PENDING':
      return '#6a006a';
    default:
      return '#e0e0e0';
  }
}

export function SeatMap({ seats, onSeatToggle, selectedIds, mapConfig }: SeatMapProps) {
  // Check nếu sơ đồ dùng toạ độ tuyệt đối
  const isCoordinateMode = seats.some(s => s.x != null && s.y != null);

  const rows = Array.from(new Set(seats.map((s) => s.row))).sort();
  const maxCol = seats.length > 0 ? Math.max(...seats.map((s) => s.col)) : 0;

  const SEAT_SIZE = 32;
  const SEAT_GAP = 6;
  const ROW_LABEL_W = 28;
  
  // Kích thước SVG
  const svgWidth = isCoordinateMode && mapConfig?.width ? mapConfig.width : ROW_LABEL_W + (SEAT_SIZE + SEAT_GAP) * maxCol;
  const svgHeight = isCoordinateMode && mapConfig?.height ? mapConfig.height : (SEAT_SIZE + SEAT_GAP) * rows.length + 40; // +40 for stage

  const seatByRC = new Map(seats.map((s) => [`${s.row}-${s.col}`, s]));

  return (
    <div style={{ width: '100%', overflowX: 'auto', touchAction: 'pinch-zoom' }}>
      {/* Stage */}
      <div
        style={{
          textAlign: 'center',
          margin: '0 auto 1.5rem',
          background: 'linear-gradient(135deg, #2a0040 0%, #bc13fe22 100%)',
          border: '1px solid rgba(188,19,254,0.3)',
          borderRadius: 8,
          padding: '0.5rem 2rem',
          maxWidth: 320,
          color: 'var(--text-secondary)',
          letterSpacing: '0.15em',
          fontSize: '0.8rem',
          textTransform: 'uppercase',
        }}
      >
        🎤 SÂN KHẤU
      </div>

      <div style={{ position: 'relative', overflowX: 'auto', textAlign: 'center' }}>
        <svg
          width={svgWidth}
          height={svgHeight}
          style={{ 
            display: 'block', 
            margin: '0 auto',
            backgroundImage: mapConfig?.bgImage ? `url(${mapConfig.bgImage})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: isCoordinateMode ? 'rgba(0,0,0,0.1)' : 'transparent',
            borderRadius: 8
          }}
        >
          {isCoordinateMode ? (
            // ================= MODE TỌA ĐỘ =================
            <g>
              {seats.map(seat => {
                const isSelected = selectedIds.has(seat.id);
                const isDisabled = seat.status === 'SOLD';
                const color = seat.color && !isSelected && seat.status !== 'SOLD' && seat.status !== 'PENDING' ? seat.color : getSeatColor(seat, isSelected);
                // Giả định x,y là tọa độ tâm
                const cx = seat.x ?? 0;
                const cy = seat.y ?? 0;

                return (
                  <g key={seat.id}>
                    <rect
                      x={cx - SEAT_SIZE / 2}
                      y={cy - SEAT_SIZE / 2}
                      width={SEAT_SIZE}
                      height={SEAT_SIZE}
                      rx={6}
                      fill={color}
                      opacity={isDisabled ? 0.45 : 1}
                      style={{ cursor: isDisabled ? 'not-allowed' : 'pointer', transition: 'fill 0.2s' }}
                      onClick={() => !isDisabled && onSeatToggle(seat)}
                    />
                    {isSelected && (
                      <text x={cx} y={cy + 4} textAnchor="middle" fill="#fff" fontSize={10} fontFamily="Inter">
                        ✓
                      </text>
                    )}
                    <title>
                      {seat.seatCode} – {seat.category} –{' '}
                      {seat.status === 'SOLD' ? 'Đã bán' : seat.status === 'PENDING' ? 'Đang giữ' : `${Number(seat.price).toLocaleString()}đ`}
                    </title>
                  </g>
                );
              })}
            </g>
          ) : (
            // ================= MODE MXN =================
            rows.map((row, ri) => (
              <g key={row}>
                {/* Row label */}
                <text
                  x={ROW_LABEL_W / 2}
                  y={ri * (SEAT_SIZE + SEAT_GAP) + SEAT_SIZE / 2 + 4}
                  textAnchor="middle"
                  fill="#a0a0a0"
                  fontSize={11}
                  fontFamily="Inter, sans-serif"
                >
                  {row}
                </text>

                {/* Seats */}
                {Array.from({ length: maxCol }, (_, ci) => {
                  const col = ci + 1;
                  const seat = seatByRC.get(`${row}-${col}`);
                  if (!seat) return null;

                  const isSelected = selectedIds.has(seat.id);
                  const isDisabled = seat.status === 'SOLD';
                  const cx = ROW_LABEL_W + ci * (SEAT_SIZE + SEAT_GAP) + SEAT_SIZE / 2;
                  const cy = ri * (SEAT_SIZE + SEAT_GAP) + SEAT_SIZE / 2;
                  const color = getSeatColor(seat, isSelected);

                  return (
                    <g key={seat.id}>
                      <rect
                        x={cx - SEAT_SIZE / 2}
                        y={cy - SEAT_SIZE / 2}
                        width={SEAT_SIZE}
                        height={SEAT_SIZE}
                        rx={6}
                        fill={color}
                        opacity={isDisabled ? 0.45 : 1}
                        style={{ cursor: isDisabled ? 'not-allowed' : 'pointer', transition: 'fill 0.2s' }}
                        onClick={() => !isDisabled && onSeatToggle(seat)}
                      />
                      {isSelected && (
                        <text x={cx} y={cy + 4} textAnchor="middle" fill="#fff" fontSize={10} fontFamily="Inter">
                          ✓
                        </text>
                      )}
                      <title>
                        {seat.seatCode} – {seat.category} –{' '}
                        {seat.status === 'SOLD' ? 'Đã bán' : seat.status === 'PENDING' ? 'Đang giữ' : `${Number(seat.price).toLocaleString()}đ`}
                      </title>
                    </g>
                  );
                })}
              </g>
            ))
          )}
        </svg>
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: '1.5rem',
          justifyContent: 'center',
          marginTop: '1.5rem',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          flexWrap: 'wrap',
        }}
      >
        {[
          { color: '#e0e0e0', label: 'Trống' },
          { color: '#bc13fe', label: 'Đang chọn' },
          { color: '#6a006a', label: 'Đang giữ' },
          { color: '#424242', label: 'Đã bán' },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: color, display: 'inline-block' }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
