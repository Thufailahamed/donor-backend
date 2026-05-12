'use client';
import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { EngagementScore } from '@/types';

export default function EngagementScoresPanel() {
  const [scores, setScores] = useState<EngagementScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchScores(); }, []);

  const fetchScores = async () => {
    try {
      const res = await apiClient.get('/analytics/engagement-scores');
      setScores(res.data.scores);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8' }}>Loading scores...</div>;

  const maxScore = scores.length > 0 ? scores[0].score : 1;

  return (
    <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Engagement Leaderboard</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
        {scores.slice(0, 20).map((s, i) => (
          <div key={s.userId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: i < 3 ? '#FFFBEB' : '#F8FAFC', borderRadius: '8px' }}>
            <span style={{ width: '28px', fontSize: '14px', fontWeight: 800, color: i < 3 ? '#D97706' : '#64748B', textAlign: 'center' }}>#{i + 1}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{s.userName}</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#2563EB' }}>{s.score}</span>
              </div>
              <div style={{ height: '6px', borderRadius: '3px', background: '#E2E8F0', marginTop: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(s.score / maxScore) * 100}%`, height: '100%', background: i < 3 ? '#D97706' : '#2563EB', borderRadius: '3px' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '11px', color: '#94A3B8' }}>
                <span>Q: {s.breakdown.questionsAsked}</span>
                <span>Up: {s.breakdown.upvotesReceived}</span>
                <span>FB: {s.breakdown.feedbackGiven}</span>
                <span>Poll: {s.breakdown.pollVotes}</span>
              </div>
            </div>
          </div>
        ))}
        {scores.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8' }}>No engagement data yet</div>}
      </div>
    </div>
  );
}
