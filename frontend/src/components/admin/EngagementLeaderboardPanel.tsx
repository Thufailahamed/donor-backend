'use client';

import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import { EngagementScore } from '@/types';
import { HiOutlineTrophy, HiOutlineFire, HiOutlineChatBubbleLeftRight, HiOutlineHandThumbUp } from 'react-icons/hi2';

export default function EngagementLeaderboardPanel() {
  const { showToast } = useToast();
  const [scores, setScores] = useState<EngagementScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('ALL');

  useEffect(() => { fetchScores(); }, []);

  const fetchScores = async () => {
    try {
      const res = await apiClient.get('/analytics/engagement-scores');
      setScores(res.data.scores || []);
    } catch { showToast('error', 'Failed to load leaderboard'); }
    finally { setLoading(false); }
  };

  const filtered = roleFilter === 'ALL' ? scores : scores.filter(s => s.role === roleFilter);
  const maxScore = filtered.length > 0 ? Math.max(...filtered.map(s => s.score), 1) : 1;

  const podiumStyles = [
    { bg: 'linear-gradient(135deg, #FBBF24, #F59E0B)', border: '#F59E0B', label: '1st', size: 120, crown: '#F59E0B' },
    { bg: 'linear-gradient(135deg, #CBD5E1, #94A3B8)', border: '#94A3B8', label: '2nd', size: 100, crown: '#94A3B8' },
    { bg: 'linear-gradient(135deg, #D97706, #B45309)', border: '#B45309', label: '3rd', size: 80, crown: '#B45309' },
  ];

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>Loading leaderboard...</div>
  );

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {['ALL', 'PARTICIPANT', 'SPEAKER'].map(r => (
          <button key={r} onClick={() => setRoleFilter(r)} style={{
            padding: '8px 16px', borderRadius: '8px', border: `1px solid ${roleFilter === r ? '#2563EB' : '#E2E8F0'}`,
            background: roleFilter === r ? '#EEF2FF' : '#fff', color: roleFilter === r ? '#2563EB' : '#64748B',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}>{r === 'ALL' ? 'All Roles' : r}</button>
        ))}
      </div>

      {/* Podium — Top 3 */}
      {filtered.length >= 3 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '16px', marginBottom: '32px' }}>
          {[1, 0, 2].map(idx => {
            const s = filtered[idx];
            if (!s) return null;
            const p = podiumStyles[idx];
            return (
              <div key={s.userId} style={{ textAlign: 'center', padding: '24px 20px', borderRadius: '16px', background: '#fff', border: `2px solid ${p.border}`, width: '200px' }}>
                <div style={{ width: `${p.size}px`, height: `${p.size}px`, borderRadius: '50%', background: p.bg, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: `${p.size * 0.35}px`, fontWeight: 800, color: '#fff' }}>
                  {idx + 1}
                </div>
                <p style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>{s.userName}</p>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', padding: '2px 8px', background: '#F1F5F9', borderRadius: '4px' }}>{s.role}</span>
                <p style={{ fontSize: '28px', fontWeight: 800, color: p.crown, marginTop: '12px' }}>{s.score}</p>
                <p style={{ fontSize: '11px', color: '#94A3B8' }}>points</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Table */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HiOutlineTrophy size={18} style={{ color: '#2563EB' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Full Leaderboard</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                {['#', 'User', 'Role', 'Score', 'Questions', 'Upvotes', 'Feedback', 'Poll Votes'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', textAlign: h === 'Score' ? 'center' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.userId} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 ? '#F8FAFC' : '#fff' }}>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: i < 3 ? '#F59E0B' : '#64748B' }}>{i + 1}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600 }}>{s.userName}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: '#F1F5F9', color: '#64748B', textTransform: 'uppercase' }}>{s.role}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: '#F1F5F9', overflow: 'hidden', minWidth: '60px' }}>
                        <div style={{ width: `${(s.score / maxScore) * 100}%`, height: '100%', borderRadius: '3px', background: 'linear-gradient(90deg, #2563EB, #7C3AED)' }} />
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 700, minWidth: '30px' }}>{s.score}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#2563EB' }}>{s.breakdown.questionsAsked}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#059669' }}>{s.breakdown.upvotesReceived}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#D97706' }}>{s.breakdown.feedbackGiven}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#8B5CF6' }}>{s.breakdown.pollVotes}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#94A3B8' }}>No engagement data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
