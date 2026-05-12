'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useIsMobile } from '@/hooks/useIsMobile';
import apiClient from '@/lib/api-client';
import { Session, Question, Feedback } from '@/types';
import { format } from 'date-fns';
import { getSocket, joinSession, leaveSession } from '@/lib/socket';
import {
  HiOutlineCog6Tooth, HiOutlinePresentationChartBar, HiOutlineArrowRightOnRectangle,
  HiOutlineChatBubbleLeftRight, HiOutlineUsers, HiOutlineMicrophone,
  HiOutlineClock, HiOutlineStar, HiOutlineHandThumbUp, HiOutlineMegaphone,
  HiOutlinePlusCircle, HiOutlineXMark, HiOutlineCheck, HiOutlineEye,
  HiOutlinePause, HiOutlinePlay, HiOutlineArrowPath, HiOutlineChartBar,
  HiOutlineSignal, HiOutlineFire, HiOutlineChatBubbleOvalLeft,
  HiOutlineQuestionMarkCircle,
} from 'react-icons/hi2';

export default function SpeakerPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activePoll, setActivePoll] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Mode: presentation (clean stage) or control (management)
  const [mode, setMode] = useState<'presentation' | 'control'>('presentation');

  // Timer
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerInput, setTimerInput] = useState('');
  const [showFullTimer, setShowFullTimer] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Pinned / highlighted
  const [pinnedQuestion, setPinnedQuestion] = useState<Question | null>(null);

  // Participants
  const [participantCount, setParticipantCount] = useState(0);

  // Question queue filter
  const [qFilter, setQFilter] = useState<string>('ALL');

  // Poll creation
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  // Announcements
  const [announcementText, setAnnouncementText] = useState('');
  const [announcements, setAnnouncements] = useState<any[]>([]);

  // Session stats
  const [sessionStats, setSessionStats] = useState<{ questions: number; feedback: number; voiceNotes: number } | null>(null);

  // Feedback
  const [feedbackData, setFeedbackData] = useState<Feedback[]>([]);

  // Control panel sub-tab
  const [controlTab, setControlTab] = useState<'questions' | 'polls' | 'announcements' | 'stats' | 'feedback'>('questions');

  // Auth guard
  useEffect(() => {
    if (!user || !['MODERATOR', 'ADMIN', 'SPEAKER'].includes(user.role)) {
      router.push('/login');
      return;
    }
    fetchSessions();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [user]);

  // Load data when session changes
  useEffect(() => {
    if (selectedSession) {
      fetchQuestions();
      fetchActivePoll();
      fetchSessionStats();
      fetchFeedback();
      fetchAnnouncements();
    }
  }, [selectedSession]);

  // Real-time socket listeners
  useEffect(() => {
    if (!selectedSession) return;
    const socket = getSocket();
    joinSession(selectedSession);

    socket.on('new-question', (q: Question) => setQuestions(prev => [q, ...prev]));
    socket.on('question-status-changed', (data: any) => {
      setQuestions(prev => prev.map(q => q.id === data.questionId ? { ...q, status: data.status } : q));
    });
    socket.on('question-deleted', (data: any) => setQuestions(prev => prev.filter(q => q.id !== data.questionId)));
    socket.on('poll-started', (poll: any) => setActivePoll(poll));
    socket.on('poll-voted', (poll: any) => setActivePoll(poll));
    socket.on('poll-ended', () => setActivePoll(null));
    socket.on('question-pinned', (q: Question) => setPinnedQuestion(q.isPinned ? q : null));
    socket.on('participant-count', (data: { sessionId: string; count: number }) => {
      if (data.sessionId === selectedSession) setParticipantCount(data.count);
    });
    socket.on('new-announcement', (a: any) => setAnnouncements(prev => [a, ...prev]));
    socket.on('dismiss-announcement', (data: any) => setAnnouncements(prev => prev.filter((x: any) => x.id !== data.id)));

    return () => {
      leaveSession(selectedSession);
      socket.off('new-question');
      socket.off('question-status-changed');
      socket.off('question-deleted');
      socket.off('poll-started');
      socket.off('poll-voted');
      socket.off('poll-ended');
      socket.off('question-pinned');
      socket.off('participant-count');
      socket.off('new-announcement');
      socket.off('dismiss-announcement');
    };
  }, [selectedSession]);

  // Keyboard shortcut: M to toggle mode, Escape to exit full timer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'm' || e.key === 'M') setMode(m => m === 'presentation' ? 'control' : 'presentation');
      if (e.key === 'Escape') setShowFullTimer(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Auto-refresh feedback
  useEffect(() => {
    if (!selectedSession || mode !== 'control') return;
    const interval = setInterval(() => fetchFeedback(), 30000);
    return () => clearInterval(interval);
  }, [selectedSession, mode]);

  const fetchSessions = async () => {
    try {
      const res = await apiClient.get('/sessions');
      setSessions(res.data.sessions);
      if (res.data.sessions.length > 0) setSelectedSession(res.data.sessions[0].id);
    } catch { /* ignore */ }
  };

  const fetchQuestions = async () => {
    try {
      const res = await apiClient.get(`/questions/session/${selectedSession}?sort=popular`);
      setQuestions(res.data.questions);
    } catch { /* ignore */ }
  };

  const fetchActivePoll = async () => {
    try {
      const res = await apiClient.get(`/polls/session/${selectedSession}/active`);
      setActivePoll(res.data.poll);
    } catch { setActivePoll(null); }
  };

  const fetchSessionStats = async () => {
    try {
      const res = await apiClient.get(`/sessions/${selectedSession}`);
      setSessionStats({
        questions: res.data._count?.questions || 0,
        feedback: res.data._count?.feedback || 0,
        voiceNotes: res.data._count?.voiceNotes || 0,
      });
    } catch { /* ignore */ }
  };

  const fetchFeedback = async () => {
    try {
      const res = await apiClient.get(`/feedback/session/${selectedSession}`);
      setFeedbackData(res.data.feedback || []);
    } catch { /* ignore */ }
  };

  const fetchAnnouncements = async () => {
    try {
      const res = await apiClient.get(`/announcements/session/${selectedSession}/active`);
      setAnnouncements(res.data.announcements || []);
    } catch { /* ignore */ }
  };

  // Timer functions
  const startTimer = (mins: number) => {
    setTimeLeft(mins * 60);
    setTimerRunning(true);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerIntervalRef.current!); setTimerRunning(false); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const startCustomTimer = () => {
    const mins = parseInt(timerInput);
    if (mins > 0) { startTimer(mins); setTimerInput(''); }
  };

  const stopTimer = () => {
    setTimerRunning(false);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  };

  const resetTimer = () => { stopTimer(); setTimeLeft(0); };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const timerColor = (s: number) => s > 60 ? '#059669' : s > 30 ? '#D97706' : '#DC2626';

  // Question actions
  const changeQuestionStatus = async (id: string, status: string) => {
    try {
      await apiClient.put(`/questions/${id}/status`, { status });
      setQuestions(prev => prev.map(q => q.id === id ? { ...q, status: status as any } : q));
    } catch { /* ignore */ }
  };

  const togglePin = async (id: string) => {
    try { await apiClient.put(`/questions/${id}/pin`); } catch { /* ignore */ }
  };

  // Poll creation
  const createPoll = async () => {
    if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) return;
    try {
      await apiClient.post(`/polls/session/${selectedSession}`, {
        question: pollQuestion,
        options: pollOptions.filter(o => o.trim()),
      });
      setPollQuestion(''); setPollOptions(['', '']); setShowPollCreator(false);
    } catch { /* ignore */ }
  };

  const endPoll = async () => {
    if (!activePoll) return;
    try { await apiClient.post(`/polls/${activePoll.id}/end`); setActivePoll(null); } catch { /* ignore */ }
  };

  // Announcements
  const sendAnnouncement = async () => {
    if (!announcementText.trim()) return;
    try {
      await apiClient.post(`/announcements/session/${selectedSession}`, { text: announcementText });
      setAnnouncementText('');
      fetchAnnouncements();
    } catch { /* ignore */ }
  };

  const dismissAnnouncement = async (id: string) => {
    try { await apiClient.delete(`/announcements/${id}`); setAnnouncements(prev => prev.filter(a => a.id !== id)); } catch { /* ignore */ }
  };

  const currentSession = sessions.find(s => s.id === selectedSession);
  const highlightedQuestions = questions.filter(q => q.status === 'HIGHLIGHTED');
  const activeQuestion = pinnedQuestion || (highlightedQuestions.length > 0 ? highlightedQuestions[0] : null);
  const nextUp = highlightedQuestions.filter(q => q.id !== activeQuestion?.id).slice(0, 3);

  const filteredQuestions = qFilter === 'ALL' ? questions : questions.filter(q => q.status === qFilter);
  const avgRating = feedbackData.length > 0 ? (feedbackData.reduce((s, f) => s + f.rating, 0) / feedbackData.length).toFixed(1) : '—';

  // Color helpers
  const statusColor = (s: string) => {
    switch (s) {
      case 'PENDING': return '#D97706';
      case 'ANSWERED': return '#059669';
      case 'HIGHLIGHTED': return '#2563EB';
      case 'DISMISSED': return '#DC2626';
      default: return '#64748B';
    }
  };

  // ======================== RENDER ========================

  // Full-screen timer overlay
  if (showFullTimer) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0F172A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <p style={{ fontSize: '16px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: '20px' }}>Session Timer</p>
        <p style={{ fontSize: '200px', fontWeight: 800, color: timerColor(timeLeft), lineHeight: 1, fontFamily: 'Outfit' }}>
          {formatTimer(timeLeft)}
        </p>
        {timeLeft < 30 && timeLeft > 0 && (
          <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        )}
        <p style={{ fontSize: '14px', color: '#475569', marginTop: '32px' }}>Press ESC to exit</p>
      </div>
    );
  }

  // ==================== CONTROL MODE ====================
  if (mode === 'control') {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)', color: '#fff' }}>
        {/* Control Mode Header */}
        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(148,163,184,0.1)', background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <HiOutlineCog6Tooth size={22} style={{ color: '#38BDF8' }} />
            <span style={{ fontWeight: 700, fontSize: '16px' }}>Speaker Control Panel</span>
            <div style={{
              display: 'flex', gap: '8px', marginLeft: '16px',
              overflowX: 'auto', maxWidth: isMobile ? '40vw' : '60vw', paddingBottom: '4px',
              scrollbarWidth: 'none', msOverflowStyle: 'none'
            }}>
              {sessions.map(s => (
                <button key={s.id} onClick={() => setSelectedSession(s.id)} style={{
                  padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                  border: `1px solid ${selectedSession === s.id ? '#3B82F6' : '#334155'}`,
                  background: selectedSession === s.id ? '#3B82F6' : 'transparent',
                  color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap',
                }}>{s.title.length > 25 ? s.title.slice(0, 25) + '...' : s.title}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Participant count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(5,150,105,0.15)', color: '#059669', fontSize: '13px', fontWeight: 600 }}>
              <HiOutlineSignal size={14} /> {participantCount} Live
            </div>
            <button onClick={() => setMode('presentation')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #334155', background: 'transparent', color: '#94A3B8', cursor: 'pointer', fontSize: '13px' }}>
              <HiOutlinePresentationChartBar size={16} /> Stage View
            </button>
          </div>
        </div>

        {/* Control Tabs */}
        <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid rgba(148,163,184,0.1)', padding: '0 24px', background: 'rgba(15,23,42,0.5)', overflowX: 'auto' as const }}>
          {[
            { id: 'questions' as const, label: 'Questions', icon: HiOutlineChatBubbleOvalLeft },
            { id: 'polls' as const, label: 'Polls', icon: HiOutlineChartBar },
            { id: 'announcements' as const, label: 'Announcements', icon: HiOutlineMegaphone },
            { id: 'stats' as const, label: 'Stats', icon: HiOutlineSignal },
            { id: 'feedback' as const, label: 'Feedback', icon: HiOutlineStar },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setControlTab(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '14px 18px',
                border: 'none', borderBottom: controlTab === t.id ? '2px solid #3B82F6' : '2px solid transparent',
                background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                color: controlTab === t.id ? '#3B82F6' : '#64748B', whiteSpace: 'nowrap',
              }}>
                <Icon size={16} /> {t.label}
              </button>
            );
          })}

          {/* Timer controls in tab bar */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
            <button onClick={() => startTimer(5)} style={{ background: '#1E293B', color: '#94A3B8', border: '1px solid #334155', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>5m</button>
            <button onClick={() => startTimer(10)} style={{ background: '#1E293B', color: '#94A3B8', border: '1px solid #334155', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>10m</button>
            <input value={timerInput} onChange={e => setTimerInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && startCustomTimer()} placeholder="min" type="number"
              style={{ width: '50px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #334155', background: '#1E293B', color: '#fff', fontSize: '12px', textAlign: 'center' }} />
            <button onClick={timerRunning ? stopTimer : () => timeLeft > 0 && startTimer(timeLeft / 60)}
              style={{ background: '#1E293B', color: timerRunning ? '#D97706' : '#059669', border: '1px solid #334155', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
              {timerRunning ? 'Pause' : 'Start'}
            </button>
            <button onClick={resetTimer} style={{ background: '#1E293B', color: '#94A3B8', border: '1px solid #334155', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Reset</button>
            {timeLeft > 0 && (
              <span style={{ fontSize: '16px', fontWeight: 800, color: timerColor(timeLeft), padding: '0 8px' }}>{formatTimer(timeLeft)}</span>
            )}
            {timeLeft > 0 && (
              <button onClick={() => setShowFullTimer(true)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '12px' }}>Full</button>
            )}
          </div>
        </div>

        {/* Control Content */}
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
          {/* Questions Tab */}
          {controlTab === 'questions' && (
            <div>
              {/* Filter bar */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto' as const }}>
                {['ALL', 'PENDING', 'HIGHLIGHTED', 'ANSWERED', 'DISMISSED'].map(f => (
                  <button key={f} onClick={() => setQFilter(f)} style={{
                    padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                    border: `1px solid ${qFilter === f ? '#3B82F6' : '#334155'}`,
                    background: qFilter === f ? 'rgba(59,130,246,0.15)' : 'transparent',
                    color: qFilter === f ? '#3B82F6' : '#94A3B8', cursor: 'pointer',
                  }}>
                    {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()} ({f === 'ALL' ? questions.length : questions.filter(q => q.status === f).length})
                  </button>
                ))}
              </div>

              {/* Question list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                {filteredQuestions.map(q => (
                  <div key={q.id} style={{
                    padding: '14px 18px', borderRadius: '12px',
                    background: 'rgba(30,41,59,0.5)', backdropFilter: 'blur(8px)',
                    border: `1px solid ${q.status === 'HIGHLIGHTED' ? 'rgba(59,130,246,0.3)' : 'rgba(148,163,184,0.1)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>{q.text}</p>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: '#64748B' }}>{q.user.name}</span>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', background: `${statusColor(q.status)}20`, color: statusColor(q.status) }}>{q.status}</span>
                          <span style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <HiOutlineHandThumbUp size={12} /> {q.upvoteCount}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <button onClick={() => changeQuestionStatus(q.id, 'HIGHLIGHTED')} title="Highlight" style={{ padding: '6px', borderRadius: '6px', border: '1px solid #334155', background: 'transparent', color: '#3B82F6', cursor: 'pointer' }}>
                          <HiOutlineEye size={14} />
                        </button>
                        <button onClick={() => togglePin(q.id)} title="Pin" style={{ padding: '6px', borderRadius: '6px', border: `1px solid ${q.isPinned ? '#F59E0B' : '#334155'}`, background: q.isPinned ? 'rgba(245,158,11,0.15)' : 'transparent', color: q.isPinned ? '#F59E0B' : '#94A3B8', cursor: 'pointer' }}>
                          <HiOutlineFire size={14} />
                        </button>
                        <button onClick={() => changeQuestionStatus(q.id, 'ANSWERED')} title="Answer" style={{ padding: '6px', borderRadius: '6px', border: '1px solid #334155', background: 'transparent', color: '#059669', cursor: 'pointer' }}>
                          <HiOutlineCheck size={14} />
                        </button>
                        <button onClick={() => changeQuestionStatus(q.id, 'DISMISSED')} title="Dismiss" style={{ padding: '6px', borderRadius: '6px', border: '1px solid #334155', background: 'transparent', color: '#DC2626', cursor: 'pointer' }}>
                          <HiOutlineXMark size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredQuestions.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '48px', color: '#475569' }}>No questions yet</div>
                )}
              </div>
            </div>
          )}

          {/* Polls Tab */}
          {controlTab === 'polls' && (
            <div>
              {/* Active poll */}
              {activePoll && (
                <div style={{ marginBottom: '24px', padding: '20px', borderRadius: '16px', background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(59,130,246,0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#3B82F6' }}>Active Poll: {activePoll.question}</h3>
                    <button onClick={endPoll} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #DC2626', background: 'transparent', color: '#DC2626', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>End Poll</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {activePoll.options.map((opt: any) => {
                      const total = activePoll.options.reduce((s: number, o: any) => s + (o._count?.userVotes || 0), 0);
                      const pct = total === 0 ? 0 : Math.round(((opt._count?.userVotes || 0) / total) * 100);
                      return (
                        <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 500, width: '150px' }}>{opt.text}</span>
                          <div style={{ flex: 1, height: '24px', background: '#334155', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #2563EB, #3B82F6)', transition: 'width 0.5s', borderRadius: '8px' }} />
                            <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', fontWeight: 700 }}>{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Create poll */}
              <button onClick={() => setShowPollCreator(!showPollCreator)} style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px',
                border: '1px solid #334155', background: 'transparent', color: '#3B82F6', cursor: 'pointer', fontSize: '13px', fontWeight: 600, marginBottom: '16px',
              }}>
                <HiOutlinePlusCircle size={16} /> {showPollCreator ? 'Cancel' : 'Create New Poll'}
              </button>

              {showPollCreator && (
                <div style={{ padding: '20px', borderRadius: '16px', background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(148,163,184,0.1)', marginBottom: '16px' }}>
                  <input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Poll question..."
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #334155', background: '#1E293B', color: '#fff', fontSize: '14px', marginBottom: '12px', outline: 'none' }} />
                  {pollOptions.map((opt, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input value={opt} onChange={e => { const n = [...pollOptions]; n[i] = e.target.value; setPollOptions(n); }} placeholder={`Option ${i + 1}`}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #334155', background: '#1E293B', color: '#fff', fontSize: '13px', outline: 'none' }} />
                      {pollOptions.length > 2 && (
                        <button onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #334155', background: 'transparent', color: '#DC2626', cursor: 'pointer' }}>
                          <HiOutlineXMark size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 5 && (
                    <button onClick={() => setPollOptions([...pollOptions, ''])} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px dashed #334155', background: 'transparent', color: '#64748B', cursor: 'pointer', fontSize: '12px', marginBottom: '12px' }}>+ Add Option</button>
                  )}
                  <button onClick={createPoll} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: '#3B82F6', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    Launch Poll
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Announcements Tab */}
          {controlTab === 'announcements' && (
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <input value={announcementText} onChange={e => setAnnouncementText(e.target.value)} placeholder="Type announcement..."
                  onKeyDown={e => e.key === 'Enter' && sendAnnouncement()}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #334155', background: '#1E293B', color: '#fff', fontSize: '14px', outline: 'none' }} />
                <button onClick={sendAnnouncement} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#3B82F6', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Send
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {announcements.map((a: any) => (
                  <div key={a.id} style={{ padding: '14px 18px', borderRadius: '12px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 500 }}>{a.text}</p>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>{new Date(a.createdAt).toLocaleString()}</span>
                    </div>
                    <button onClick={() => dismissAnnouncement(a.id)} style={{ padding: '4px', borderRadius: '4px', border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer' }}>
                      <HiOutlineXMark size={16} />
                    </button>
                  </div>
                ))}
                {announcements.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px', color: '#475569' }}>No active announcements</div>
                )}
              </div>
            </div>
          )}

          {/* Stats Tab */}
          {controlTab === 'stats' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {[
                  { label: 'Questions', value: sessionStats?.questions || 0, icon: <HiOutlineChatBubbleOvalLeft size={24} />, color: '#3B82F6' },
                  { label: 'Feedback', value: sessionStats?.feedback || 0, icon: <HiOutlineStar size={24} />, color: '#F59E0B' },
                  { label: 'Voice Notes', value: sessionStats?.voiceNotes || 0, icon: <HiOutlineMicrophone size={24} />, color: '#0891B2' },
                  { label: 'Live Participants', value: participantCount, icon: <HiOutlineUsers size={24} />, color: '#059669' },
                ].map(m => (
                  <div key={m.label} style={{ padding: '20px', borderRadius: '16px', background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(148,163,184,0.1)' }}>
                    <div style={{ color: m.color, marginBottom: '12px' }}>{m.icon}</div>
                    <p style={{ fontSize: '32px', fontWeight: 800, marginBottom: '4px' }}>{m.value}</p>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{m.label}</p>
                  </div>
                ))}
              </div>
              <div style={{ padding: '20px', borderRadius: '16px', background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(148,163,184,0.1)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: '#94A3B8' }}>Session Details</h3>
                <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>{currentSession?.title}</p>
                <p style={{ fontSize: '13px', color: '#64748B' }}>{currentSession?.description}</p>
                {currentSession?.startTime && (
                  <p style={{ fontSize: '13px', color: '#64748B', marginTop: '8px' }}>
                    {format(new Date(currentSession.startTime), 'h:mm a')} — {format(new Date(currentSession.endTime), 'h:mm a')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Feedback Tab */}
          {controlTab === 'feedback' && (
            <div>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                <div style={{ padding: '20px', borderRadius: '16px', background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(148,163,184,0.1)', flex: 1, textAlign: 'center' }}>
                  <p style={{ fontSize: '36px', fontWeight: 800, color: '#F59E0B' }}>{avgRating}</p>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Average Rating</p>
                </div>
                <div style={{ padding: '20px', borderRadius: '16px', background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(148,163,184,0.1)', flex: 1, textAlign: 'center' }}>
                  <p style={{ fontSize: '36px', fontWeight: 800, color: '#3B82F6' }}>{feedbackData.length}</p>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Total Responses</p>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                {feedbackData.map(f => (
                  <div key={f.id} style={{ padding: '14px 18px', borderRadius: '12px', background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(148,163,184,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{f.user.name}</span>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {[1, 2, 3, 4, 5].map(r => (
                          <div key={r} style={{ width: '8px', height: '8px', borderRadius: '50%', background: r <= f.rating ? '#F59E0B' : '#334155' }} />
                        ))}
                      </div>
                    </div>
                    {f.text && <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '4px' }}>{f.text}</p>}
                    <span style={{ fontSize: '11px', color: '#475569' }}>{new Date(f.createdAt).toLocaleString()}</span>
                  </div>
                ))}
                {feedbackData.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px', color: '#475569' }}>No feedback yet</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== PRESENTATION MODE ====================
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)', color: '#FFFFFF', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* Subtle mode hint - top left */}
      <button onClick={() => setMode('control')} style={{
        position: 'absolute', top: '16px', left: '16px', zIndex: 100,
        display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px',
        background: 'rgba(30,41,59,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(148,163,184,0.1)',
        color: '#94A3B8', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'opacity 0.3s', opacity: 0.4,
      }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}>
        <HiOutlineCog6Tooth size={14} /> Control Panel (M)
      </button>

      {/* Session selector - top center, hover reveal */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        padding: '12px 24px', background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(16px)',
        display: 'flex', gap: '8px', opacity: 0, transition: 'all 0.3s ease', zIndex: 100,
        borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', 
        overflowX: 'auto', maxWidth: '80vw', scrollbarWidth: 'none', msOverflowStyle: 'none'
      }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
        {sessions.map(s => (
          <button key={s.id} onClick={() => setSelectedSession(s.id)} style={{
            padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
            border: `1px solid ${selectedSession === s.id ? '#3B82F6' : '#334155'}`,
            background: selectedSession === s.id ? '#3B82F6' : 'transparent',
            color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>{s.title}</button>
        ))}
      </div>

      {/* Header */}
      <div style={{ padding: isMobile ? '16px' : '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#E2E8F0' }}>{currentSession?.title || 'Select session'}</h2>
          <p style={{ fontSize: '14px', color: '#64748B' }}>Speaker Stage View</p>
        </div>

        <div style={{ display: 'flex', gap: isMobile ? '16px' : '48px', alignItems: 'center', ...(isMobile ? { flexDirection: 'column' as const, alignItems: 'flex-end' as const } : {}) }}>
          {/* Participant count */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '10px', color: '#059669', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              Live
            </p>
            <p style={{ fontSize: '32px', fontWeight: 800, color: '#059669', lineHeight: 1.2 }}>{participantCount}</p>
          </div>

          {/* Timer */}
          {timeLeft > 0 && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '10px', color: timerColor(timeLeft), fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                Session Time
              </p>
              <div style={{
                fontSize: isMobile ? '32px' : '48px', fontWeight: 800, color: timerColor(timeLeft), lineHeight: 1,
                ...(timeLeft < 30 && timeLeft > 0 ? { animation: 'pulse 1s infinite' } : {}),
              }}>
                {formatTimer(timeLeft)}
              </div>
            </div>
          )}

          {/* Clock */}
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '10px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Clock</p>
            <div style={{ fontSize: isMobile ? '32px' : '48px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1 }}>
              {format(currentTime, 'h:mm a')}
            </div>
          </div>
        </div>
      </div>

      {/* Main Stage Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '16px' : '32px 48px' }}>
        {/* Active Poll */}
        {activePoll && (
          <div style={{
            maxWidth: '1000px', width: '100%', padding: '40px',
            borderRadius: '24px', marginBottom: activeQuestion ? '48px' : 0,
            background: 'rgba(30,41,59,0.5)', backdropFilter: 'blur(12px)',
            border: '2px solid rgba(59,130,246,0.5)',
          }}>
            <h2 style={{ fontSize: '20px', color: '#3B82F6', fontWeight: 700, marginBottom: '16px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '3px' }}>
              Live Audience Poll
            </h2>
            <h3 style={{ fontSize: '40px', fontWeight: 800, marginBottom: '32px', textAlign: 'center' }}>{activePoll.question}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activePoll.options.map((opt: any) => {
                const total = activePoll.options.reduce((s: number, o: any) => s + (o._count?.userVotes || 0), 0);
                const pct = total === 0 ? 0 : Math.round(((opt._count?.userVotes || 0) / total) * 100);
                return (
                  <div key={opt.id} style={{ height: '56px', background: '#334155', borderRadius: '12px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #2563EB, #3B82F6)', transition: 'width 1s cubic-bezier(0.4,0,0.2,1)' }} />
                    <div style={{ position: 'relative', zIndex: 1, padding: '0 24px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '20px', fontWeight: 700 }}>{opt.text}</span>
                      <span style={{ fontSize: '24px', fontWeight: 800 }}>{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Question */}
        {activeQuestion ? (
          <div style={{ maxWidth: '1600px', width: '100%', textAlign: 'center', animation: 'fadeIn 0.5s ease-out' }}>
            <h1 style={{
              fontSize: isMobile ? '32px' : (activePoll ? '56px' : '80px'), fontWeight: 800, lineHeight: 1.2,
              fontFamily: 'Outfit', marginBottom: '24px',
              textShadow: '0 4px 24px rgba(0,0,0,0.5)',
              background: 'linear-gradient(135deg, #FFFFFF, #E2E8F0)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              &ldquo;{activeQuestion.text}&rdquo;
            </h1>
            <p style={{ fontSize: '28px', fontWeight: 600, color: '#94A3B8' }}>
              Asked by <span style={{ color: '#38BDF8', fontWeight: 700 }}>{activeQuestion.user.name}</span>
            </p>
          </div>
        ) : !activePoll && (
          <div style={{ textAlign: 'center', color: '#475569' }}>
            <p style={{ fontSize: '32px', fontWeight: 600 }}>Waiting for highlighted content...</p>
          </div>
        )}

        <style>{`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        `}</style>
      </div>

      {/* Next Up Sidebar */}
      {nextUp.length > 0 && (
        <div style={{ position: isMobile ? 'relative' : 'fixed', right: isMobile ? 'auto' : '32px', top: isMobile ? 'auto' : '180px', width: isMobile ? '100%' : '280px', display: 'flex', flexDirection: 'column', gap: '12px', padding: isMobile ? '0 16px' : '0' }}>
          <h4 style={{ color: '#38BDF8', fontWeight: 800, textTransform: 'uppercase', fontSize: '12px', letterSpacing: '2px' }}>Coming Up Next</h4>
          {nextUp.map((q, idx) => (
            <div key={q.id} style={{
              padding: '14px', borderRadius: '12px',
              background: 'rgba(30,41,59,0.5)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(148,163,184,0.1)',
              animation: 'fadeIn 0.5s ease-out', animationDelay: `${idx * 0.1}s`,
            }}>
              <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '6px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>&ldquo;{q.text}&rdquo;</p>
              <p style={{ fontSize: '11px', color: '#64748B' }}>By {q.user.name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
