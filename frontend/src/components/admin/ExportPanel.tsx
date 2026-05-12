'use client';
import { useState } from 'react';
import apiClient from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import { HiOutlineArrowDownTray, HiOutlineDocument, HiOutlineChartBar, HiOutlineUsers } from 'react-icons/hi2';

export default function ExportPanel() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const download = async (url: string, filename: string, id: string) => {
    setLoading(id);
    try {
      const res = await apiClient.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      showToast('success', 'Download started');
    } catch { showToast('error', 'Download failed'); }
    finally { setLoading(null); }
  };

  const exports = [
    { id: 'attendance', icon: <HiOutlineUsers size={24} />, title: 'Attendance Report', desc: 'All users with login history, engagement data', url: '/export/report/attendance', file: 'attendance-report.csv', color: '#059669', bg: '#ECFDF5' },
    { id: 'analytics', icon: <HiOutlineChartBar size={24} />, title: 'Full Analytics Report', desc: 'Engagement metrics, sentiment, per-session breakdown', url: '/export/report/analytics-full', file: 'analytics-report.csv', color: '#2563EB', bg: '#EEF2FF' },
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {exports.map(e => (
          <div key={e.id} style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ color: e.color, background: e.bg, padding: '10px', borderRadius: '10px' }}>{e.icon}</div>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 700 }}>{e.title}</h4>
                <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>{e.desc}</p>
              </div>
            </div>
            <button onClick={() => download(e.url, e.file, e.id)} disabled={loading === e.id} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '12px', background: e.color, color: '#fff', border: 'none', borderRadius: '8px',
              fontWeight: 600, cursor: loading === e.id ? 'not-allowed' : 'pointer', opacity: loading === e.id ? 0.7 : 1,
            }}>
              <HiOutlineArrowDownTray size={18} /> {loading === e.id ? 'Downloading...' : 'Download CSV'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
