'use client';

import { useEffect } from 'react';

export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('Admin error:', error);
  }, [error]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', padding: '2rem',
      textAlign: 'center', color: '#1E293B',
    }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Admin Dashboard Error
      </h2>
      <p style={{ color: '#64748B', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        The admin panel encountered an error. Please try again.
      </p>
      <button
        onClick={() => unstable_retry()}
        style={{
          padding: '10px 24px', borderRadius: '10px', border: 'none',
          background: '#2563EB', color: '#fff', fontWeight: 600,
          fontSize: '0.875rem', cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}
