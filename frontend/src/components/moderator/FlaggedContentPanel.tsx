'use client';
import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import { FlaggedContentItem } from '@/types';
import { HiOutlineExclamationTriangle, HiOutlineCheckCircle, HiOutlineTrash } from 'react-icons/hi2';

export default function FlaggedContentPanel() {
  const { showToast } = useToast();
  const [items, setItems] = useState<FlaggedContentItem[]>([]);

  useEffect(() => { fetchFlagged(); }, []);

  const fetchFlagged = async () => {
    try {
      const res = await apiClient.get('/flagged-content', { params: { isResolved: 'false' } });
      setItems(res.data.flagged);
    } catch { /* silent */ }
  };

  const resolve = async (id: string, action: 'APPROVE' | 'DELETE') => {
    try {
      await apiClient.put(`/flagged-content/${id}/resolve`, { action });
      showToast('success', action === 'APPROVE' ? 'Question approved' : 'Question deleted');
      fetchFlagged();
    } catch { showToast('error', 'Failed to resolve'); }
  };

  const sevColor = (s: string) => s === 'HIGH' ? '#DC2626' : s === 'MEDIUM' ? '#D97706' : '#2563EB';

  if (items.length === 0) return null;

  return (
    <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #FCA5A5', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <HiOutlineExclamationTriangle size={20} style={{ color: '#DC2626' }} />
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#DC2626' }}>Flagged Content ({items.length})</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map(f => (
          <div key={f.id} style={{ padding: '12px', background: '#FEF2F2', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>{f.question?.text || 'Question deleted'}</p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, background: `${sevColor(f.severity)}15`, color: sevColor(f.severity) }}>{f.severity}</span>
                <span style={{ fontSize: '11px', color: '#94A3B8' }}>{f.reason}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => resolve(f.id, 'APPROVE')} title="Approve" style={{ padding: '6px 10px', background: '#ECFDF5', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#059669', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}><HiOutlineCheckCircle size={14} /> Approve</button>
              <button onClick={() => resolve(f.id, 'DELETE')} title="Delete" style={{ padding: '6px 10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', cursor: 'pointer', color: '#DC2626', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}><HiOutlineTrash size={14} /> Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
