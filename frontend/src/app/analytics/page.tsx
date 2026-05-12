'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useIsMobile } from '@/hooks/useIsMobile';
import apiClient from '@/lib/api-client';
import { Session, EngagementMetrics, SentimentData, TopicData } from '@/types';
import { format } from 'date-fns';
import { HiOutlineChartBar, HiOutlineArrowTrendingUp, HiOutlineFaceSmile, HiOutlineChatBubbleLeftRight, HiOutlineArrowLeft } from 'react-icons/hi2';
import Link from 'next/link';

export default function AnalyticsDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<EngagementMetrics | null>(null);
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [topics, setTopics] = useState<TopicData[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('all');
  const [heatmap, setHeatmap] = useState<{time: string, count: number}[]>([]);

  const isMobile = useIsMobile();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!user || !['ADMIN', 'MODERATOR'].includes(user.role)) {
      router.push('/login');
      return;
    }
    fetchData();
  }, [user]);

  useEffect(() => {
    if (selectedSession !== 'all') {
      fetchHeatmap(selectedSession);
    }
  }, [selectedSession]);

  const fetchData = async () => {
    try {
      const [mRes, sRes, tRes] = await Promise.all([
        apiClient.get('/analytics/engagement'),
        apiClient.get('/analytics/sentiment'),
        apiClient.get('/analytics/topics')
      ]);
      setMetrics(mRes.data);
      setSentiment(sRes.data.sentiment);
      setTopics(tRes.data.topics);
      if (mRes.data.sessions.length > 0) {
        setSelectedSession(mRes.data.sessions[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHeatmap = async (sessionId: string) => {
    try {
      const res = await apiClient.get(`/analytics/heatmap/${sessionId}`);
      setHeatmap(res.data.heatmap);
    } catch {}
  };

  useEffect(() => {
    if (heatmap.length > 0 && canvasRef.current) {
      drawHeatmap();
    }
  }, [heatmap]);

  const drawHeatmap = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    if (heatmap.length === 0) return;

    const maxCount = Math.max(...heatmap.map(h => h.count), 1);
    const barWidth = width / heatmap.length;
    
    heatmap.forEach((h, i) => {
      const barHeight = (h.count / maxCount) * (height - 40);
      const x = i * barWidth;
      const y = height - 20 - barHeight;
      
      // Gradient
      const grad = ctx.createLinearGradient(0, y, 0, height - 20);
      grad.addColorStop(0, '#3B82F6');
      grad.addColorStop(1, '#2563EB');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x + 2, y, barWidth - 4, barHeight, 4);
      ctx.fill();
      
      // Label (every 4th)
      if (i % 4 === 0) {
        ctx.fillStyle = '#94A3B8';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(format(new Date(h.time), 'HH:mm'), x + barWidth / 2, height - 5);
      }
    });
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Analytics...</div>;

  return (
    <div style={{ minHeight: '100vh', background: 'rgba(248,250,252,0.6)', padding: isMobile ? '16px' : '40px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        <header style={{ display: 'flex', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: '16px', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '40px' }}>
          <div>
            <Link href="/moderator" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', textDecoration: 'none', fontSize: '14px', marginBottom: '8px' }}>
              <HiOutlineArrowLeft /> Back to Dashboard
            </Link>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#0F172A' }}>Engagement Analytics</h1>
          </div>
          <div style={{ background: '#FFF', padding: '8px 16px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748B' }}>Session:</span>
            <select value={selectedSession} onChange={e => setSelectedSession(e.target.value)} style={{ border: 'none', fontWeight: 700, color: '#2563EB', outline: 'none', cursor: 'pointer' }}>
              {metrics?.sessions.map(s => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>
        </header>

        {/* Overview Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '40px' }}>
          <div style={{ background: '#FFF', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div style={{ width: '40px', height: '40px', background: '#DBEAFE', color: '#2563EB', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <HiOutlineChatBubbleLeftRight size={24} />
            </div>
            <p style={{ fontSize: '14px', color: '#64748B', fontWeight: 600 }}>Total Questions</p>
            <h3 style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A' }}>{metrics?.overview.totalQuestions}</h3>
          </div>
          <div style={{ background: '#FFF', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div style={{ width: '40px', height: '40px', background: '#DCFCE7', color: '#16A34A', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <HiOutlineFaceSmile size={24} />
            </div>
            <p style={{ fontSize: '14px', color: '#64748B', fontWeight: 600 }}>Avg. Sentiment</p>
            <h3 style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A' }}>{sentiment?.average} / 5</h3>
          </div>
          <div style={{ background: '#FFF', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div style={{ width: '40px', height: '40px', background: '#FEF3C7', color: '#D97706', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <HiOutlineArrowTrendingUp size={24} />
            </div>
            <p style={{ fontSize: '14px', color: '#64748B', fontWeight: 600 }}>Total Interactions</p>
            <h3 style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A' }}>{(metrics?.overview.totalQuestions||0) + (metrics?.overview.totalFeedback||0)}</h3>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '24px' }}>
          
          {/* Heatmap Chart */}
          <div style={{ background: '#FFF', padding: '32px', borderRadius: '24px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <HiOutlineChartBar size={24} style={{ color: '#2563EB' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Engagement Heatmap</h3>
            </div>
            <canvas ref={canvasRef} width={700} height={300} style={{ width: '100%', height: '300px' }} />
          </div>

          {/* Word Cloud / Topics */}
          <div style={{ background: '#FFF', padding: '32px', borderRadius: '24px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px' }}>Trending Topics</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {topics.map((t, i) => (
                <span key={i} style={{
                  padding: '6px 14px', background: '#F1F5F9', color: '#475569',
                  borderRadius: '20px', fontSize: `${Math.max(12, Math.min(24, 12 + t.count))}px`,
                  fontWeight: 600, transition: 'all 0.2s'
                }}>
                  {t.word}
                </span>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
