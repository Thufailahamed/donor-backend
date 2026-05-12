'use client';

import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import { Notification } from '@/types';
import { HiOutlineMegaphone, HiOutlinePaperAirplane, HiOutlineClock } from 'react-icons/hi2';

export default function NotificationPanel() {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    try {
      const res = await apiClient.get('/notifications');
      setHistory(res.data.notifications || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const sendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) { showToast('error', 'Title and message required'); return; }
    setSending(true);
    try {
      await apiClient.post('/notifications/broadcast', { title, message, type });
      showToast('success', 'Broadcast sent');
      setTitle(''); setMessage(''); setType('info');
      fetchHistory();
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Failed to send');
    } finally { setSending(false); }
  };

  const typeColor = (t: string) => {
    switch (t) {
      case 'warning': return { bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' };
      case 'error': return { bg: '#FEE2E2', color: '#DC2626', border: '#FECACA' };
      default: return { bg: '#DBEAFE', color: '#2563EB', border: '#BFDBFE' };
    }
  };

  return (
    <div style={{ display: 'flex', gap: '24px' }}>
      {/* Broadcast Form */}
      <div style={{ flex: 1, background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <HiOutlineMegaphone size={20} style={{ color: '#2563EB' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Send Broadcast</h3>
        </div>
        <form onSubmit={sendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Broadcast title..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '14px', outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Write your message..." rows={4}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '14px', outline: 'none', resize: 'vertical' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>Type</label>
            <select value={type} onChange={e => setType(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '14px', background: '#fff' }}>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Urgent</option>
            </select>
          </div>
          <button type="submit" disabled={sending} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '12px', borderRadius: '8px', border: 'none',
            background: sending ? '#93C5FD' : '#2563EB', color: '#fff',
            fontSize: '14px', fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer',
          }}>
            <HiOutlinePaperAirplane size={16} />
            {sending ? 'Sending...' : 'Send Broadcast'}
          </button>
        </form>
      </div>

      {/* History */}
      <div style={{ flex: 1, background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <HiOutlineClock size={20} style={{ color: '#64748B' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Notification History</h3>
        </div>
        {loading ? (
          <p style={{ color: '#94A3B8', fontSize: '14px' }}>Loading...</p>
        ) : history.length === 0 ? (
          <p style={{ color: '#94A3B8', fontSize: '14px' }}>No notifications yet</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
            {history.map(n => {
              const tc = typeColor(n.type);
              return (
                <div key={n.id} style={{ padding: '14px', borderRadius: '10px', border: `1px solid ${tc.border}`, background: tc.bg }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: tc.color }}>{n.title}</span>
                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#475569' }}>{n.message}</p>
                  <span style={{ display: 'inline-block', marginTop: '8px', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>{n.type}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
