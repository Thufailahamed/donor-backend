'use client';
import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import { AccessLog } from '@/types';
import { HiOutlineMagnifyingGlass, HiOutlineFunnel, HiOutlineComputerDesktop, HiOutlineDevicePhoneMobile, HiOutlineClock } from 'react-icons/hi2';

export default function AccessLogPanel() {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchLogs(); }, [page, roleFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: any = { page: String(page), limit: '20' };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const res = await apiClient.get('/access-logs', { params });
      setLogs(res.data.logs);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch { showToast('error', 'Failed to load access logs'); }
    finally { setLoading(false); }
  };

  const handleSearch = () => { setPage(1); fetchLogs(); };

  const actionIcon = (action: string) => {
    if (action.includes('LOGIN') || action.includes('CONNECT')) return { color: '#059669', label: 'Login' };
    if (action.includes('LOGOUT') || action.includes('DISCONNECT')) return { color: '#DC2626', label: 'Logout' };
    return { color: '#2563EB', label: action };
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <HiOutlineMagnifyingGlass size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="Search by name..." style={{ width: '100%', padding: '10px 12px 10px 38px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px' }} />
        </div>
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }} style={{ padding: '10px 16px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', background: '#fff' }}>
          <option value="">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="MODERATOR">Moderator</option>
          <option value="SPEAKER">Speaker</option>
          <option value="PARTICIPANT">Participant</option>
        </select>
        <button onClick={handleSearch} style={{ padding: '10px 20px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Search</button>
      </div>

      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #E2E8F0', background: '#F8FAFC' }}>
              {['Name', 'Role', 'IP Address', 'Device', 'Action', 'Login Time', 'Logout Time'].map(h => (
                <th key={h} style={{ padding: '14px 16px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => {
              const ai = actionIcon(log.action);
              return (
                <tr key={log.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 ? '#F8FAFC' : '#fff' }}>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600 }}>{log.name}</td>
                  <td style={{ padding: '12px 16px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: '#EEF2FF', color: '#4F46E5' }}>{log.role || '-'}</span></td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748B', fontFamily: 'monospace' }}>{log.ipAddress || '-'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {log.deviceType === 'mobile' ? <HiOutlineDevicePhoneMobile size={14} /> : <HiOutlineComputerDesktop size={14} />}
                      {log.deviceType || '-'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: `${ai.color}15`, color: ai.color }}>{ai.label}</span></td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>{log.loginAt ? new Date(log.loginAt).toLocaleString() : '-'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>{log.logoutAt ? new Date(log.logoutAt).toLocaleString() : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {logs.length === 0 && !loading && <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>No access logs found</div>}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '8px 16px', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}>Prev</button>
          <span style={{ padding: '8px 16px', fontWeight: 600, fontSize: '13px' }}>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '8px 16px', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1 }}>Next</button>
        </div>
      )}
    </div>
  );
}
