'use client';
import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { SystemHealth } from '@/types';
import { HiOutlineSignal, HiOutlineCircleStack, HiOutlineBolt, HiOutlineExclamationTriangle, HiOutlineGlobeAlt } from 'react-icons/hi2';

export default function SystemHealthPanel() {
  const [health, setHealth] = useState<SystemHealth | null>(null);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchHealth = async () => {
    try { const res = await apiClient.get('/health/detailed'); setHealth(res.data); } catch { /* silent */ }
  };

  if (!health) return <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>Loading health data...</div>;

  const statusColor = (ok: boolean) => ok ? '#059669' : '#DC2626';
  const metricColor = (val: number, warn: number, bad: number) => val < warn ? '#059669' : val < bad ? '#D97706' : '#DC2626';

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { icon: <HiOutlineBolt size={24} />, label: 'API Response', value: `${health.api.avgResponseTimeMs.toFixed(1)}ms`, color: metricColor(health.api.avgResponseTimeMs, 100, 500), bg: '#F8FAFC' },
          { icon: <HiOutlineExclamationTriangle size={24} />, label: 'Error Rate', value: `${(health.api.errorRate * 100).toFixed(2)}%`, color: metricColor(health.api.errorRate, 0.01, 0.05), bg: '#F8FAFC' },
          { icon: <HiOutlineGlobeAlt size={24} />, label: 'Requests/min', value: String(health.api.requestsPerMinute), color: '#2563EB', bg: '#EEF2FF' },
          { icon: <HiOutlineSignal size={24} />, label: 'Socket Users', value: `${health.socket.connectedUsers} / ${health.socket.peakConcurrent} peak`, color: '#7C3AED', bg: '#F5F3FF' },
          { icon: <HiOutlineCircleStack size={24} />, label: 'DB Latency', value: `${health.database.latencyMs.toFixed(1)}ms`, color: metricColor(health.database.latencyMs, 10, 50), bg: '#F8FAFC' },
        ].map((m, i) => (
          <div key={i} style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ color: m.color }}>{m.icon}</div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>{m.label}</span>
            </div>
            <p style={{ fontSize: '24px', fontWeight: 800, color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>System Overview</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: statusColor(health.status === 'ok'), margin: '0 auto 8px' }} />
            <p style={{ fontSize: '13px', fontWeight: 600 }}>Server: {health.status}</p>
            <p style={{ fontSize: '12px', color: '#94A3B8' }}>Uptime: {Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m</p>
          </div>
          <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', fontWeight: 600 }}>Total Requests: {health.api.totalRequests}</p>
            <p style={{ fontSize: '12px', color: '#94A3B8' }}>Total Errors: {health.api.totalErrors}</p>
          </div>
          <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', fontWeight: 600 }}>Active Rooms: {health.socket.activeRooms}</p>
            <p style={{ fontSize: '12px', color: '#94A3B8' }}>Database: {health.database.status}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
