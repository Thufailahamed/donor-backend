'use client';
import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { getSocket } from '@/lib/socket';
import { Session } from '@/types';

export default function SessionQueuePanel({ onSessionSelect }: { onSessionSelect: (id: string) => void }) {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    fetchSessions();
    const socket = getSocket();
    const handler = () => fetchSessions();
    socket.on('session-status-changed', handler);
    return () => { socket.off('session-status-changed', handler); };
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await apiClient.get('/sessions');
      setSessions(res.data.sessions);
    } catch { /* silent */ }
  };

  const fmtTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
      <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#475569' }}>Session Queue</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {sessions.map(s => (
          <button key={s.id} onClick={() => onSessionSelect(s.id)} style={{
            padding: '8px 10px', borderRadius: '6px', border: s.isActive ? '1px solid #059669' : '1px solid transparent',
            background: s.isActive ? '#ECFDF5' : 'transparent', textAlign: 'left', cursor: 'pointer',
            fontSize: '12px', fontWeight: 600, color: s.isActive ? '#059669' : '#475569',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{s.title}</span>
              {s.isActive && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669', animation: 'pulse 2s infinite' }} />}
            </div>
            <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 400, marginTop: '2px' }}>{fmtTime(s.startTime)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
