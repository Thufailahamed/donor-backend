'use client';

import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import { Session } from '@/types';
import { HiOutlineArrowsRightLeft, HiOutlineChatBubbleLeftRight, HiOutlineMicrophone, HiOutlineStar } from 'react-icons/hi2';

interface SessionDetail {
  questions: number;
  feedback: number;
  voiceNotes: number;
  avgRating: number;
  feedbackCount: number;
}

export default function SessionComparisonPanel() {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [leftId, setLeftId] = useState<string>('');
  const [rightId, setRightId] = useState<string>('');
  const [leftDetail, setLeftDetail] = useState<SessionDetail | null>(null);
  const [rightDetail, setRightDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);

  useEffect(() => { fetchSessions(); }, []);

  const fetchSessions = async () => {
    try {
      const res = await apiClient.get('/sessions');
      setSessions(res.data.sessions || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const compare = async () => {
    if (!leftId || !rightId) { showToast('error', 'Select two sessions to compare'); return; }
    setComparing(true);
    try {
      const [leftSes, rightSes, leftFb, rightFb] = await Promise.all([
        apiClient.get(`/sessions/${leftId}`),
        apiClient.get(`/sessions/${rightId}`),
        apiClient.get(`/feedback/session/${leftId}`).catch(() => ({ data: { feedback: [] } })),
        apiClient.get(`/feedback/session/${rightId}`).catch(() => ({ data: { feedback: [] } })),
      ]);

      const compute = (ses: any, fb: any): SessionDetail => {
        const fbList = fb.data?.feedback || [];
        const avg = fbList.length > 0 ? fbList.reduce((s: number, f: any) => s + f.rating, 0) / fbList.length : 0;
        return {
          questions: ses.data._count?.questions || 0,
          feedback: ses.data._count?.feedback || 0,
          voiceNotes: ses.data._count?.voiceNotes || 0,
          avgRating: Math.round(avg * 10) / 10,
          feedbackCount: fbList.length,
        };
      };

      setLeftDetail(compute(leftSes, leftFb));
      setRightDetail(compute(rightSes, rightFb));
    } catch { showToast('error', 'Failed to load session data'); }
    finally { setComparing(false); }
  };

  const leftSession = sessions.find(s => s.id === leftId);
  const rightSession = sessions.find(s => s.id === rightId);

  const metrics = leftDetail && rightDetail ? [
    { label: 'Questions', left: leftDetail.questions, right: rightDetail.questions, icon: <HiOutlineChatBubbleLeftRight size={16} />, color: '#2563EB' },
    { label: 'Feedback', left: leftDetail.feedback, right: rightDetail.feedback, icon: <HiOutlineChatBubbleLeftRight size={16} />, color: '#059669' },
    { label: 'Voice Notes', left: leftDetail.voiceNotes, right: rightDetail.voiceNotes, icon: <HiOutlineMicrophone size={16} />, color: '#0891B2' },
    { label: 'Avg Rating', left: leftDetail.avgRating, right: rightDetail.avgRating, icon: <HiOutlineStar size={16} />, color: '#D97706' },
  ] : [];

  if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>Loading sessions...</div>;

  return (
    <div>
      {/* Selectors */}
      <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>Session A</label>
            <select value={leftId} onChange={e => setLeftId(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', background: '#fff' }}>
              <option value="">Select session...</option>
              {sessions.filter(s => s.id !== rightId).map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '8px' }}>
            <HiOutlineArrowsRightLeft size={20} style={{ color: '#94A3B8' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>Session B</label>
            <select value={rightId} onChange={e => setRightId(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', background: '#fff' }}>
              <option value="">Select session...</option>
              {sessions.filter(s => s.id !== leftId).map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
          <button onClick={compare} disabled={comparing} style={{
            padding: '10px 24px', borderRadius: '8px', border: 'none',
            background: comparing ? '#93C5FD' : '#2563EB', color: '#fff',
            fontSize: '13px', fontWeight: 600, cursor: comparing ? 'not-allowed' : 'pointer',
          }}>{comparing ? 'Loading...' : 'Compare'}</button>
        </div>
      </div>

      {/* Comparison Results */}
      {metrics.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', borderBottom: '2px solid #E2E8F0', background: '#F8FAFC' }}>
            <div style={{ padding: '16px 24px' }}>
              <p style={{ fontSize: '14px', fontWeight: 700 }}>{leftSession?.title}</p>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: leftSession?.isActive ? '#ECFDF5' : '#FEE2E2', color: leftSession?.isActive ? '#059669' : '#DC2626' }}>
                {leftSession?.isActive ? 'LIVE' : 'OFF'}
              </span>
            </div>
            <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontWeight: 700, fontSize: '12px' }}>VS</div>
            <div style={{ padding: '16px 24px' }}>
              <p style={{ fontSize: '14px', fontWeight: 700 }}>{rightSession?.title}</p>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: rightSession?.isActive ? '#ECFDF5' : '#FEE2E2', color: rightSession?.isActive ? '#059669' : '#DC2626' }}>
                {rightSession?.isActive ? 'LIVE' : 'OFF'}
              </span>
            </div>
          </div>

          {/* Metrics */}
          {metrics.map((m, i) => {
            const max = Math.max(m.left, m.right, 1);
            return (
              <div key={m.label} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', borderBottom: i < metrics.length - 1 ? '1px solid #F1F5F9' : 'none', padding: '16px 24px', alignItems: 'center' }}>
                {/* Left value */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1, height: '10px', borderRadius: '5px', background: '#F1F5F9', overflow: 'hidden' }}>
                    <div style={{ width: `${(m.left / max) * 100}%`, height: '100%', borderRadius: '5px', background: '#2563EB', transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: m.left >= m.right ? '#2563EB' : '#94A3B8', minWidth: '40px', textAlign: 'right' }}>{m.left}</span>
                </div>
                {/* Center label */}
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: m.color }}>{m.icon}</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>{m.label}</span>
                </div>
                {/* Right value */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: m.right >= m.left ? '#7C3AED' : '#94A3B8', minWidth: '40px' }}>{m.right}</span>
                  <div style={{ flex: 1, height: '10px', borderRadius: '5px', background: '#F1F5F9', overflow: 'hidden' }}>
                    <div style={{ width: `${(m.right / max) * 100}%`, height: '100%', borderRadius: '5px', background: '#7C3AED', transition: 'width 0.5s' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
