'use client';
import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import { getSocket } from '@/lib/socket';
import { ActivityLogEntry } from '@/types';
import { HiOutlineChatBubbleLeftRight, HiOutlineHandThumbUp, HiOutlineArrowRightOnRectangle, HiOutlineArrowLeftOnRectangle, HiOutlineTrash, HiOutlineStar, HiOutlineSignal, HiOutlineFunnel } from 'react-icons/hi2';

const actionConfig: Record<string, { icon: any; color: string; label: string }> = {
  LOGIN: { icon: HiOutlineArrowRightOnRectangle, color: '#059669', label: 'Logged in' },
  LOGOUT: { icon: HiOutlineArrowLeftOnRectangle, color: '#DC2626', label: 'Logged out' },
  SOCKET_CONNECT: { icon: HiOutlineSignal, color: '#059669', label: 'Connected' },
  SOCKET_DISCONNECT: { icon: HiOutlineSignal, color: '#94A3B8', label: 'Disconnected' },
  JOIN_SESSION: { icon: HiOutlineArrowRightOnRectangle, color: '#2563EB', label: 'Joined session' },
  LEAVE_SESSION: { icon: HiOutlineArrowLeftOnRectangle, color: '#F59E0B', label: 'Left session' },
  ASK_QUESTION: { icon: HiOutlineChatBubbleLeftRight, color: '#7C3AED', label: 'Asked a question' },
  UPVOTE: { icon: HiOutlineHandThumbUp, color: '#2563EB', label: 'Upvoted' },
  SUBMIT_FEEDBACK: { icon: HiOutlineStar, color: '#D97706', label: 'Submitted feedback' },
  CHANGE_STATUS: { icon: HiOutlineFunnel, color: '#0891B2', label: 'Changed status' },
  DELETE_QUESTION: { icon: HiOutlineTrash, color: '#DC2626', label: 'Deleted question' },
};

export default function ActivityFeedPanel() {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
    const socket = getSocket();
    const handler = (entry: ActivityLogEntry) => setLogs(prev => [entry, ...prev].slice(0, 100));
    socket.on('new-activity', handler);
    return () => { socket.off('new-activity', handler); };
  }, []);

  const fetchLogs = async () => {
    try {
      const params: any = { limit: '50' };
      if (filter) params.action = filter;
      const res = await apiClient.get('/activity-logs', { params });
      setLogs(res.data.logs);
    } catch { showToast('error', 'Failed to load activity'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, [filter]);

  const fmtTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['', 'LOGIN', 'ASK_QUESTION', 'UPVOTE', 'JOIN_SESSION', 'SUBMIT_FEEDBACK'].map(a => (
          <button key={a} onClick={() => setFilter(a)} style={{
            padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
            background: filter === a ? '#2563EB' : '#F1F5F9', color: filter === a ? '#fff' : '#475569',
            fontSize: '12px', fontWeight: 600, transition: 'all 0.15s',
          }}>{a || 'All'}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '600px', overflowY: 'auto' }}>
        {logs.map((log, i) => {
          const cfg = actionConfig[log.action] || { icon: HiOutlineSignal, color: '#64748B', label: log.action };
          const Icon = cfg.icon;
          return (
            <div key={log.id} style={{ display: 'flex', gap: '12px', padding: '12px 16px', background: '#fff', borderRadius: i === 0 ? '12px 12px 0 0' : 0, borderBottom: '1px solid #F1F5F9', alignItems: 'center' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: `${cfg.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} style={{ color: cfg.color }} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '13px' }}><strong>{log.userName}</strong> <span style={{ color: cfg.color, fontWeight: 600 }}>{cfg.label}</span></span>
                {log.details && <span style={{ fontSize: '12px', color: '#94A3B8', marginLeft: '6px' }}>({log.details})</span>}
              </div>
              <span style={{ fontSize: '12px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmtTime(log.createdAt)}</span>
            </div>
          );
        })}
        {logs.length === 0 && !loading && <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>No activity yet</div>}
      </div>
    </div>
  );
}
