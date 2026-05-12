'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { useIsMobile } from '@/hooks/useIsMobile';
import apiClient from '@/lib/api-client';
import Link from 'next/link';
import {
  HiOutlineCog6Tooth, HiOutlineArrowRightOnRectangle,
  HiOutlineChatBubbleLeftRight, HiOutlineUsers, HiOutlineMicrophone,
  HiOutlineStar, HiOutlineCalendarDays, HiOutlineChartBar,
  HiOutlineShieldCheck,
  HiOutlineSignal, HiOutlineClock, HiOutlineBolt,
  HiOutlineFolderOpen, HiOutlineArrowDownTray,
  HiOutlineMegaphone, HiOutlineTrophy, HiOutlineArrowsRightLeft,
  HiOutlinePower,
  HiOutlineBars3,
} from 'react-icons/hi2';
import MobileNav from '@/components/MobileNav';
import { EngagementMetrics, SentimentData, TopicData, Session, EngagementTimelinePoint } from '@/types';

import AccessLogPanel from '@/components/admin/AccessLogPanel';
import OnlineUsersPanel from '@/components/admin/OnlineUsersPanel';
import ActivityFeedPanel from '@/components/admin/ActivityFeedPanel';
import UserManagementPanel from '@/components/admin/UserManagementPanel';
import SessionControlPanel from '@/components/admin/SessionControlPanel';
import ContentManagementPanel from '@/components/admin/ContentManagementPanel';
import SystemHealthPanel from '@/components/admin/SystemHealthPanel';
import ExportPanel from '@/components/admin/ExportPanel';
import NotificationPanel from '@/components/admin/NotificationPanel';
import EngagementLeaderboardPanel from '@/components/admin/EngagementLeaderboardPanel';
import FeedbackAnalysisPanel from '@/components/admin/FeedbackAnalysisPanel';
import SessionComparisonPanel from '@/components/admin/SessionComparisonPanel';
import LiveQuestionsPanel from '@/components/admin/LiveQuestionsPanel';

const tabs = [
  { id: 'analytics', label: 'Analytics', icon: HiOutlineChartBar },
  { id: 'online', label: 'Online Users', icon: HiOutlineSignal },
  { id: 'access', label: 'Access Log', icon: HiOutlineClock },
  { id: 'activity', label: 'Activity Feed', icon: HiOutlineChatBubbleLeftRight },
  { id: 'users', label: 'Users', icon: HiOutlineUsers },
  { id: 'sessions', label: 'Sessions', icon: HiOutlineCalendarDays },
  { id: 'content', label: 'Content', icon: HiOutlineFolderOpen },
  { id: 'broadcasts', label: 'Broadcasts', icon: HiOutlineMegaphone },
  { id: 'leaderboard', label: 'Leaderboard', icon: HiOutlineTrophy },
  { id: 'feedback', label: 'Feedback', icon: HiOutlineChatBubbleLeftRight },
  { id: 'compare', label: 'Compare', icon: HiOutlineArrowsRightLeft },
  { id: 'health', label: 'System Health', icon: HiOutlineBolt },
  { id: 'exports', label: 'Exports', icon: HiOutlineArrowDownTray },
  { id: 'live-qa', label: 'Live Q&A', icon: HiOutlineChatBubbleLeftRight },
];

export default function AdminPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('analytics');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab) {
      // Use a timeout to avoid synchronous setState warning
      setTimeout(() => setActiveTab(tab), 0);
    }
  }, []);

  // Analytics state (kept from original)
  const [engagement, setEngagement] = useState<EngagementMetrics | null>(null);
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [topics, setTopics] = useState<TopicData[]>([]);
  const [timeline, setTimeline] = useState<EngagementTimelinePoint[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', startTime: '', endTime: '', track: '', location: '', day: '1' });
  const [creating, setCreating] = useState(false);

  // Quick Actions state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showQuickBroadcast, setShowQuickBroadcast] = useState(false);
  const [showQuickToggle, setShowQuickToggle] = useState(false);
  const [quickBroadcast, setQuickBroadcast] = useState({ title: '', message: '' });

  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const fetchSessions = async () => {
    try {
      const res = await apiClient.get('/sessions');
      setSessions(res.data.sessions || []);
    } catch { /* ignore */ }
  };

  const fetchData = async () => {
    try {
      const [engRes, sentRes, topRes, tlRes] = await Promise.all([
        apiClient.get('/analytics/engagement'),
        apiClient.get('/analytics/sentiment'),
        apiClient.get('/analytics/topics'),
        apiClient.get('/analytics/engagement-timeline').catch(() => ({ data: { timeline: [] } })),
      ]);
      setEngagement(engRes.data);
      setSentiment(sentRes.data.sentiment);
      setTopics(topRes.data.topics);
      setTimeline(tlRes.data.timeline || []);
    } catch { showToast('error', 'Failed to load analytics'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') { router.push('/login'); return; }
    fetchData();
    fetchSessions();
  }, [user, router, showToast]); // Added missing deps

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await apiClient.post('/sessions', {
        ...form, day: parseInt(form.day),
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
      });
      setShowCreate(false);
      setForm({ title: '', description: '', startTime: '', endTime: '', track: '', location: '', day: '1' });
      showToast('success', 'Session created');
      fetchData();
    } catch (err: any) { showToast('error', err.response?.data?.error || 'Failed to create session'); }
    finally { setCreating(false); }
  };

  const sendQuickBroadcast = async () => {
    if (!quickBroadcast.title.trim() || !quickBroadcast.message.trim()) { showToast('error', 'Title and message required'); return; }
    try {
      await apiClient.post('/notifications/broadcast', { ...quickBroadcast, type: 'info' });
      showToast('success', 'Broadcast sent');
      setQuickBroadcast({ title: '', message: '' });
      setShowQuickBroadcast(false);
    } catch { showToast('error', 'Failed to send broadcast'); }
  };

  const toggleSessionActive = async (id: string) => {
    try {
      await apiClient.patch(`/sessions/${id}/toggle`);
      showToast('success', 'Session toggled');
      fetchSessions();
    } catch { showToast('error', 'Failed to toggle session'); }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#94A3B8' }}>
        <div style={{ width: '40px', height: '40px', margin: '0 auto 16px', border: '3px solid #E2E8F0', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        Loading...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  const maxTopicCount = topics.length > 0 ? topics[0].count : 1;

  return (
    <div style={{ minHeight: '100vh' }}>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 200, padding: '12px 24px',
        background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #E2E8F0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <HiOutlineCog6Tooth size={24} style={{ color: '#2563EB' }} />
          <span style={{ fontWeight: 800, fontFamily: 'Outfit', fontSize: '18px' }}>Admin Dashboard</span>
        </div>
        {!isMobile ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/moderator" style={{ fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <HiOutlineShieldCheck size={16} /> Moderator
          </Link>
          <Link href="/agenda" style={{ fontSize: '13px', color: '#64748B' }}>Agenda</Link>
          <button onClick={logout} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px', color: '#94A3B8', cursor: 'pointer' }}>
            <HiOutlineArrowRightOnRectangle size={18} />
          </button>
        </div>
        ) : (
        <button onClick={() => setMobileMenuOpen(true)} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px', color: '#64748B', cursor: 'pointer' }}>
          <HiOutlineBars3 size={20} />
        </button>
        )}
      </nav>

      <MobileNav
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        items={[
          { label: 'Moderator', href: '/moderator', icon: <HiOutlineShieldCheck size={18} /> },
          { label: 'Agenda', href: '/agenda', icon: <HiOutlineCalendarDays size={18} /> },
        ]}
        user={user}
        onLogout={logout}
      />

      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', padding: '0 24px', display: 'flex', gap: '0', overflowX: 'auto' }}>
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '14px 18px',
              border: 'none', borderBottom: activeTab === t.id ? '2px solid #2563EB' : '2px solid transparent',
              background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              color: activeTab === t.id ? '#2563EB' : '#64748B', whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}>
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        {/* Analytics Tab (original content) */}
        {activeTab === 'analytics' && (
          <>
            {engagement && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
                {[
                  { icon: <HiOutlineUsers size={24} />, label: 'Total Users', value: engagement.overview.totalUsers, color: '#2563EB', bg: '#EEF2FF' },
                  { icon: <HiOutlineChatBubbleLeftRight size={24} />, label: 'Questions', value: engagement.overview.totalQuestions, color: '#8B5CF6', bg: '#F5F3FF' },
                  { icon: <HiOutlineStar size={24} />, label: 'Feedback', value: engagement.overview.totalFeedback, color: '#059669', bg: '#ECFDF5' },
                  { icon: <HiOutlineMicrophone size={24} />, label: 'Voice Notes', value: engagement.overview.totalVoiceNotes, color: '#0891B2', bg: '#ECFEFF' },
                ].map((m, i) => (
                  <div key={i} style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <div style={{ color: m.color, background: m.bg, padding: '8px', borderRadius: '8px' }}>{m.icon}</div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>{m.label}</span>
                    </div>
                    <p style={{ fontSize: '36px', fontWeight: 800 }}>{m.value}</p>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
              {sentiment && sentiment.total > 0 && (
                <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>Sentiment Breakdown</h3>
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                    {[
                      { label: 'Positive', value: sentiment.positive, color: '#059669' },
                      { label: 'Neutral', value: sentiment.neutral, color: '#D97706' },
                      { label: 'Negative', value: sentiment.negative, color: '#DC2626' },
                    ].map((s, i) => (
                      <div key={i} style={{ flex: 1, padding: '12px', background: '#F8FAFC', borderRadius: '8px' }}>
                        <p style={{ fontSize: '24px', fontWeight: 800, color: s.color }}>{s.value}</p>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ height: '12px', borderRadius: '6px', background: '#F1F5F9', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${(sentiment.positive / sentiment.total) * 100}%`, background: '#059669' }} />
                    <div style={{ width: `${(sentiment.neutral / sentiment.total) * 100}%`, background: '#D97706' }} />
                    <div style={{ width: `${(sentiment.negative / sentiment.total) * 100}%`, background: '#DC2626' }} />
                  </div>
                  <p style={{ textAlign: 'right', marginTop: '12px', fontSize: '13px', fontWeight: 600, color: '#64748B' }}>
                    Avg: <strong style={{ color: '#2563EB', fontSize: '16px' }}>{sentiment.average}/5</strong>
                  </p>
                </div>
              )}

              {topics.length > 0 && (
                <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>Trending Topics</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {topics.slice(0, 5).map((t, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, width: '80px' }}>{t.word}</span>
                        <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: '#F1F5F9', overflow: 'hidden' }}>
                          <div style={{ width: `${(t.count / maxTopicCount) * 100}%`, height: '100%', borderRadius: '4px', background: '#2563EB' }} />
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748B', width: '30px', textAlign: 'right' }}>{t.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {engagement && engagement.sessions.length > 0 && (
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', marginBottom: '32px' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Session Engagement</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                        {['Session', 'Questions', 'Feedback', 'Voice Notes'].map(h => (
                          <th key={h} style={{ padding: '14px 24px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {engagement.sessions.map((s, i) => (
                        <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 ? '#F8FAFC' : '#fff' }}>
                          <td style={{ padding: '14px 24px', fontSize: '13px', fontWeight: 600 }}>{s.title}</td>
                          <td style={{ padding: '14px 24px', fontSize: '13px', fontWeight: 600, color: '#2563EB' }}>{s.questions}</td>
                          <td style={{ padding: '14px 24px', fontSize: '13px', fontWeight: 600, color: '#059669' }}>{s.feedback}</td>
                          <td style={{ padding: '14px 24px', fontSize: '13px', fontWeight: 600, color: '#0891B2' }}>{s.voiceNotes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Engagement Timeline Chart */}
            {timeline.length > 0 && (() => {
              const maxVal = Math.max(...timeline.map(t => Math.max(t.questions, t.upvotes, t.feedback)), 1);
              return (
                <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', marginBottom: '32px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Engagement Timeline</h3>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      {[{ label: 'Questions', color: '#7C3AED' }, { label: 'Upvotes', color: '#2563EB' }, { label: 'Feedback', color: '#D97706' }].map(l => (
                        <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: l.color }} />
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '200px', overflow: 'hidden' }}>
                    {timeline.slice(-30).map((t, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1px', height: '180px' }}>
                          <div style={{ width: '6px', height: `${Math.max((t.questions / maxVal) * 170, 2)}px`, borderRadius: '2px 2px 0 0', background: '#7C3AED', transition: 'height 0.3s' }} />
                          <div style={{ width: '6px', height: `${Math.max((t.upvotes / maxVal) * 170, 2)}px`, borderRadius: '2px 2px 0 0', background: '#2563EB', transition: 'height 0.3s' }} />
                          <div style={{ width: '6px', height: `${Math.max((t.feedback / maxVal) * 170, 2)}px`, borderRadius: '2px 2px 0 0', background: '#D97706', transition: 'height 0.3s' }} />
                        </div>
                        <span style={{ fontSize: '8px', color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '28px' }}>
                          {new Date(t.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Top Sessions Stacked Bars */}
            {engagement && engagement.sessions.length > 0 && (() => {
              const sortedSessions = [...engagement.sessions]
                .map(s => ({ ...s, total: s.questions + s.feedback + s.voiceNotes }))
                .sort((a, b) => b.total - a.total)
                .slice(0, 5);
              const maxTotal = Math.max(...sortedSessions.map(s => s.total), 1);
              return (
                <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>Top Sessions by Engagement</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {sortedSessions.map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, width: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                        <div style={{ flex: 1, height: '12px', borderRadius: '6px', background: '#F1F5F9', overflow: 'hidden', display: 'flex' }}>
                          <div style={{ width: `${(s.questions / maxTotal) * 100}%`, background: '#2563EB', transition: 'width 0.3s' }} />
                          <div style={{ width: `${(s.feedback / maxTotal) * 100}%`, background: '#059669', transition: 'width 0.3s' }} />
                          <div style={{ width: `${(s.voiceNotes / maxTotal) * 100}%`, background: '#0891B2', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748B', width: '30px', textAlign: 'right' }}>{s.total}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {activeTab === 'online' && <OnlineUsersPanel />}
        {activeTab === 'access' && <AccessLogPanel />}
        {activeTab === 'activity' && <ActivityFeedPanel />}
        {activeTab === 'users' && <UserManagementPanel />}
        {activeTab === 'sessions' && <SessionControlPanel />}
        {activeTab === 'content' && <ContentManagementPanel />}
        {activeTab === 'broadcasts' && <NotificationPanel />}
        {activeTab === 'leaderboard' && <EngagementLeaderboardPanel />}
        {activeTab === 'feedback' && <FeedbackAnalysisPanel />}
        {activeTab === 'compare' && <SessionComparisonPanel />}
        {activeTab === 'health' && <SystemHealthPanel />}
        {activeTab === 'exports' && <ExportPanel />}
        {activeTab === 'live-qa' && <LiveQuestionsPanel />}
      </div>

      {/* Quick Actions Bar */}
      <div style={{
        position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
        borderRadius: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        padding: isMobile ? '8px 12px' : '10px 20px', display: 'flex', gap: '8px', zIndex: 150,
        border: '1px solid #E2E8F0',
      }}>
        <button onClick={() => { setShowQuickBroadcast(!showQuickBroadcast); setShowQuickToggle(false); }} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
          borderRadius: '8px', border: '1px solid #E2E8F0', background: showQuickBroadcast ? '#EEF2FF' : '#fff',
          color: '#2563EB', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
        }}>
          <HiOutlineMegaphone size={16} /> Broadcast
        </button>
        <button onClick={() => { setShowQuickToggle(!showQuickToggle); setShowQuickBroadcast(false); }} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
          borderRadius: '8px', border: '1px solid #E2E8F0', background: showQuickToggle ? '#EEF2FF' : '#fff',
          color: '#2563EB', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
        }}>
          <HiOutlinePower size={16} /> Toggle Session
        </button>

        {/* Quick Broadcast Dropdown */}
        {showQuickBroadcast && (
          <div style={{
            position: 'absolute', bottom: '56px', left: isMobile ? '8px' : 0,
            ...(isMobile ? { right: '8px', width: 'auto' } : { width: '340px' }),
            background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0',
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)', padding: '16px',
          }}>
            <input placeholder="Title" value={quickBroadcast.title} onChange={e => setQuickBroadcast(p => ({ ...p, title: e.target.value }))}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '13px', marginBottom: '8px', outline: 'none' }} />
            <textarea placeholder="Message" value={quickBroadcast.message} onChange={e => setQuickBroadcast(p => ({ ...p, message: e.target.value }))} rows={3}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '13px', marginBottom: '8px', outline: 'none', resize: 'vertical' }} />
            <button onClick={sendQuickBroadcast} style={{
              width: '100%', padding: '8px', borderRadius: '6px', border: 'none',
              background: '#2563EB', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}>Send</button>
          </div>
        )}

        {/* Quick Toggle Dropdown */}
        {showQuickToggle && (
          <div style={{
            position: 'absolute', bottom: '56px', left: isMobile ? '8px' : 0,
            ...(isMobile ? { right: '8px', width: 'auto' } : { minWidth: '300px' }),
            background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0',
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)', padding: '12px',
            maxHeight: '240px', overflowY: 'auto',
          }}>
            {sessions.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                <button onClick={() => toggleSessionActive(s.id)} style={{
                  padding: '4px 10px', borderRadius: '6px', border: 'none', fontSize: '11px', fontWeight: 700,
                  background: s.isActive ? '#ECFDF5' : '#FEE2E2', color: s.isActive ? '#059669' : '#DC2626', cursor: 'pointer',
                }}>{s.isActive ? 'LIVE' : 'OFF'}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
