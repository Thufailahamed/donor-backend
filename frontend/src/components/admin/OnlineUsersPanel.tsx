'use client';
import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import { getSocket } from '@/lib/socket';
import { OnlineUsersData } from '@/types';
import { HiOutlineSignal, HiOutlineUsers, HiOutlineArrowTrendingUp } from 'react-icons/hi2';

export default function OnlineUsersPanel() {
  const { showToast } = useToast();
  const [data, setData] = useState<OnlineUsersData | null>(null);

  useEffect(() => {
    fetchData();
    const socket = getSocket();
    const handler = () => fetchData();
    socket.on('online-users-updated', handler);
    return () => { socket.off('online-users-updated', handler); };
  }, []);

  const fetchData = async () => {
    try {
      const res = await apiClient.get('/online-users');
      setData(res.data);
    } catch { /* silent */ }
  };

  if (!data) return <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { icon: <HiOutlineSignal size={24} />, label: 'Online Now', value: data.onlineCount, color: '#059669', bg: '#ECFDF5' },
          { icon: <HiOutlineArrowTrendingUp size={24} />, label: 'Peak Concurrent', value: data.peakConcurrent, color: '#2563EB', bg: '#EEF2FF' },
          { icon: <HiOutlineUsers size={24} />, label: 'Active Sessions', value: data.sessions.length, color: '#7C3AED', bg: '#F5F3FF' },
        ].map((m, i) => (
          <div key={i} style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ color: m.color, background: m.bg, padding: '8px', borderRadius: '8px' }}>{m.icon}</div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>{m.label}</span>
            </div>
            <p style={{ fontSize: '32px', fontWeight: 800, color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Online Users</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
            {data.users.length === 0 && <div style={{ color: '#94A3B8', padding: '20px', textAlign: 'center' }}>No users online</div>}
            {data.users.map((u, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px' }}>
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>{u.name}</span>
                  <span style={{ marginLeft: '8px', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, background: '#EEF2FF', color: '#4F46E5' }}>{u.role}</span>
                </div>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
                  <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>Online</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Session Participants</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.sessions.length === 0 && <div style={{ color: '#94A3B8', padding: '20px', textAlign: 'center' }}>No active sessions</div>}
            {data.sessions.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{s.sessionTitle}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#2563EB' }}>{s.count} users</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
