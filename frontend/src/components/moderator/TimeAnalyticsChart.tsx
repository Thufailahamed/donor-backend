'use client';
import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { TimeSeriesPoint, EngagementTimelinePoint } from '@/types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

export default function TimeAnalyticsChart({ sessionId }: { sessionId?: string }) {
  const [data, setData] = useState<EngagementTimelinePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [sessionId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (sessionId) params.sessionId = sessionId;
      const res = await apiClient.get('/analytics/engagement-timeline', { params });
      setData(res.data.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  if (loading || data.length === 0) return null;

  const fmtTime = (t: string) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Engagement Timeline</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data.map(d => ({ ...d, time: fmtTime(d.time) }))}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#94A3B8" />
          <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" />
          <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          <Bar dataKey="questions" fill="#7C3AED" name="Questions" radius={[2, 2, 0, 0]} />
          <Bar dataKey="upvotes" fill="#2563EB" name="Upvotes" radius={[2, 2, 0, 0]} />
          <Bar dataKey="feedback" fill="#D97706" name="Feedback" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
