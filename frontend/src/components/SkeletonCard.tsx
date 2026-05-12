'use client';

interface SkeletonProps {
  count?: number;
}

const shimmerStyle = {
  background: 'linear-gradient(90deg, #F1F5F9 25%, #E8EDF2 50%, #F1F5F9 75%)',
  backgroundSize: '200% 100%',
  animation: 'skeleton-shimmer 1.4s ease-in-out infinite',
  borderRadius: '6px',
};

export default function SkeletonCard({ count = 3 }: SkeletonProps) {
  return (
    <>
      <style>{`
        @keyframes skeleton-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            padding: '20px 24px',
            border: '1px solid #E2E8F0',
            marginBottom: '12px',
            opacity: 1 - i * 0.15,
          }}
        >
          {/* Avatar + Name row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ ...shimmerStyle, width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ ...shimmerStyle, height: '13px', width: '120px', marginBottom: '6px' }} />
              <div style={{ ...shimmerStyle, height: '11px', width: '70px' }} />
            </div>
          </div>

          {/* Text lines */}
          <div style={{ ...shimmerStyle, height: '14px', width: '100%', marginBottom: '8px' }} />
          <div style={{ ...shimmerStyle, height: '14px', width: '85%', marginBottom: '16px' }} />

          {/* Bottom action row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <div style={{ ...shimmerStyle, height: '32px', width: '80px', borderRadius: '8px' }} />
            <div style={{ ...shimmerStyle, height: '32px', width: '60px', borderRadius: '8px' }} />
          </div>
        </div>
      ))}
    </>
  );
}
