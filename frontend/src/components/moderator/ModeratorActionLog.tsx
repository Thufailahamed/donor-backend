'use client';
import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { ModeratorActionLogEntry } from '@/types';
import { HiOutlineClipboardDocumentList } from 'react-icons/hi2';

export default function ModeratorActionLog() {
  const [logs, setLogs] = useState<ModeratorActionLogEntry[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    try {
      const res = await apiClient.get('/moderator-logs', { params: { limit: '20' } });
      setLogs(res.data.logs);
    } catch { /* silent */ }
  };

  if (logs.length === 0) return null;

  return (
    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', marginBottom: '20px' }}>
      <button onClick={() => setExpanded(!expanded)} style={{
        width: '100%', padding: '16px 20px', background: 'none', border: 'none',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HiOutlineClipboardDocumentList size={20} style={{ color: '#64748B' }} />
          <span style={{ fontSize: '14px', fontWeight: 700 }}>Action Log ({logs.length})</span>
        </div>
        <span style={{ fontSize: '12px', color: '#94A3B8' }}>{expanded ? 'Hide' : 'Show'}</span>
      </button>
      {expanded && (
        <div style={{ borderTop: '1px solid #E2E8F0', maxHeight: '300px', overflowY: 'auto' }}>
          {logs.map(l => (
            <div key={l.id} style={{ padding: '10px 20px', borderBottom: '1px solid #F1F5F9', fontSize: '13px' }}>
              <span style={{ fontWeight: 600 }}>{l.moderatorName}</span>
              <span style={{ color: '#64748B' }}> {l.action.replace(/_/g, ' ').toLowerCase()} </span>
              {l.targetType && <span style={{ color: '#94A3B8', fontSize: '12px' }}>({l.targetType})</span>}
              <span style={{ float: 'right', color: '#94A3B8', fontSize: '11px' }}>{new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
