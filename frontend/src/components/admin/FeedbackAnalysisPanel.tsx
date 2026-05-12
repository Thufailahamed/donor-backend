'use client';

import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import { Feedback, Session } from '@/types';
import { HiOutlineChatBubbleLeftRight, HiOutlineStar, HiOutlineFaceSmile, HiOutlineFaceFrown, HiOutlineMinus } from 'react-icons/hi2';

export default function FeedbackAnalysisPanel() {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [overallFeedback, setOverallFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'session' | 'overall'>('overall');

  useEffect(() => { fetchSessions(); fetchOverall(); }, []);

  useEffect(() => {
    if (selectedSession) fetchSessionFeedback();
  }, [selectedSession]);

  const fetchSessions = async () => {
    try {
      const res = await apiClient.get('/sessions');
      setSessions(res.data.sessions || []);
    } catch { /* ignore */ }
  };

  const fetchOverall = async () => {
    try {
      const res = await apiClient.get('/feedback/overall');
      setOverallFeedback(res.data.feedback || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const fetchSessionFeedback = async () => {
    try {
      const res = await apiClient.get(`/feedback/session/${selectedSession}`);
      setFeedback(res.data.feedback || []);
    } catch { showToast('error', 'Failed to load feedback'); }
  };

  const activeFeedback = viewMode === 'session' ? feedback : overallFeedback;
  const avgRating = activeFeedback.length > 0
    ? (activeFeedback.reduce((sum, f) => sum + f.rating, 0) / activeFeedback.length).toFixed(1)
    : '0';
  const ratingDist = [1, 2, 3, 4, 5].map(r => ({
    rating: r,
    count: activeFeedback.filter(f => f.rating === r).length,
  }));
  const maxDist = Math.max(...ratingDist.map(r => r.count), 1);
  const positive = activeFeedback.filter(f => f.rating >= 4).length;
  const neutral = activeFeedback.filter(f => f.rating === 3).length;
  const negative = activeFeedback.filter(f => f.rating <= 2).length;

  const ratingColor = (r: number) => {
    if (r >= 4) return '#059669';
    if (r === 3) return '#D97706';
    return '#DC2626';
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>Loading feedback...</div>;

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center' }}>
        <select value={viewMode} onChange={e => setViewMode(e.target.value as any)}
          style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', background: '#fff' }}>
          <option value="overall">Overall Event</option>
          <option value="session">By Session</option>
        </select>
        {viewMode === 'session' && (
          <select value={selectedSession} onChange={e => setSelectedSession(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', background: '#fff', flex: 1 }}>
            <option value="">Select session...</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        )}
      </div>

      {activeFeedback.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>No feedback data yet</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          {/* Rating Overview */}
          <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HiOutlineStar size={18} style={{ color: '#D97706' }} /> Rating Overview
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
              <div style={{ fontSize: '48px', fontWeight: 800, color: '#2563EB' }}>{avgRating}</div>
              <div>
                <p style={{ fontSize: '13px', color: '#64748B' }}>Average Rating</p>
                <p style={{ fontSize: '13px', color: '#94A3B8' }}>{activeFeedback.length} responses</p>
              </div>
            </div>
            {/* Distribution bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ratingDist.reverse().map(r => (
                <div key={r.rating} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', width: '16px' }}>{r.rating}</span>
                  <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: '#F1F5F9', overflow: 'hidden' }}>
                    <div style={{ width: `${(r.count / maxDist) * 100}%`, height: '100%', borderRadius: '4px', background: ratingColor(r.rating), transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', width: '24px', textAlign: 'right' }}>{r.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sentiment Breakdown */}
          <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Sentiment Breakdown</h3>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              {[
                { label: 'Positive', count: positive, color: '#059669', bg: '#ECFDF5', icon: <HiOutlineFaceSmile size={20} /> },
                { label: 'Neutral', count: neutral, color: '#D97706', bg: '#FFFBEB', icon: <HiOutlineMinus size={20} /> },
                { label: 'Negative', count: negative, color: '#DC2626', bg: '#FEF2F2', icon: <HiOutlineFaceFrown size={20} /> },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, padding: '16px', background: s.bg, borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ color: s.color, marginBottom: '8px' }}>{s.icon}</div>
                  <p style={{ fontSize: '24px', fontWeight: 800, color: s.color }}>{s.count}</p>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{s.label}</p>
                </div>
              ))}
            </div>
            {/* Sentiment bar */}
            <div style={{ height: '12px', borderRadius: '6px', background: '#F1F5F9', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${(positive / activeFeedback.length) * 100}%`, background: '#059669', transition: 'width 0.3s' }} />
              <div style={{ width: `${(neutral / activeFeedback.length) * 100}%`, background: '#D97706', transition: 'width 0.3s' }} />
              <div style={{ width: `${(negative / activeFeedback.length) * 100}%`, background: '#DC2626', transition: 'width 0.3s' }} />
            </div>
          </div>
        </div>
      )}

      {/* Comments List */}
      {activeFeedback.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HiOutlineChatBubbleLeftRight size={18} style={{ color: '#2563EB' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Feedback Comments</h3>
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {activeFeedback.filter(f => f.text).map(f => (
              <div key={f.id} style={{ padding: '14px 24px', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{f.user.name}</span>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {[1, 2, 3, 4, 5].map(r => (
                      <div key={r} style={{ width: '8px', height: '8px', borderRadius: '50%', background: r <= f.rating ? ratingColor(f.rating) : '#E2E8F0' }} />
                    ))}
                  </div>
                </div>
                <p style={{ fontSize: '13px', color: '#475569' }}>{f.text}</p>
                <span style={{ fontSize: '11px', color: '#94A3B8' }}>{new Date(f.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
