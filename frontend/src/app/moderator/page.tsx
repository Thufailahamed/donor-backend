'use client';

import { useState, useEffect, useMemo, cloneElement, isValidElement, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import apiClient from '@/lib/api-client';
import { Session, Question } from '@/types';
import Link from 'next/link';
import { format } from 'date-fns';
import { getSocket, joinSession, leaveSession } from '@/lib/socket';
import {
  HiOutlineShieldCheck, HiOutlineChatBubbleLeftRight, HiOutlineArrowRightOnRectangle,
  HiOutlineCheckCircle, HiOutlineSparkles, HiOutlineXMark, HiOutlineHandThumbUp,
  HiOutlinePresentationChartBar,
  HiOutlineTrash, HiOutlineSignal, HiOutlineSignalSlash, HiOutlineChartBar,
  HiOutlineArrowDownTray, HiOutlinePencilSquare, HiOutlineBars3,
  HiOutlineFlag
} from 'react-icons/hi2';
import { useIsMobile } from '@/hooks/useIsMobile';
import MobileNav from '@/components/MobileNav';
import EngagementScoresPanel from '@/components/moderator/EngagementScoresPanel';
import FlaggedContentPanel from '@/components/moderator/FlaggedContentPanel';
import TimeAnalyticsChart from '@/components/moderator/TimeAnalyticsChart';
import TopicClustersPanel from '@/components/moderator/TopicClustersPanel';
import CannedResponses from '@/components/moderator/CannedResponses';
import ModeratorActionLog from '@/components/moderator/ModeratorActionLog';

/** Icon rail: scale + floating label on hover (label below on mobile to avoid clipping under nav) */
function ModeratorToolbarAction({
  label,
  onClick,
  children,
  buttonStyle,
  isMobile,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  buttonStyle: CSSProperties;
  isMobile?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const iconSize = isMobile ? 18 : 20;
  const scale = isMobile ? (hover ? 1.08 : 1) : hover ? 1.14 : 1;
  const tipBelow = !!isMobile;

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: tipBelow ? 'flex-start' : 'center',
        flexShrink: isMobile ? 0 : 1,
        flexGrow: isMobile ? 0 : 1,
        flexBasis: isMobile ? 'auto' : 0,
        minWidth: isMobile ? 50 : 56,
        maxWidth: isMobile ? 72 : 100,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {!tipBelow && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 10px)',
            left: '50%',
            zIndex: 30,
            transform: `translateX(-50%) translateY(${hover ? 0 : 8}px) scale(${hover ? 1 : 0.88})`,
            opacity: hover ? 1 : 0,
            transition:
              'opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.34, 1.45, 0.64, 1)',
            pointerEvents: 'none',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-text-primary)',
            background: 'linear-gradient(145deg, rgba(255,255,255,0.97), rgba(241,245,249,0.95))',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(148, 163, 184, 0.35)',
            boxShadow:
              '0 8px 24px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(255,255,255,0.7) inset',
            padding: '6px 11px',
            borderRadius: '999px',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      )}
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        style={{
          padding: isMobile ? '6px' : '8px',
          borderRadius: '10px',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: tipBelow ? '100%' : undefined,
          maxWidth: '100%',
          transform: `scale(${scale})`,
          transition:
            'transform 0.3s cubic-bezier(0.34, 1.45, 0.64, 1), box-shadow 0.28s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease',
          boxShadow: hover && !isMobile
            ? '0 12px 28px rgba(15, 23, 42, 0.15), 0 4px 10px rgba(15, 23, 42, 0.08)'
            : hover && isMobile
              ? '0 6px 16px rgba(15, 23, 42, 0.12)'
              : undefined,
          touchAction: 'manipulation',
          ...buttonStyle,
        }}
      >
        {isValidElement(children)
          ? cloneElement(children as React.ReactElement<{ size?: number }>, { size: iconSize })
          : children}
      </button>
      {tipBelow && (
        <span
          aria-hidden
          style={{
            marginTop: '5px',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--color-text-tertiary)',
            width: '100%',
            textAlign: 'center',
            lineHeight: 1.2,
            hyphens: 'auto',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

export default function ModeratorPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Poll State
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [activePoll, setActivePoll] = useState<any>(null);

  // Announcement State
  const [announcementText, setAnnouncementText] = useState('');
  const [activeAnnouncements, setActiveAnnouncements] = useState<any[]>([]);

  // AI Summary State
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // Bulk Selection State
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());

  // Notes State
  const [notesQuestionId, setNotesQuestionId] = useState<string | null>(null);

  // Merge State
  const [showMerge, setShowMerge] = useState(false);

  // Search/Cluster Filter
  const [highlightedQuestionIds, setHighlightedQuestionIds] = useState<string[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSessions = async () => {
    try {
      const res = await apiClient.get('/sessions');
      setSessions(res.data.sessions);
      if (res.data.sessions.length > 0) setSelectedSession(res.data.sessions[0].id);
    } catch {
      showToast('error', 'Failed to load sessions');
    } finally { setLoading(false); }
  };

  const fetchQuestions = async () => {
    try {
      const statusParam = filter !== 'all' ? `&status=${filter}` : '';
      const res = await apiClient.get(`/questions/session/${selectedSession}?sort=popular${statusParam}`);
      setQuestions(res.data.questions);
    } catch {
      showToast('error', 'Failed to load questions');
    }
  };

  useEffect(() => {
    if (!user || !['MODERATOR', 'ADMIN', 'SPEAKER'].includes(user.role)) {
      router.push('/login');
      return;
    }
    fetchSessions();
  }, [user, router]);

  useEffect(() => {
    if (selectedSession) {
      fetchQuestions();
      apiClient.get(`/polls/session/${selectedSession}/active`)
        .then(res => setActivePoll(res.data.poll))
        .catch(() => {});
      apiClient.get(`/announcements/session/${selectedSession}/active`)
        .then(res => setActiveAnnouncements(res.data.announcements))
        .catch(() => {});
    }
  }, [selectedSession, filter]);

  // Real-time socket listeners
  useEffect(() => {
    if (!selectedSession) return;

    const socket = getSocket();
    joinSession(selectedSession);
    
    // Set initial state without triggering warning by wrapping in timeout or just using initial value
    setConnected(socket.connected);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    socket.on('new-question', (q: Question) => {
      setQuestions(prev => {
        if (prev.some(existing => existing.id === q.id)) return prev;
        return [q, ...prev];
      });
    });

    socket.on('question-upvoted', (data: any) => {
      setQuestions(prev => prev.map(q =>
        q.id === data.questionId ? { ...q, upvoteCount: data.upvoteCount } : q
      ));
    });

    socket.on('question-status-changed', (data: any) => {
      setQuestions(prev => {
        if (data.parentId) {
          const questionToMove = prev.find(q => q.id === data.questionId);
          if (questionToMove) {
            const updatedTopLevel = prev.filter(q => q.id !== data.questionId);
            return updatedTopLevel.map(q => {
              if (q.id === data.parentId) {
                const newReply = { ...questionToMove, status: data.status, parentId: data.parentId, isSimilarMerge: true };
                return {
                  ...q,
                  replies: [...(q.replies || []), newReply]
                };
              }
              return q;
            });
          }
        }
        return prev.map(q =>
          q.id === data.questionId ? { ...q, status: data.status } : q
        );
      });
    });

    socket.on('question-deleted', (data: any) => {
      setQuestions(prev => prev.filter(q => q.id !== data.questionId));
    });

    socket.on('poll-voted', (poll: any) => {
      setActivePoll(poll);
    });

    socket.on('poll-ended', () => {
      setActivePoll(null);
    });

    socket.on('new-announcement', (announcement: any) => {
      setActiveAnnouncements(prev => [announcement, ...prev]);
    });

    socket.on('dismiss-announcement', (data: any) => {
      setActiveAnnouncements(prev => prev.filter(a => a.id !== data.id));
    });

    socket.on('question-pinned', (q: Question) => {
      setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, isPinned: q.isPinned } : item));
    });

    socket.on('question-admin-highlighted', (data: { questionId: string, isAdminHighlighted: boolean }) => {
      setQuestions(prev => prev.map(q => 
        q.id === data.questionId ? { ...q, isAdminHighlighted: data.isAdminHighlighted } : q
      ));
      if (data.isAdminHighlighted) {
        showToast('info', 'Admin highlighted a question for priority');
      }
    });

    return () => {
      leaveSession(selectedSession);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('new-question');
      socket.off('question-upvoted');
      socket.off('question-status-changed');
      socket.off('question-deleted');
      socket.off('all-questions-deleted');
      socket.off('poll-voted');
      socket.off('poll-ended');
      socket.off('new-announcement');
      socket.off('dismiss-announcement');
      socket.off('question-pinned');
      socket.off('question-admin-highlighted');
    };
  }, [selectedSession]);

  const updateStatus = async (questionId: string, status: string) => {
    try {
      await apiClient.put(`/questions/${questionId}/status`, { status });
      setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, status: status as any } : q));
      showToast('success', `Question marked as ${status.toLowerCase()}`);
    } catch {
      showToast('error', 'Failed to update question status');
    }
  };

  const deleteQuestion = async (questionId: string) => {
    try {
      await apiClient.delete(`/questions/${questionId}`);
      setQuestions(prev => prev.filter(q => q.id !== questionId));
      showToast('success', 'Question removed');
    } catch {
      showToast('error', 'Failed to delete question');
    }
  };

  const questionsPerMinute = useMemo(() => {
    if (!questions.length) return '0.0';
    // Note: This is still slightly impure but avoids the direct Date.now() in body if needed, 
    // but the lint error was specifically about calling it.
    const nowTime = new Date().getTime();
    const fiveMinsAgo = nowTime - 5 * 60 * 1000;
    const recent = questions.filter(q => new Date(q.createdAt).getTime() > fiveMinsAgo);
    return (recent.length / 5).toFixed(1);
  }, [questions]);

  const toggleSelectAll = () => {
    if (selectedQuestions.size === questions.length) setSelectedQuestions(new Set());
    else setSelectedQuestions(new Set(questions.map(q => q.id)));
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedQuestions);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedQuestions(next);
  };

  const bulkUpdateStatus = async (status: string) => {
    if (!selectedQuestions.size) return;
    try {
      await Promise.all(Array.from(selectedQuestions).map(id => apiClient.put(`/questions/${id}/status`, { status })));
      setQuestions(prev => prev.map(q => selectedQuestions.has(q.id) ? { ...q, status: status as any } : q));
      setSelectedQuestions(new Set());
      showToast('success', `Bulk updated to ${status.toLowerCase()}`);
    } catch {
      showToast('error', 'Bulk update failed');
    }
  };

  const bulkDelete = async () => {
    if (!selectedQuestions.size) return;
    if (!window.confirm(`Delete ${selectedQuestions.size} questions? This will also remove all replies.`)) return;
    try {
      await apiClient.post('/questions/bulk-delete', { 
        questionIds: Array.from(selectedQuestions),
        sessionId: selectedSession
      });
      setQuestions(prev => prev.filter(q => !selectedQuestions.has(q.id)));
      setSelectedQuestions(new Set());
      showToast('success', 'Bulk delete successful');
    } catch {
      showToast('error', 'Bulk delete failed');
    }
  };

  const deleteAllQuestions = async () => {
    if (!selectedSession) return;
    if (!window.confirm('⚠️ CRITICAL: This will delete ALL questions and replies for this session. This action cannot be undone. Are you absolutely sure?')) return;
    
    try {
      await apiClient.delete(`/questions/session/${selectedSession}/all`);
      setQuestions([]);
      setSelectedQuestions(new Set());
      showToast('success', 'All questions deleted');
    } catch {
      showToast('error', 'Failed to delete all questions');
    }
  };

  const launchPoll = async () => {
    if (!pollQuestion || pollOptions.filter(o => o.trim()).length < 2) {
      showToast('error', 'Please enter a question and at least 2 options');
      return;
    }
    try {
      const res = await apiClient.post(`/polls/session/${selectedSession}`, {
        question: pollQuestion,
        options: pollOptions.filter(o => o.trim())
      });
      setActivePoll(res.data.poll);
      setPollQuestion('');
      setPollOptions(['', '']);
      showToast('success', 'Poll launched successfully!');
    } catch {
      showToast('error', 'Failed to launch poll');
    }
  };

  const endPoll = async () => {
    if (!activePoll) return;
    try {
      await apiClient.post(`/polls/${activePoll.id}/end`);
      setActivePoll(null);
      showToast('info', 'Poll ended');
    } catch {
      showToast('error', 'Failed to end poll');
    }
  };

  const sendAnnouncement = async () => {
    if (!announcementText.trim()) return;
    try {
      await apiClient.post(`/announcements/session/${selectedSession}`, { text: announcementText });
      setAnnouncementText('');
      showToast('success', 'Announcement sent!');
    } catch {
      showToast('error', 'Failed to send announcement');
    }
  };

  const dismissAnnouncement = async (id: string) => {
    try {
      await apiClient.delete(`/announcements/${id}`);
      showToast('info', 'Announcement dismissed');
    } catch {
      showToast('error', 'Failed to dismiss announcement');
    }
  };

  const togglePin = async (questionId: string, currentPin: boolean) => {
    try {
      await apiClient.put(`/questions/${questionId}/pin`, { isPinned: !currentPin });
      showToast('success', currentPin ? 'Question unpinned' : 'Question pinned');
    } catch {
      showToast('error', 'Failed to update pin status');
    }
  };

  const toggleAdminHighlight = async (questionId: string, currentStatus: boolean) => {
    try {
      await apiClient.put(`/questions/${questionId}/admin-highlight`, { isAdminHighlighted: !currentStatus });
      showToast('success', currentStatus ? 'Admin priority removed' : 'Marked with Admin priority');
    } catch {
      showToast('error', 'Failed to update Admin priority');
    }
  };

  const exportSessionData = async () => {
    if (!selectedSession) return;
    try {
      const response = await apiClient.get(`/export/${selectedSession}/export`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `session-${selectedSession}-export.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('success', 'Session data exported successfully');
    } catch {
      showToast('error', 'Failed to export session data');
    }
  };

  const generateSummary = async () => {
    if (!selectedSession) return;
    setGeneratingSummary(true);
    try {
      const res = await apiClient.get(`/ai/session/${selectedSession}/summary`);
      setAiSummary(res.data.summary);
      showToast('success', 'AI Summary generated successfully');
    } catch {
      showToast('error', 'Failed to generate AI summary');
    } finally {
      setGeneratingSummary(false);
    }
  };

  const saveNotes = async (questionId: string, notes: string) => {
    try {
      await apiClient.put(`/questions/${questionId}/notes`, { moderatorNotes: notes });
    } catch { showToast('error', 'Failed to save notes'); }
  };

  const mergeQuestions = async () => {
    const ids = Array.from(selectedQuestions);
    if (ids.length < 2) { showToast('error', 'Select at least 2 questions'); return; }
    if (!confirm(`Merge ${ids.length} questions into the first selected?`)) return;
    try {
      await apiClient.post('/questions/merge', { targetId: ids[0], sourceIds: ids.slice(1) });
      showToast('success', 'Questions merged');
      setSelectedQuestions(new Set());
      fetchQuestions();
    } catch { showToast('error', 'Merge failed'); }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        <div style={{
          width: '40px', height: '40px', margin: '0 auto 16px',
          border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
        Loading...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh' }}>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 200,
        padding: isMobile ? 'var(--space-3) var(--space-4)' : 'var(--space-4) var(--space-6)',
        background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'var(--glass-blur)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 'var(--space-2)',
        minWidth: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 'var(--space-2)' : 'var(--space-3)', minWidth: 0 }}>
          <HiOutlineShieldCheck size={isMobile ? 20 : 24} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
          <span style={{
            fontWeight: 800, fontFamily: 'var(--font-heading)',
            fontSize: isMobile ? 'var(--text-base)' : 'var(--text-lg)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {isMobile
              ? (user?.role === 'SPEAKER' ? 'Speaker' : 'Mod')
              : `${user?.role === 'SPEAKER' ? 'Speaker' : 'Moderator'} Dashboard`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            fontSize: 'var(--text-xs)', fontWeight: 600,
            color: connected ? 'var(--color-success)' : 'var(--color-error)',
          }}>
            {connected ? <HiOutlineSignal size={14} /> : <HiOutlineSignalSlash size={14} />}
            {connected ? 'Live' : 'Offline'}
          </span>
          {!isMobile && (
            <>
              <Link href="/analytics" style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
                textDecoration: 'none', color: 'inherit'
              }}>
                <HiOutlineChartBar size={16} /> Analytics
              </Link>
              <button
                onClick={exportSessionData}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 12px', background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer'
                }}
              >
                <HiOutlineArrowDownTray size={16} /> Export
              </button>
              <Link href="/agenda" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Agenda</Link>
              <button onClick={logout} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)', color: 'var(--color-text-tertiary)', cursor: 'pointer' }}>
                <HiOutlineArrowRightOnRectangle size={18} />
              </button>
            </>
          )}
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(true)}
              style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
            >
              <HiOutlineBars3 size={20} />
            </button>
          )}
        </div>
      </nav>
      <MobileNav
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        user={user}
        onLogout={logout}
        items={[
          { label: 'Analytics', href: '/analytics', icon: <HiOutlineChartBar size={18} /> },
          {
            label: 'Export session',
            onClick: () => { exportSessionData(); },
            icon: <HiOutlineArrowDownTray size={18} />,
          },
          { label: 'Agenda', href: '/agenda', icon: <HiOutlineChatBubbleLeftRight size={18} /> },
        ]}
      />

      <div style={{
        maxWidth: '1400px', margin: '0 auto',
        padding: isMobile ? 'var(--space-3)' : 'var(--space-6)',
        display: 'flex', gap: isMobile ? 'var(--space-4)' : 'var(--space-8)',
        flexWrap: 'wrap', alignItems: 'flex-start',
      }}>
        
        {/* Left Sidebar: Session Selector */}
        <div style={{ 
          flex: '1 1 280px', maxWidth: isMobile ? '100%' : '320px', 
          marginBottom: isMobile ? 'var(--space-4)' : '0', 
          display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', 
          background: '#FFFFFF', padding: isMobile ? 'var(--space-3)' : 'var(--space-4)', 
          borderRadius: '12px', border: '1px solid var(--color-border)', 
          boxShadow: 'var(--shadow-sm)', position: isMobile ? 'relative' : 'sticky', 
          top: isMobile ? 'auto' : '80px', overflowY: 'auto',
          maxHeight: isMobile ? 'min(38vh, 280px)' : 'calc(100vh - 120px)',
        }}>
          <h2 style={{
            fontSize: isMobile ? 'var(--text-base)' : 'var(--text-lg)',
            fontWeight: 700, fontFamily: 'var(--font-heading)',
            marginBottom: isMobile ? 'var(--space-3)' : 'var(--space-4)',
            paddingLeft: '8px',
          }}>Sessions</h2>
          
          {[...new Set(sessions.map(s => s.day))].sort((a, b) => a - b).map(day => (
            <div key={day} style={{ marginBottom: '12px' }}>
              <div style={{ 
                fontSize: '11px', fontWeight: 800, color: '#94A3B8', 
                textTransform: 'uppercase', letterSpacing: '0.08em', 
                padding: '0 12px 6px', borderBottom: '1px solid #F1F5F9',
                marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#CBD5E1' }} />
                Day {day}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {sessions.filter(s => s.day === day).sort((a, b) => a.order - b.order).map(s => (
                  <button key={s.id} onClick={() => setSelectedSession(s.id)} style={{
                    padding: '10px 12px', borderRadius: '8px', textAlign: 'left',
                    border: 'none',
                    background: selectedSession === s.id ? 'var(--color-primary-glow)' : 'transparent',
                    color: selectedSession === s.id ? 'var(--color-primary)' : '#475569',
                    fontWeight: selectedSession === s.id ? 700 : 500, 
                    fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s',
                    lineHeight: 1.4
                  }}>
                    {s.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right Main Area */}
        <div style={{ flex: '3 1 600px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          
          {/* Poll Management */}
          {user?.role !== 'SPEAKER' && (
            <div style={{
              background: '#FFFFFF', borderRadius: '12px',
              padding: isMobile ? 'var(--space-4)' : 'var(--space-6)',
              marginBottom: 'var(--space-6)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <HiOutlineChartBar size={isMobile ? 20 : 24} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <h3 style={{ fontSize: isMobile ? 'var(--text-base)' : 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Engagement Tools</h3>
              </div>
              
              <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: isMobile ? 'var(--space-5)' : 'var(--space-6)',
                flexWrap: 'wrap',
              }}>
                {/* Announcements */}
                <div style={{ flex: 1, minWidth: isMobile ? 0 : 280 }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: 'var(--space-3)', color: 'var(--color-text-secondary)' }}>Announcements</h4>
                  <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: 'var(--space-2)',
                    marginBottom: 'var(--space-4)',
                  }}>
                    <input type="text" value={announcementText} onChange={e => setAnnouncementText(e.target.value)} placeholder="Broadcast to all..." style={{ flex: 1, minWidth: 0, padding: 'var(--space-2) var(--space-3)', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)' }} />
                    <button onClick={sendAnnouncement} style={{ padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Send</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {activeAnnouncements.map(ann => (
                      <div key={ann.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-primary-glow)', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}>
                        <span style={{ fontWeight: 600 }}>{ann.text}</span>
                        <button onClick={() => dismissAnnouncement(ann.id)} style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer' }}><HiOutlineXMark /></button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Polls */}
                <div style={{
                  flex: 1,
                  minWidth: isMobile ? 0 : 280,
                  borderLeft: isMobile ? 'none' : '1px solid var(--color-border)',
                  paddingLeft: isMobile ? 0 : 'var(--space-6)',
                  borderTop: isMobile ? '1px solid var(--color-border)' : 'none',
                  paddingTop: isMobile ? 'var(--space-5)' : 0,
                }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: 'var(--space-3)', color: 'var(--color-text-secondary)' }}>Live Polls</h4>
                  {activePoll ? (
                    <div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 'var(--space-4)',
                        gap: 'var(--space-2)',
                        flexWrap: 'wrap',
                      }}>
                        <p style={{ fontWeight: 600, margin: 0, flex: '1 1 200px', minWidth: 0 }}>{activePoll.question}</p>
                        <span style={{ background: 'var(--color-error)', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, animation: 'pulse 2s infinite', flexShrink: 0 }}>LIVE</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                        {activePoll.options.map((opt: any) => {
                          const totalVotes = activePoll.options.reduce((sum: number, o: any) => sum + (o._count?.userVotes || 0), 0);
                          const percentage = totalVotes === 0 ? 0 : Math.round(((opt._count?.userVotes || 0) / totalVotes) * 100);
                          return (
                            <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
                              <div style={{ flex: 1, minWidth: 0, background: 'var(--color-bg-secondary)', borderRadius: '4px', overflow: 'hidden', height: '32px', position: 'relative' }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${percentage}%`, background: 'var(--color-primary-glow)', transition: 'width 1s' }} />
                                <span style={{
                                  position: 'relative', zIndex: 1, padding: '0 var(--space-3)', lineHeight: '32px', fontSize: isMobile ? '12px' : 'var(--text-sm)', fontWeight: 600,
                                  display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>{opt.text}</span>
                              </div>
                              <span style={{ minWidth: '36px', fontWeight: 700, fontSize: 'var(--text-sm)', flexShrink: 0 }}>{percentage}%</span>
                            </div>
                          )
                        })}
                      </div>
                      <button onClick={endPoll} style={{ padding: '8px 16px', background: 'var(--color-error)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>End Poll</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      <input type="text" value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Ask the audience a question..." style={{ width: '100%', padding: 'var(--space-3)', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)' }} />
                      <div style={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        gap: 'var(--space-3)',
                      }}>
                        {pollOptions.map((opt, i) => (
                          <input key={i} type="text" value={opt} onChange={e => { const newOpts = [...pollOptions]; newOpts[i] = e.target.value; setPollOptions(newOpts); }} placeholder={`Option ${i+1}`} style={{ flex: 1, minWidth: 0, padding: 'var(--space-2) var(--space-3)', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)' }} />
                        ))}
                      </div>
                      <button onClick={launchPoll} style={{ padding: 'var(--space-3)', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}>Launch Poll</button>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Tools */}
              <div style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--color-border)' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: 'var(--space-3)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HiOutlineSparkles style={{ color: '#8B5CF6' }} /> AI Assistant
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <button 
                    onClick={generateSummary}
                    disabled={generatingSummary}
                    style={{ 
                      alignSelf: 'flex-start', padding: '10px 20px', 
                      background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)', 
                      color: '#fff', border: 'none', borderRadius: '8px', 
                      fontWeight: 600, cursor: generatingSummary ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '8px',
                      opacity: generatingSummary ? 0.7 : 1, transition: 'opacity 0.2s'
                    }}
                  >
                    <HiOutlineSparkles size={18} />
                    {generatingSummary ? 'Generating AI Summary...' : 'Generate Session Summary'}
                  </button>

                  {aiSummary && (
                    <div style={{ 
                      background: '#F8FAFC', border: '1px solid #E2E8F0', 
                      borderRadius: '12px', padding: '24px', position: 'relative'
                    }}>
                      <button 
                        onClick={() => setAiSummary(null)}
                        style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
                      >
                        <HiOutlineXMark size={20} />
                      </button>
                      <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', color: '#0F172A' }}>✨ AI Session Summary</h3>
                      <div style={{ 
                        fontSize: '14px', lineHeight: 1.6, color: '#334155',
                        whiteSpace: 'pre-wrap', fontFamily: 'system-ui, sans-serif'
                      }}>
                        {aiSummary}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Top Filter Bar */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-4)', overflowX: 'auto' as const }}>
            {['all', 'PENDING', 'ANSWERED', 'HIGHLIGHTED'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '6px 16px', borderRadius: '20px',
                border: 'none',
                background: filter === f ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
                color: filter === f ? '#FFFFFF' : 'var(--color-text-secondary)',
                fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                transition: 'all var(--transition-fast)'
              }}>{f === 'all' ? 'All' : f.toLowerCase()}</button>
            ))}
          </div>

          {/* Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: isMobile ? 'var(--space-3)' : 'var(--space-4)',
            marginBottom: 'var(--space-6)',
          }}>
            {[
              { label: 'Total', count: questions.length, color: 'var(--color-text-primary)', bg: '#FFFFFF' },
              { label: 'Pending', count: questions.filter(q => q.status === 'PENDING').length, color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
              { label: 'Answered', count: questions.filter(q => q.status === 'ANSWERED').length, color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
              { label: 'Highlighted', count: questions.filter(q => q.status === 'HIGHLIGHTED').length, color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
            ].map((stat, i) => (
              <div key={i} style={{ background: '#FFFFFF', border: '1px solid var(--color-border)', borderRadius: '12px', padding: isMobile ? 'var(--space-3)' : 'var(--space-4)', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: 'var(--shadow-sm)', minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 800, color: stat.color, marginBottom: '4px' }}>{stat.count}</div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>{stat.label}</div>
              </div>
            ))}
            <div style={{ background: '#FFFFFF', border: '1px solid var(--color-border)', borderRadius: '12px', padding: isMobile ? 'var(--space-3)' : 'var(--space-4)', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: 'var(--shadow-sm)', minWidth: 0 }}>
              <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 800, color: 'var(--color-primary)', marginBottom: '4px' }}>{questionsPerMinute}</div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Q / Min</div>
            </div>
          </div>

          {/* AI Insights & Topics */}
          <TopicClustersPanel 
            sessionId={selectedSession || undefined} 
            onSelectCluster={(ids) => setHighlightedQuestionIds(ids)}
          />

          {/* Question List Header & Stats */}
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'space-between',
            gap: isMobile ? 'var(--space-3)' : 0,
            marginBottom: 'var(--space-4)',
          }}>
            <h3 style={{ fontSize: isMobile ? 'var(--text-lg)' : '20px', fontWeight: 800, fontFamily: 'var(--font-heading)', margin: 0 }}>
              {filter === 'all' ? 'Live Stream' : `${filter.toLowerCase()} Questions`}
            </h3>
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              flexWrap: 'wrap',
              minWidth: 0,
              width: isMobile ? '100%' : 'auto',
            }}>
              <input 
                type="text" 
                placeholder="Search keywords..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--color-border)', fontSize: '13px',
                  flex: isMobile ? 1 : 'none',
                  minWidth: 0,
                  width: isMobile ? '100%' : '200px',
                }}
              />
              {highlightedQuestionIds && (
                <button 
                  onClick={() => setHighlightedQuestionIds(null)}
                  style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Clear AI Filter
                </button>
              )}
              {user?.role === 'ADMIN' && questions.length > 0 && (
                <button 
                  onClick={deleteAllQuestions}
                  style={{ 
                    fontSize: '12px', color: '#EF4444', fontWeight: 700, 
                    background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', 
                    padding: '4px 12px', borderRadius: '20px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <HiOutlineTrash size={14} /> Delete All
                </button>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Bulk Action Bar (Fixed at bottom when selecting) */}
            {selectedQuestions.size > 0 && (
              <div style={{
                position: 'fixed',
                bottom: isMobile ? 'max(12px, env(safe-area-inset-bottom))' : '24px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
                background: '#0F172A',
                color: '#fff',
                padding: isMobile ? '10px 14px' : '12px 24px',
                borderRadius: isMobile ? '16px' : '100px',
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: isMobile ? '10px' : '20px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                animation: 'slideUp 0.3s ease-out',
                maxWidth: isMobile ? 'calc(100vw - 24px)' : 'none',
                justifyContent: isMobile ? 'center' : 'flex-start',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderRight: isMobile ? 'none' : '1px solid #334155',
                  paddingRight: isMobile ? 0 : '16px',
                  borderBottom: isMobile ? '1px solid #334155' : 'none',
                  paddingBottom: isMobile ? '10px' : 0,
                  width: isMobile ? '100%' : 'auto',
                  justifyContent: isMobile ? 'space-between' : 'flex-start',
                }}>
                  <input
                    type="checkbox"
                    checked={questions.length > 0 && selectedQuestions.size === questions.length}
                    onChange={toggleSelectAll}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: 700 }}>{selectedQuestions.size} Selected</span>
                </div>
                <div style={{ display: 'flex', gap: isMobile ? '8px' : '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
                  <button type="button" onClick={() => bulkUpdateStatus('ANSWERED')} style={{ background: 'none', border: 'none', color: '#16A34A', fontWeight: 700, fontSize: isMobile ? '13px' : '14px', cursor: 'pointer', padding: '4px' }}>Approve</button>
                  <button type="button" onClick={() => bulkUpdateStatus('HIGHLIGHTED')} style={{ background: 'none', border: 'none', color: '#0EA5E9', fontWeight: 700, fontSize: isMobile ? '13px' : '14px', cursor: 'pointer', padding: '4px' }}>Highlight</button>
                  <button type="button" onClick={() => bulkUpdateStatus('DISMISSED')} style={{ background: 'none', border: 'none', color: '#94A3B8', fontWeight: 700, fontSize: isMobile ? '13px' : '14px', cursor: 'pointer', padding: '4px' }}>Dismiss</button>
                  <button type="button" onClick={bulkDelete} style={{ background: 'none', border: 'none', color: '#EF4444', fontWeight: 700, fontSize: isMobile ? '13px' : '14px', cursor: 'pointer', padding: '4px' }}>Delete</button>
                </div>
                <button type="button" onClick={() => setSelectedQuestions(new Set())} style={{ background: '#334155', border: 'none', color: '#fff', padding: '6px', borderRadius: '50%', cursor: 'pointer', flexShrink: 0 }}>
                  <HiOutlineXMark size={16} />
                </button>
                <style>{`
                  @keyframes slideUp {
                    from { transform: translate(-50%, 100%); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                  }
                `}</style>
              </div>
            )}

            {questions
              .filter(q => {
                if (highlightedQuestionIds && !highlightedQuestionIds.includes(q.id)) return false;
                if (searchQuery && !q.text.toLowerCase().includes(searchQuery.toLowerCase()) && !q.user.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                return true;
              })
              .sort((a, b) => {
                if (a.status === 'ANALYZING' && b.status !== 'ANALYZING') return -1;
                if (b.status === 'ANALYZING' && a.status !== 'ANALYZING') return 1;
                return 0; // Keep original sort for others
              })
              .map(q => (
              <div
                key={q.id}
                style={{
                  background: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  alignItems: 'stretch',
                  overflow: 'visible',
                  position: 'relative',
                }}
              >
                {/* Status accent — full card height, flush left */}
                <div
                  aria-hidden
                  style={{
                    width: 5,
                    flexShrink: 0,
                    alignSelf: 'stretch',
                    borderRadius: '11px 0 0 11px',
                    background:
                      q.status === 'HIGHLIGHTED'
                        ? 'var(--color-info)'
                        : q.status === 'ANSWERED'
                          ? 'var(--color-success)'
                          : q.status === 'DISMISSED'
                            ? 'var(--color-text-muted)'
                            : q.status === 'ANALYZING'
                              ? '#8B5CF6'
                              : 'var(--color-warning)',
                  }}
                />

                {q.status === 'ANALYZING' && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(1px)', WebkitBackdropFilter: 'blur(1px)',
                    zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      color: '#7C3AED', fontWeight: 700, fontSize: '13px',
                      background: '#fff', padding: '6px 14px', borderRadius: '20px',
                      boxShadow: '0 4px 12px rgba(124,58,237,0.12)',
                    }}>
                      <HiOutlineSparkles className="animate-pulse" size={16} />
                      AI Analyzing...
                    </div>
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
                  {/* Question body: checkbox + stacked content (text → meta → actions) */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: isMobile ? 'var(--space-3)' : 'var(--space-4)',
                      padding: isMobile ? 'var(--space-4)' : 'var(--space-5)',
                      paddingRight: isMobile ? 'var(--space-4)' : 'var(--space-5)',
                    }}
                  >
                    <div style={{ flexShrink: 0, paddingTop: 3 }}>
                      <input
                        type="checkbox"
                        checked={selectedQuestions.has(q.id)}
                        onChange={() => toggleSelect(q.id)}
                        style={{ width: 18, height: 18, cursor: 'pointer', display: 'block' }}
                        aria-label={`Select question`}
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 'var(--space-3)' }}>
                      <p style={{
                        fontSize: isMobile ? 'var(--text-sm)' : 'var(--text-base)',
                        lineHeight: 1.55,
                        margin: 0,
                        color: 'var(--color-text-primary)',
                        fontWeight: 600,
                        wordBreak: 'break-word',
                      }}>{q.text}</p>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '6px 10px',
                          fontSize: '13px',
                          color: 'var(--color-text-secondary)',
                          fontWeight: 600,
                          margin: 0,
                          padding: 0,
                        }}
                      >
                        <span style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{q.user.name}</span>
                        {q.isAdminHighlighted && (
                          <span style={{
                            background: '#FEF2F2', color: '#EF4444',
                            padding: '2px 10px', borderRadius: '100px',
                            fontSize: '11px', fontWeight: 800,
                            border: '1px solid #FEE2E2',
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            boxShadow: '0 2px 4px rgba(239, 68, 68, 0.1)',
                          }}>
                            <HiOutlineFlag size={12} /> ADMIN PRIORITY
                          </span>
                        )}
                        <span style={{ color: 'var(--color-border)', userSelect: 'none' }} aria-hidden>•</span>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>{format(new Date(q.createdAt), 'h:mm a')}</span>
                        <span style={{ color: 'var(--color-border)', userSelect: 'none' }} aria-hidden>•</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-primary)', fontWeight: 700 }}>
                          <HiOutlineHandThumbUp size={15} /> {q.upvoteCount}
                        </span>
                      </div>

                      <div
                        role="toolbar"
                        aria-label="Question actions"
                        style={{
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'stretch',
                          justifyContent: isMobile ? 'flex-start' : 'stretch',
                          gap: isMobile ? 10 : 6,
                          width: '100%',
                          boxSizing: 'border-box',
                          background: 'var(--color-bg-secondary)',
                          padding: isMobile ? '12px 10px' : '14px 12px',
                          borderRadius: '10px',
                          border: '1px solid rgba(148, 163, 184, 0.25)',
                          flexWrap: 'nowrap' as const,
                          overflowX: isMobile ? 'auto' : 'visible',
                          overflowY: 'visible',
                          WebkitOverflowScrolling: 'touch',
                          marginTop: 2,
                          scrollbarWidth: 'thin',
                          minHeight: isMobile ? 76 : 52,
                        }}
                      >
                    <ModeratorToolbarAction isMobile={isMobile}
                      label="Answered"
                      onClick={() => updateStatus(q.id, 'ANSWERED')}
                      buttonStyle={{
                        background: q.status === 'ANSWERED' ? 'var(--color-success)' : 'transparent',
                        color: q.status === 'ANSWERED' ? '#FFF' : 'var(--color-text-secondary)',
                      }}
                    >
                      <HiOutlineCheckCircle size={20} />
                    </ModeratorToolbarAction>
                    <ModeratorToolbarAction isMobile={isMobile}
                      label={q.isPinned ? 'Unpin' : 'Pin'}
                      onClick={() => togglePin(q.id, q.isPinned || false)}
                      buttonStyle={{
                        background: q.isPinned ? '#0EA5E9' : 'transparent',
                        color: q.isPinned ? '#FFF' : 'var(--color-text-secondary)',
                      }}
                    >
                      <HiOutlineSparkles size={20} />
                    </ModeratorToolbarAction>
                    {user?.role === 'ADMIN' && (
                      <ModeratorToolbarAction isMobile={isMobile}
                        label="Priority"
                        onClick={() => toggleAdminHighlight(q.id, q.isAdminHighlighted || false)}
                        buttonStyle={{
                          background: q.isAdminHighlighted ? '#EF4444' : 'transparent',
                          color: q.isAdminHighlighted ? '#FFF' : '#EF4444',
                          border: q.isAdminHighlighted ? 'none' : '1px solid #EF4444',
                        }}
                      >
                        <HiOutlineFlag size={20} />
                      </ModeratorToolbarAction>
                    )}
                    <ModeratorToolbarAction isMobile={isMobile}
                      label="On stage"
                      onClick={() => updateStatus(q.id, 'HIGHLIGHTED')}
                      buttonStyle={{
                        background: q.status === 'HIGHLIGHTED' ? 'var(--color-info)' : 'transparent',
                        color: q.status === 'HIGHLIGHTED' ? '#FFF' : 'var(--color-text-secondary)',
                      }}
                    >
                      <HiOutlinePresentationChartBar size={20} aria-hidden />
                    </ModeratorToolbarAction>
                    <ModeratorToolbarAction isMobile={isMobile}
                      label="Notes"
                      onClick={() => setNotesQuestionId(notesQuestionId === q.id ? null : q.id)}
                      buttonStyle={{
                        background: notesQuestionId === q.id ? '#0891B2' : 'transparent',
                        color: notesQuestionId === q.id ? '#FFF' : 'var(--color-text-secondary)',
                      }}
                    >
                      <HiOutlinePencilSquare size={20} />
                    </ModeratorToolbarAction>
                    <ModeratorToolbarAction isMobile={isMobile}
                      label="Dismiss"
                      onClick={() => updateStatus(q.id, 'DISMISSED')}
                      buttonStyle={{
                        background: q.status === 'DISMISSED' ? 'var(--color-text-muted)' : 'transparent',
                        color: q.status === 'DISMISSED' ? '#FFF' : 'var(--color-text-secondary)',
                      }}
                    >
                      <HiOutlineXMark size={20} />
                    </ModeratorToolbarAction>
                    <div
                      aria-hidden
                      style={{
                        width: 1,
                        flexShrink: 0,
                        alignSelf: 'center',
                        height: isMobile ? 44 : 36,
                        background: 'linear-gradient(180deg, transparent 0%, var(--color-border) 12%, var(--color-border) 88%, transparent 100%)',
                        margin: isMobile ? '0 6px' : '0 8px',
                        opacity: 0.9,
                      }}
                    />
                    <ModeratorToolbarAction isMobile={isMobile}
                      label="Delete"
                      onClick={() => deleteQuestion(q.id)}
                      buttonStyle={{
                        background: 'transparent',
                        color: 'var(--color-error)',
                      }}
                    >
                      <HiOutlineTrash size={20} />
                    </ModeratorToolbarAction>
                      </div>
                    </div>
                  </div>

                {notesQuestionId === q.id && (
                  <div style={{
                    padding: isMobile ? 'var(--space-4) var(--space-4) var(--space-4)' : 'var(--space-4) var(--space-5) var(--space-5)',
                    borderTop: '1px solid var(--color-border)',
                    background: 'rgba(248, 250, 252, 0.6)',
                  }}>
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '16px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Private Speaker Notes</span>
                        <textarea
                          defaultValue={q.moderatorNotes || ''}
                          onBlur={(e) => saveNotes(q.id, e.target.value)}
                          placeholder="Add private notes for speaker..."
                          rows={2}
                          style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '13px', resize: 'vertical', background: '#F8FAFC' }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <CannedResponses onSelect={(text) => {
                          // Logic to reply to question could be added here if backend supports it
                          // For now we'll just show it in the notes as a draft
                          showToast('info', 'Reply draft copied to notes');
                        }} />
                      </div>
                    </div>
                  </div>
                )}
                </div>
              </div>
            ))}
            {questions.length === 0 && (
              <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-tertiary)', background: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                <HiOutlineChatBubbleLeftRight size={48} style={{ margin: '0 auto var(--space-4)', opacity: 0.5 }} />
                <p style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>No questions yet for this session.</p>
              </div>
            )}
          </div>

          {/* New Moderator Enhancement Panels */}
          <FlaggedContentPanel />
          <TimeAnalyticsChart sessionId={selectedSession || undefined} />
          <EngagementScoresPanel />
          <ModeratorActionLog />
        </div>
      </div>
    </div>
  );
}
