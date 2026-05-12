'use client';

import { useEffect } from 'react';

export default function SessionError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('Session error:', error);
  }, [error]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', padding: '2rem',
      textAlign: 'center', color: '#1E293B',
    }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Session Error
      </h2>
      <p style={{ color: '#64748B', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        This session encountered an error. Please try again or return to the agenda.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
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
        <a
          href="/agenda"
          style={{
            padding: '10px 24px', borderRadius: '10px',
            border: '1px solid #CBD5E1', background: '#fff', color: '#334155',
            fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none',
          }}
        >
          Back to Agenda
        </a>
      </div>
    </div>
  );
}
