'use client';

import { useState, useMemo } from 'react';
import { Seat } from './SeatMap';

export interface ZoneConfig {
  id: string;
  name: string;
  category: string;
  color: string;
  shape: 'rect' | 'circle';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rx?: number;
  cx?: number;
  cy?: number;
  r?: number;
}

interface ZoneSvgMapProps {
  seats: Seat[];
  zones: ZoneConfig[];
  onZoneSelect: (zoneName: string, category: string, price: number, availableSeats: Seat[]) => void;
}

export function ZoneSvgMap({ seats, zones = [], onZoneSelect }: ZoneSvgMapProps) {
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Lọc số ghế trống và giá vé của từng vùng
  const zoneStats = useMemo(() => {
    const stats: Record<string, { total: number; available: Seat[]; price: number }> = {};

    zones.forEach(zone => {
      // Tìm ghế thuộc zone dựa trên category
      const zoneSeats = seats.filter(s => s.category.toUpperCase() === zone.category.toUpperCase());
      const available = zoneSeats.filter(s => s.status === 'AVAILABLE');
      // Lấy giá vé từ ghế đầu tiên hoặc gán giá mặc định nếu không có ghế
      const price = zoneSeats.length > 0 ? Number(zoneSeats[0].price) : 500000;

      stats[zone.id] = {
        total: zoneSeats.length,
        available,
        price
      };
    });

    return stats;
  }, [seats, zones]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleZoneClick = (zone: ZoneConfig) => {
    const stats = zoneStats[zone.id];
    if (stats) {
      onZoneSelect(zone.name, zone.category, stats.price, stats.available);
    }
  };

  return (
    <div style={{ width: '100%', position: 'relative', textAlign: 'center' }}>
      <div
        onMouseMove={handleMouseMove}
        style={{
          width: '100%',
          maxWidth: 960,
          margin: '0 auto',
          position: 'relative',
          background: '#09090b',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          padding: '1rem'
        }}
      >
        <svg
          viewBox="0 0 1000 440"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          {/* STAGE */}
          <g>
            <rect x="380" y="20" width="240" height="45" fill="#3f3f46" rx="4" />
            <text x="500" y="48" fill="#fff" fontSize="18" fontWeight="800" textAnchor="middle" fontFamily="Inter, sans-serif" letterSpacing="2">
              STAGE
            </text>
          </g>

          {/* Ozone Link Path (Lối đi nối giữa stage và ozone) */}
          <rect x="488" y="65" width="24" height="60" fill="#3f3f46" />

          {/* Map through Zones */}
          {zones.map((zone) => {
            const stats = zoneStats[zone.id];
            const isHovered = hoveredZone === zone.id;
            const isEmpty = stats ? stats.available.length === 0 : true;

            const baseStyle: React.CSSProperties = {
              cursor: isEmpty ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease-in-out',
            };

            const fillOpacity = isEmpty ? 0.25 : (isHovered ? 0.9 : 0.7);
            const strokeColor = isHovered ? '#fff' : 'rgba(255,255,255,0.15)';
            const strokeWidth = isHovered ? 2 : 1;

            return (
              <g
                key={zone.id}
                onMouseEnter={() => setHoveredZone(zone.id)}
                onMouseLeave={() => setHoveredZone(null)}
                onClick={() => !isEmpty && handleZoneClick(zone)}
                style={baseStyle}
              >
                {zone.shape === 'rect' ? (
                  <rect
                    x={zone.x}
                    y={zone.y}
                    width={zone.width}
                    height={zone.height}
                    rx={zone.rx || 0}
                    fill={zone.color}
                    fillOpacity={fillOpacity}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    style={{ transition: 'all 0.2s' }}
                  />
                ) : (
                  <circle
                    cx={zone.cx}
                    cy={zone.cy}
                    r={zone.r}
                    fill={zone.color}
                    fillOpacity={fillOpacity}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    style={{ transition: 'all 0.2s' }}
                  />
                )}

                {/* Text label */}
                {zone.shape === 'rect' ? (
                  <text
                    x={(zone.x || 0) + (zone.width || 0) / 2}
                    y={(zone.y || 0) + (zone.height || 0) / 2 + 5}
                    fill={isEmpty ? '#888' : '#fff'}
                    fontSize="11"
                    fontWeight="800"
                    textAnchor="middle"
                    fontFamily="Inter, sans-serif"
                    pointerEvents="none"
                  >
                    {zone.name}
                  </text>
                ) : (
                  <text
                    x={zone.cx}
                    y={(zone.cy || 0) + 4}
                    fill={isEmpty ? '#888' : '#fff'}
                    fontSize="11"
                    fontWeight="800"
                    textAnchor="middle"
                    fontFamily="Inter, sans-serif"
                    pointerEvents="none"
                  >
                    {zone.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Custom Rich Tooltip */}
        {hoveredZone && (
          <div
            style={{
              position: 'absolute',
              left: mousePos.x + 20,
              top: mousePos.y + 20,
              background: 'rgba(15,15,20,0.92)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(188,19,254,0.3)',
              borderRadius: 12,
              padding: '0.75rem 1rem',
              color: '#fff',
              fontSize: '0.8rem',
              pointerEvents: 'none',
              textAlign: 'left',
              zIndex: 100,
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            }}
          >
            {(() => {
              const zone = zones.find(z => z.id === hoveredZone);
              const stats = zoneStats[hoveredZone];
              if (!zone || !stats) return null;
              return (
                <>
                  <strong style={{ color: zone.color, fontSize: '0.9rem' }}>{zone.name}</strong>
                  <span>Hạng vé: {zone.category}</span>
                  <span>Giá: <strong style={{ color: 'var(--neon-purple)' }}>{stats.price.toLocaleString()}đ</strong></span>
                  <span>Còn trống: <strong style={{ color: stats.available.length > 0 ? '#22c55e' : '#ef4444' }}>{stats.available.length} / {stats.total}</strong></span>
                  {stats.available.length === 0 && <span style={{ color: '#ef4444', fontWeight: 'bold', marginTop: '0.2rem' }}>⚠️ ĐÃ HẾT VÉ</span>}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Mini Color Legend */}
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        {zones.filter((v, i, a) => a.findIndex(t => t.category === v.category) === i).map(zone => (
          <span key={zone.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: zone.color, display: 'inline-block', opacity: 0.8 }} />
            {zone.category}
          </span>
        ))}
      </div>
    </div>
  );
}
