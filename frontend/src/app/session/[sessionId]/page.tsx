'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import apiClient from '@/lib/api-client';
import { getSocket, joinSession, leaveSession } from '@/lib/socket';
import { Session, Question } from '@/types';
import { format } from 'date-fns';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import SkeletonCard from '@/components/SkeletonCard';
import BoardView from '@/components/BoardView';
import { useIsMobile } from '@/hooks/useIsMobile';
import MobileNav from '@/components/MobileNav';
import {
  HiOutlineArrowLeft, HiOutlineArrowRightOnRectangle, HiOutlineClock, HiOutlineHandThumbUp,
  HiHandThumbUp, HiOutlinePaperAirplane, HiOutlineMicrophone, HiMicrophone,
  HiOutlineUserGroup, HiOutlineStar, HiOutlineCheckCircle, HiOutlineStop,
  HiOutlineSignal, HiOutlineSignalSlash, HiOutlineDocumentText, HiOutlineChartBar,
  HiOutlineSparkles, HiOutlineChatBubbleLeft, HiOutlineHeart, HiOutlineFire,
  HiOutlineTrash, HiMiniPlay, HiMiniPause, HiOutlineArrowUturnLeft,
  HiOutlineChatBubbleOvalLeftEllipsis, HiOutlineMagnifyingGlass,
  HiOutlineBars3
} from 'react-icons/hi2';

export default function SessionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;
  const { showToast } = useToast();

  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [activeTab, setActiveTab] = useState('qa');
  const [participantCount, setParticipantCount] = useState(0);
  const [sortBy, setSortBy] = useState('popular');
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [justUpvoted, setJustUpvoted] = useState<Set<string>>(new Set());

  // Voice Note State
  const [voiceNotes, setVoiceNotes] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Content & Polls State
  const [contents, setContents] = useState<any[]>([]);
  const [activePoll, setActivePoll] = useState<any>(null);

  // Engagement State
  const [typingIndicator, setTypingIndicator] = useState<string | null>(null);
  const [reactions, setReactions] = useState<{id: string, emoji: string, userId: string}[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // New Q&A Features State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const insertEmoji = (emoji: string) => {
    setNewQuestion(prev => prev + emoji);
    setShowEmojiPicker(false);
    setTimeout(() => document.getElementById('qa-input')?.focus(), 0);
  };

  // Phase 2 State
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [celebration, setCelebration] = useState(false);
  const reactionCountRef = useRef(0);
  const celebrationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await apiClient.get(`/sessions/${sessionId}`);
      const s = res.data.session;
      if (!s.isActive && user?.role !== 'ADMIN') {
        router.push('/');
        return;
      }
      setSession(s);
    } catch {
      showToast('error', 'Failed to load session details');
    } finally { setLoading(false); }
  }, [sessionId, user, router, showToast]);

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await apiClient.get(`/questions/session/${sessionId}?sort=${sortBy}`);
      setQuestions(res.data.questions);
    } catch {
      showToast('error', 'Failed to load questions');
    } finally {
      setQuestionsLoading(false);
    }
  }, [sessionId, sortBy, showToast]);

  const fetchVoiceNotes = useCallback(async () => {
    try {
      const res = await apiClient.get(`/voicenotes/session/${sessionId}`);
      setVoiceNotes(res.data.voiceNotes);
    } catch {
      // Ignore
    }
  }, [sessionId]);

  const fetchContents = useCallback(async () => {
    try {
      const res = await apiClient.get(`/content/session/${sessionId}`);
      setContents(res.data.content);
    } catch {}
  }, [sessionId]);

  const fetchActivePoll = useCallback(async () => {
    try {
      const res = await apiClient.get(`/polls/session/${sessionId}/active`);
      setActivePoll(res.data.poll);
    } catch {}
  }, [sessionId]);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await apiClient.get(`/announcements/session/${sessionId}/active`);
      setAnnouncements(res.data.announcements);
    } catch {}
  }, [sessionId]);

  useEffect(() => {
    if (!user) { router.push('/join'); return; }
    fetchSession();
    fetchQuestions();
    fetchVoiceNotes();
    fetchContents();
    fetchActivePoll();
    fetchAnnouncements();

    const socket = getSocket();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', () => setConnected(false));
    socket.on('reconnect_failed', () => {
      showToast('error', 'Connection lost. Please refresh the page.');
    });
    // Use timeout to avoid direct setState in render/effect body warning
    setTimeout(() => setConnected(socket.connected), 0);

    joinSession(sessionId);

    socket.on('new-question', (q: Question) => {
      if (q.parentId) {
        setQuestions(prev => prev.map(parent => 
          parent.id === q.parentId 
            ? { ...parent, replies: [...(parent.replies || []), q] }
            : parent
        ));
        // Auto-expand thread when new reply arrives
        setExpandedThreads(prev => new Set(prev).add(q.parentId!));
      } else {
        setQuestions(prev => [q, ...prev]);
      }
    });
    socket.on('question-upvoted', (data: any) => {
      setQuestions(prev => prev.map(q =>
        q.id === data.questionId ? { ...q, upvoteCount: data.upvoteCount, hasUpvoted: data.userId === user.id ? data.action === 'added' : q.hasUpvoted } : q
      ));
    });
    socket.on('question-status-changed', (data: any) => {
      setQuestions(prev => {
        // Case 1: The question was a top-level question but is now a reply (Merged Duplicate)
        if (data.parentId) {
          const questionToMove = prev.find(q => q.id === data.questionId);
          if (questionToMove) {
            // Remove from top-level, add to parent's replies
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

        // Case 2: Normal status update
        return prev.map(q =>
          q.id === data.questionId ? { ...q, status: data.status, isFlagged: data.isFlagged, isSimilarMerge: data.isSimilarMerge } : q
        );
      });
      if (data.status === 'HIGHLIGHTED' && data.userId === user.id) {
        showToast('success', 'Your question is now live on stage!');
      }
    });
    socket.on('question-deleted', (data: any) => {
      setQuestions(prev => {
        // First try to remove as a top-level question
        const filtered = prev.filter(q => q.id !== data.questionId);
        // Also remove from any parent's replies array
        return filtered.map(q => ({
          ...q,
          replies: q.replies?.filter(r => r.id !== data.questionId),
        }));
      });
    });
    socket.on('participant-count', (data: any) => {
      if (data.sessionId === sessionId) setParticipantCount(data.count);
    });
    socket.on('new-voicenote', (vn: any) => {
      setVoiceNotes(prev => [vn, ...prev]);
    });
    socket.on('poll-started', (poll: any) => {
      setActivePoll(poll);
      showToast('info', 'A new live poll has started!');
    });
    socket.on('poll-voted', (poll: any) => {
      setActivePoll((prev: any) => prev && prev.id === poll.id ? { ...poll, hasVoted: prev.hasVoted, votedOptionId: prev.votedOptionId } : prev);
    });
    socket.on('poll-ended', (poll: any) => {
      setActivePoll((prev: any) => prev && prev.id === poll.id ? null : prev);
      showToast('info', 'The live poll has ended.');
    });
    socket.on('voicenote-deleted', (data: any) => {
      setVoiceNotes(prev => prev.filter(vn => vn.id !== data.voiceNoteId));
    });
    socket.on('typing-start', (data: any) => {
      setTypingIndicator(`${data.name} is typing...`);
    });
    socket.on('typing-stop', () => {
      setTypingIndicator(null);
    });
    socket.on('new-reaction', (data: any) => {
      setReactions(prev => [...prev, data]);
      
      // Reaction burst logic
      reactionCountRef.current++;
      if (reactionCountRef.current >= 10 && !celebration) {
        setCelebration(true);
        if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
        celebrationTimeoutRef.current = setTimeout(() => setCelebration(false), 5000);
      }
      setTimeout(() => { reactionCountRef.current--; }, 3000);

      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== data.id));
      }, 3000);
    });

    socket.on('question-pinned', (q: Question) => {
      setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, isPinned: q.isPinned } : item));
    });
    socket.on('session-status-changed', (data: any) => {
      if (data.sessionId === sessionId && !data.isActive && user?.role !== 'ADMIN') {
        showToast('info', 'This session has been closed by the admin.');
        router.push('/');
      } else if (data.sessionId === sessionId) {
        setSession(prev => prev ? { ...prev, isActive: data.isActive } : null);
      }
    });

    socket.on('new-announcement', (announcement: any) => {
      setAnnouncements(prev => [announcement, ...prev]);
    });

    socket.on('dismiss-announcement', (data: any) => {
      setAnnouncements(prev => prev.filter(a => a.id !== data.id));
    });

    return () => {
      leaveSession(sessionId);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error');
      socket.off('reconnect_failed');
      socket.off('new-question');
      socket.off('question-upvoted');
      socket.off('question-status-changed');
      socket.off('question-deleted');
      socket.off('participant-count');
      socket.off('new-voicenote');
      socket.off('poll-started');
      socket.off('poll-voted');
      socket.off('poll-ended');
      socket.off('voicenote-deleted');
      socket.off('typing-start');
      socket.off('typing-stop');
      socket.off('new-reaction');
    };
  }, [sessionId, user, router, fetchSession, fetchQuestions, fetchVoiceNotes, fetchContents, fetchActivePoll, fetchAnnouncements, showToast, celebration]);

  useEffect(() => { fetchQuestions(); }, [sortBy]);

  const submitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || submitting) return;
    if (!connected) {
      showToast('error', 'No connection. Please wait and try again.');
      return;
    }

    const questionText = newQuestion;
    const parentId = replyingTo;
    
    setNewQuestion('');
    setReplyingTo(null);
    getSocket().emit('typing-stop', { sessionId });

    const pendingId = `pending-${Date.now()}`;
    const newPending = {
      id: pendingId,
      text: questionText,
      parentId,
      isPending: true,
      user: { name: user?.name, isGuest: user?.isGuest },
      createdAt: new Date().toISOString(),
      upvoteCount: 0,
      hasUpvoted: false,
      status: 'PENDING',
      timer: setTimeout(() => executeSubmission(questionText, parentId, pendingId), 5000)
    };
    
    setPendingSubmissions(prev => [...prev, newPending]);
  };

  const cancelSubmission = (pendingId: string) => {
    setPendingSubmissions(prev => {
      const item = prev.find(p => p.id === pendingId);
      if (item) {
        clearTimeout(item.timer);
        setNewQuestion(item.text);
      }
      return prev.filter(p => p.id !== pendingId);
    });
  };

  const executeSubmission = async (text: string, parentId: string | null, pendingId: string) => {
    try {
      await apiClient.post(`/questions/session/${sessionId}`, { text, parentId });
      showToast('success', parentId ? 'Reply posted' : 'Question submitted');
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Failed to submit question');
      setNewQuestion(text);
    } finally {
      setPendingSubmissions(prev => prev.filter(p => p.id !== pendingId));
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewQuestion(e.target.value);
    if (connected && !replyingTo) {
      getSocket().emit('typing-start', { sessionId });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        getSocket().emit('typing-stop', { sessionId });
      }, 2000);
    }
  };

  const sendReaction = (emoji: string) => {
    if (connected) {
      getSocket().emit('new-reaction', { sessionId, emoji });
    }
  };

  const toggleUpvote = async (questionId: string) => {
    try {
      const res = await apiClient.post(`/questions/${questionId}/upvote`);
      setQuestions(prev => prev.map(q =>
        q.id === questionId ? { ...q, upvoteCount: res.data.upvoteCount, hasUpvoted: res.data.hasUpvoted } : q
      ));
      if (res.data.hasUpvoted) {
        setJustUpvoted(prev => { const s = new Set(prev); s.add(questionId); return s; });
        setTimeout(() => setJustUpvoted(prev => { const s = new Set(prev); s.delete(questionId); return s; }), 400);
      }
    } catch {
      showToast('error', 'Failed to update vote');
    }
  };

  const deleteFeedItem = async (itemId: string, type: string) => {
    try {
      if (type === 'question') {
        await apiClient.delete(`/questions/${itemId}`);
        setQuestions(prev => prev.filter(q => q.id !== itemId));
      } else {
        await apiClient.delete(`/voicenotes/${itemId}`);
        setVoiceNotes(prev => prev.filter(vn => vn.id !== itemId));
      }
      showToast('success', 'Deleted successfully');
    } catch {
      showToast('error', 'Failed to delete');
    }
  };

  const submitFeedback = async () => {
    if (!feedbackRating) return;
    try {
      await apiClient.post(`/feedback/session/${sessionId}`, {
        rating: feedbackRating, text: feedbackText, type: 'session',
      });
      setFeedbackSubmitted(true);
      showToast('success', 'Thank you for your feedback!');
    } catch (err: any) {
      if (err.response?.status === 409) {
        showToast('info', 'You have already submitted feedback for this session');
        setFeedbackSubmitted(true);
      } else {
        showToast('error', err.response?.data?.error || 'Failed to submit feedback');
      }
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('error', 'Voice recording is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      showToast('error', 'Voice recording is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'voicenote.webm');
        formData.append('duration', recordingDuration.toString());

        try {
          await apiClient.post(`/voicenotes/session/${sessionId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          showToast('success', 'Voice note submitted successfully!');
        } catch (error) {
          showToast('error', 'Failed to submit voice note');
        }
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => setRecordingDuration(p => p + 1), 1000);
    } catch (err) {
      showToast('error', 'Microphone access denied or not available');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const votePoll = async (optionId: string) => {
    if (!activePoll || activePoll.hasVoted) return;
    setActivePoll((prev: any) => ({ ...prev, hasVoted: true, votedOptionId: optionId }));
    try {
      await apiClient.post(`/polls/${activePoll.id}/vote`, { optionId });
    } catch {
      showToast('error', 'Failed to vote in poll');
      setActivePoll((prev: any) => ({ ...prev, hasVoted: false, votedOptionId: null }));
    }
  };

  const similarCount = (item: any) =>
    (item.type === 'question' ? (item.replies || []).filter((r: any) => r.isSimilarMerge).length : 0);

  const feedItemsRaw = [
    ...questions.map(q => ({ ...q, type: 'question' })),
    ...voiceNotes.map(vn => ({ ...vn, type: 'voicenote' }))
  ].sort((a: any, b: any) => {
    // Always put ANALYZING questions at the top
    if (a.status === 'ANALYZING' && b.status !== 'ANALYZING') return -1;
    if (b.status === 'ANALYZING' && a.status !== 'ANALYZING') return 1;

    if (sortBy === 'popular') {
      const simDiff = similarCount(b) - similarCount(a);
      if (simDiff !== 0) return simDiff;
      return (b.upvoteCount || 0) - (a.upvoteCount || 0);
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const feedItemsFiltered = feedItemsRaw.filter(item => {
    if (searchQuery && item.text && !item.text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterMode === 'mine' && item.userId !== user?.id) return false;
    if (filterMode === 'answered' && item.status !== 'ANSWERED') return false;
    if (filterMode !== 'answered' && item.status === 'ANSWERED') return false;
    return true;
  });

  const feedItems = [
    ...pendingSubmissions.map(p => ({ ...p, type: 'question' })),
    ...feedItemsFiltered
  ];

  // ─── AI Clustering State ───
  const [clusters, setClusters] = useState<{ label: string; emoji: string; questionIds: string[] }[]>([]);
  const [clusterLoading, setClusterLoading] = useState(false);
  const lastClusteredCount = useRef(0);

  useEffect(() => {
    // Fetch clusters in both board and list view
    if (feedItems.length > 0) {
      if (lastClusteredCount.current !== feedItems.length) {
        lastClusteredCount.current = feedItems.length;
        setClusterLoading(true);
        apiClient.get(`/ai/session/${sessionId}/clusters`)
          .then(res => {
            if (res.data.clusters?.length > 0) setClusters(res.data.clusters);
          })
          .catch(() => { /* ignore */ })
          .finally(() => setClusterLoading(false));
      }
    }
  }, [feedItems.length, sessionId]);

  const timeAgo = (date: string) => {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (diff < 1) return 'just now';
    if (diff < 60) return `${diff} min${diff > 1 ? 's' : ''} ago`;
    const hrs = Math.floor(diff / 60);
    return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase() : name.slice(0,2).toUpperCase();
  };

  const avatarColors = ['#2563EB','#0F172A','#7C3AED','#059669','#DC2626','#D97706','#0891B2','#4F46E5'];

  const MAX_QUESTION_LENGTH = 280;

  // Session progress bar (0–100%)
  const sessionProgressPct = (() => {
    if (!session?.startTime || !session?.endTime) return 0;
    const start = new Date(session.startTime).getTime();
    const end = new Date(session.endTime).getTime();
    const now = Date.now();
    if (now <= start) return 0;
    if (now >= end) return 100;
    return Math.round(((now - start) / (end - start)) * 100);
  })();

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(248,250,255,0.6) 0%, rgba(255,255,255,0.4) 100%)' }}>
      <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div style={{
            width: '48px', height: '48px', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
            borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-glow-primary)',
          }}>
            <HiOutlineSparkles size={24} style={{ color: '#fff', animation: 'pulse 2s infinite' }} />
          </div>
          <p style={{ fontWeight: 600, fontSize: 'var(--text-base)', marginBottom: '4px' }}>Loading session...</p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Preparing your experience</p>
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
        </motion.div>
      </div>
    </div>
  );

  if (!session) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', background: 'linear-gradient(135deg, rgba(248,250,255,0.6) 0%, rgba(255,255,255,0.4) 100%)' }}>
      <div style={{
        width: '80px', height: '80px', margin: '0 auto 24px',
        borderRadius: '20px', background: 'var(--color-error-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <HiOutlineDocumentText size={36} style={{ color: 'var(--color-error)' }} />
      </div>
      <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '8px' }}>Session Not Found</h3>
      <p style={{ fontSize: 'var(--text-sm)', marginBottom: '24px' }}>The session you're looking for doesn't exist.</p>
      <Link href="/agenda" style={{
        padding: '12px 24px', borderRadius: 'var(--radius-full)', background: 'var(--color-primary)',
        color: '#fff', fontWeight: 600, textDecoration: 'none',
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        boxShadow: 'var(--shadow-glow-primary)', transition: 'all var(--transition-fast)',
      }}>
        Back to Agenda
      </Link>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'rgba(239,243,248,0.65)', fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column', position: 'relative', overflowX: 'hidden' }}>
      
      {/* Celebration Overlay */}
      <AnimatePresence>
        {celebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 999, pointerEvents: 'none',
              background: 'radial-gradient(circle, rgba(37,99,235,0.1) 0%, transparent 70%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div className="confetti-container">
              {[...Array(20)].map((_, i) => (
                <div key={i} className="confetti" style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  backgroundColor: avatarColors[Math.floor(Math.random() * avatarColors.length)]
                }} />
              ))}
            </div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              style={{ fontSize: '100px' }}
            >
              🔥
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .confetti-container { position: absolute; width: 100%; height: 100%; }
        .confetti {
          position: absolute; width: 10px; height: 10px;
          top: -10px; animation: fall 3s linear infinite;
        }
        @keyframes fall {
          to { transform: translateY(100vh) rotate(360deg); }
        }
      `}</style>
      {/* ── Top Navigation Bar ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '2px solid #2563EB',
        padding: `0 ${isMobile ? '12px' : '24px'}`, height: '52px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/agenda" style={{ display: 'flex', alignItems: 'center', color: '#475569', textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#2563EB'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#475569'}
          >
            <HiOutlineArrowLeft size={20} />
          </Link>
          <span style={{ fontWeight: 800, fontSize: isMobile ? '13px' : '15px', color: '#2563EB', fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em', maxWidth: isMobile ? '120px' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
            {isMobile ? session.title : 'IDES Donor Summit 2025'}
          </span>
        </div>

        {!isMobile && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569' }}>
              <span style={{ color: '#2563EB' }}>📍</span>
              <span style={{ fontWeight: 600 }}>{session.location || 'Main Ballroom'}</span>
              <span style={{ color: '#CBD5E1' }}>•</span>
              <span style={{ fontWeight: 500 }}>{session.title}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              {[
                { key: 'qa', label: 'Live Q&A' },
                { key: 'feedback', label: 'Feedback' },
                { key: 'info', label: 'Resources' },
              ].map(n => (
                <button key={n.key} onClick={() => setActiveTab(n.key)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px',
                  fontWeight: activeTab === n.key ? 700 : 500,
                  color: activeTab === n.key ? '#2563EB' : '#64748B',
                  borderBottom: activeTab === n.key ? '2px solid #2563EB' : '2px solid transparent',
                  padding: '14px 0', transition: 'all 0.2s',
                }}>{n.label}</button>
              ))}
              {['ADMIN','MODERATOR'].includes(user?.role||'') && (
                <Link href="/moderator" style={{ fontSize: '13px', color: '#64748B', textDecoration: 'none', fontWeight: 500 }}>Moderator</Link>
              )}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '4px 10px', borderRadius: '20px',
                background: connected ? '#DCFCE7' : '#FEE2E2',
                fontSize: '11px', fontWeight: 700,
                color: connected ? '#16A34A' : '#DC2626',
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: connected ? '#16A34A' : '#DC2626' }} />
                {connected ? 'Connected' : 'Offline'}
              </div>
            </div>
          </>
        )}

        {isMobile && (
          <button onClick={() => setMobileMenuOpen(true)} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px', color: '#475569', cursor: 'pointer' }}>
            <HiOutlineBars3 size={20} />
          </button>
        )}
      </nav>

      {/* ── Sub Navbar (Sticky on Mobile) ── */}
      {session && (
        <div style={{
          position: isMobile ? 'sticky' : 'static', top: isMobile ? '52px' : '0', zIndex: 90,
          display: 'flex', borderBottom: '1px solid #E2E8F0', background: '#FFFFFF',
          padding: '0 16px', overflowX: 'auto', scrollbarWidth: 'none',
        }}>
          {[
            { key: 'qa', label: 'Q&A' },
            { key: 'feedback', label: 'Feedback' },
            { key: 'info', label: 'Resources' },
          ].map(n => (
            <button key={n.key} onClick={() => setActiveTab(n.key)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: isMobile ? '12px' : '13px',
              fontWeight: activeTab === n.key ? 700 : 500,
              color: activeTab === n.key ? '#2563EB' : '#64748B',
              borderBottom: activeTab === n.key ? '2px solid #2563EB' : '2px solid transparent',
              padding: isMobile ? '14px 12px' : '12px 16px', transition: 'all 0.2s', whiteSpace: 'nowrap' as const,
            }}>{n.label}</button>
          ))}
        </div>
      )}

      <MobileNav
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        user={user}
        items={[
          ...(['ADMIN','MODERATOR'].includes(user?.role||'') ? [{ label: 'Moderator', href: '/moderator' }] : []),
        ]}
      />

      {/* ── Session Progress Bar ── */}
      {sessionProgressPct > 0 && sessionProgressPct < 100 && (
        <div style={{ position: 'sticky', top: '52px', zIndex: 99, height: '3px', background: '#E2E8F0' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${sessionProgressPct}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #2563EB, #60A5FA)',
              borderRadius: '0 2px 2px 0',
              position: 'relative',
            }}
          >
            {/* Glow tip */}
            <div style={{
              position: 'absolute', right: 0, top: '-3px',
              width: '8px', height: '9px', borderRadius: '50%',
              background: '#2563EB', boxShadow: '0 0 6px 2px rgba(37,99,235,0.5)',
            }} />
          </motion.div>
        </div>
      )}

      {/* ── Main Content ── */}
      <div style={{ flex: 1, maxWidth: viewMode === 'board' ? '1200px' : '720px', width: '100%', margin: '0 auto', padding: isMobile ? '12px 12px 160px' : '24px 16px 120px', transition: 'all 0.3s ease' }}>

        {/* Global Announcements Banner */}
        <AnimatePresence>
          {announcements.map(ann => (
            <motion.div
              key={ann.id}
              initial={{ height: 0, opacity: 0, marginBottom: 0 }}
              animate={{ height: 'auto', opacity: 1, marginBottom: 16 }}
              exit={{ height: 0, opacity: 0, marginBottom: 0 }}
              style={{
                background: 'linear-gradient(90deg, #2563EB, #3B82F6)',
                borderRadius: '12px', padding: '16px 20px', color: '#fff',
                display: 'flex', alignItems: 'center', gap: '12px',
                boxShadow: '0 4px 12px rgba(37,99,235,0.2)', overflow: 'hidden'
              }}
            >
              <HiOutlineSparkles size={24} className="animate-pulse" />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: '14px' }}>ANNOUNCEMENT</p>
                <p style={{ fontSize: '15px', fontWeight: 500 }}>{ann.text}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* ── Q&A Tab ── */}
        {activeTab === 'qa' && (
          <>
            {/* Session Header Card */}
            <div style={{
              background: '#FFFFFF', borderRadius: '12px', padding: isMobile ? '20px 16px 16px' : '28px 28px 24px',
              marginBottom: '20px', border: '1px solid #E2E8F0',
            }}>
              <h1 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 800, color: '#0F172A', marginBottom: '6px', fontFamily: 'var(--font-heading)', lineHeight: 1.3 }}>
                {session.title}
              </h1>
              {session.speakers?.length > 0 && (
                <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HiOutlineUserGroup size={15} style={{ color: '#94A3B8' }} />
                  {session.speakers.map(sp => sp.speaker.name).join(', ')}
                </p>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: isMobile ? '8px' : '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HiOutlineChatBubbleLeft size={18} style={{ color: '#2563EB' }} />
                  <span style={{ fontWeight: 700, fontSize: isMobile ? '14px' : '15px', color: '#0F172A' }}>Live Q&A</span>
                </div>
                
                {/* Search Bar */}
                <div style={{ flex: 1, minWidth: isMobile ? '100%' : '200px', maxWidth: isMobile ? '100%' : '300px', position: 'relative', order: isMobile ? 3 : 0 }}>
                  <HiOutlineMagnifyingGlass size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    type="text"
                    placeholder="Search questions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px 10px 34px', borderRadius: '10px',
                      border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: '13px',
                      outline: 'none', transition: 'all 0.2s'
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = '#2563EB'}
                    onBlur={e => e.currentTarget.style.borderColor = '#E2E8F0'}
                  />
                </div>

                <span style={{
                  background: '#DBEAFE', color: '#2563EB', padding: '4px 10px',
                  borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                  marginLeft: isMobile ? '0' : 'auto'
                }}>
                  {participantCount} Online
                </span>
              </div>

              {/* Toggles Row */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center' }}>
                
                {/* Filters */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'mine', label: 'My Questions' },
                    { key: 'answered', label: 'Answered' }
                  ].map(f => (
                    <button key={f.key} onClick={() => setFilterMode(f.key)} style={{
                      padding: '6px 12px', borderRadius: '14px', border: 'none', cursor: 'pointer',
                      background: filterMode === f.key ? '#2563EB' : '#F1F5F9',
                      color: filterMode === f.key ? '#fff' : '#64748B',
                      fontWeight: 600, fontSize: '12px', transition: 'all 0.2s',
                    }}>{f.label}</button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  {/* Sort Toggle */}
                  <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                    {[
                      { key: 'popular', label: 'Top' },
                      { key: 'newest', label: 'Latest' },
                    ].map(s => (
                      <button key={s.key} onClick={() => setSortBy(s.key)} style={{
                        padding: '8px 14px', border: 'none', cursor: 'pointer',
                        background: sortBy === s.key ? '#2563EB' : '#FFFFFF',
                        color: sortBy === s.key ? '#FFFFFF' : '#64748B',
                        fontWeight: 700, fontSize: '12px', transition: 'all 0.2s',
                      }}>{s.label}</button>
                    ))}
                  </div>

                  {/* View Mode Toggle */}
                  <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                    {[
                      { key: 'list', label: '☰ List' },
                      { key: 'board', label: '▦ Board' },
                    ].map(v => (
                      <button key={v.key} onClick={() => setViewMode(v.key as any)} style={{
                        padding: '8px 14px', border: 'none', cursor: 'pointer',
                        background: viewMode === v.key ? '#2563EB' : '#FFFFFF',
                        color: viewMode === v.key ? '#FFFFFF' : '#64748B',
                        fontWeight: 700, fontSize: '12px', transition: 'all 0.2s',
                      }}>{v.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Active Poll */}
            {activePoll && (
              <div style={{
                background: '#FFFFFF', borderRadius: '12px', padding: '24px', marginBottom: '16px',
                border: '2px solid #2563EB', boxShadow: '0 0 0 4px rgba(37,99,235,0.08)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <HiOutlineChartBar size={20} style={{ color: '#2563EB' }} />
                  <span style={{ fontWeight: 700, fontSize: '14px', color: '#2563EB' }}>Live Poll</span>
                </div>
                <p style={{ fontWeight: 600, fontSize: '15px', color: '#0F172A', marginBottom: '16px' }}>{activePoll.question}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activePoll.options.map((opt: any) => {
                    const total = activePoll.options.reduce((s: number, o: any) => s + (o._count?.userVotes||0), 0);
                    const pct = total === 0 ? 0 : Math.round(((opt._count?.userVotes||0)/total)*100);
                    return (
                      <button key={opt.id} onClick={() => votePoll(opt.id)} disabled={activePoll.hasVoted} style={{
                        position: 'relative', width: '100%', padding: '12px 16px', textAlign: 'left',
                        background: activePoll.votedOptionId === opt.id ? '#2563EB' : '#F8FAFC',
                        color: activePoll.votedOptionId === opt.id ? '#fff' : '#0F172A',
                        border: `1px solid ${activePoll.votedOptionId === opt.id ? '#2563EB' : '#E2E8F0'}`,
                        borderRadius: '8px', cursor: activePoll.hasVoted ? 'default' : 'pointer',
                        fontWeight: 600, fontSize: '14px', display: 'flex', justifyContent: 'space-between',
                        overflow: 'hidden', transition: 'all 0.3s',
                      }}>
                        {activePoll.hasVoted && (
                          <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${pct}%`,
                            background: activePoll.votedOptionId === opt.id ? 'rgba(255,255,255,0.15)' : 'rgba(37,99,235,0.06)',
                            transition: 'width 0.8s ease', zIndex: 0 }} />
                        )}
                        <span style={{ position: 'relative', zIndex: 1 }}>{opt.text}</span>
                        {activePoll.hasVoted && <span style={{ position: 'relative', zIndex: 1, fontWeight: 700 }}>{pct}%</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Board View */}
            {viewMode === 'board' && (
              <BoardView
                feedItems={feedItems}
                user={user}
                sessionId={sessionId}
                expandedThreads={expandedThreads}
                setExpandedThreads={setExpandedThreads}
                replyingTo={replyingTo}
                setReplyingTo={setReplyingTo}
                toggleUpvote={toggleUpvote}
                deleteFeedItem={deleteFeedItem}
                justUpvoted={justUpvoted}
                connected={connected}
                clusters={clusters}
                clusterLoading={clusterLoading}
                cancelSubmission={cancelSubmission}
              />
            )}

            {/* List View */}
            {viewMode === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Pinned Questions First */}
              {feedItems.filter(item => item.isPinned).map((item, i) => (
                <div key={`pinned-${item.id}`} style={{
                  background: '#F0F9FF', border: '2px solid #0EA5E9', borderRadius: '12px',
                  padding: '20px', position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute', top: '-10px', right: '12px',
                    background: '#0EA5E9', color: '#fff', padding: '2px 10px',
                    borderRadius: '20px', fontSize: '10px', fontWeight: 800,
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}>
                    <HiOutlineSparkles size={10} /> PINNED
                  </div>
                  <p style={{ fontSize: '15px', fontWeight: 600, color: '#0369A1' }}>{item.text}</p>
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#0EA5E9', fontWeight: 600 }}>
                    {item.user.name}
                  </div>
                </div>
              ))}

              {/* Skeleton while loading */}
              {questionsLoading ? (
                <SkeletonCard count={4} />
              ) : feedItems.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: '#FFFFFF', borderRadius: '16px',
                    padding: '56px 48px', textAlign: 'center',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  {/* Illustration */}
                  <div style={{ position: 'relative', display: 'inline-block', marginBottom: '20px' }}>
                    <div style={{
                      width: '80px', height: '80px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto',
                      boxShadow: '0 4px 24px rgba(37,99,235,0.12)',
                    }}>
                      <span style={{ fontSize: '36px' }}>💬</span>
                    </div>
                    <motion.div
                      animate={{ scale: [1, 1.15, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                      style={{
                        position: 'absolute', top: '-4px', right: '-4px',
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: '#2563EB',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', color: '#fff', fontWeight: 800,
                      }}
                    >
                      ?
                    </motion.div>
                  </div>
                  <h3 style={{ fontWeight: 800, fontSize: '18px', color: '#0F172A', marginBottom: '8px', fontFamily: 'var(--font-heading)' }}>
                    The floor is open!
                  </h3>
                  <p style={{ fontSize: '14px', color: '#64748B', lineHeight: 1.6, maxWidth: '280px', margin: '0 auto 20px' }}>
                    No questions yet. Be the first to spark the conversation — ask anything!
                  </p>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '8px 16px', borderRadius: '20px',
                    background: '#EFF6FF', color: '#2563EB',
                    fontSize: '13px', fontWeight: 700,
                  }}>
                    <HiOutlineChatBubbleLeft size={14} /> Type below to ask a question
                  </div>
                </motion.div>
              ) : (() => {
                // Group by clusters if available, sort clusters by size (most asked first)
                const questionItems = feedItems.filter(item => item.type === 'question');
                const nonQuestionItems = feedItems.filter(item => item.type !== 'question');

                if (clusters.length > 0 && questionItems.length >= 3) {
                  const clusteredIds = new Set(clusters.flatMap(c => c.questionIds));
                  const sortedClusters = [...clusters].sort((a, b) => b.questionIds.length - a.questionIds.length);
                  const unclustered = questionItems.filter(q => !clusteredIds.has(q.id));

                  const renderQuestion = (item: any, i: number) => {
                    const isHighlighted = item.type === 'question' && item.status === 'HIGHLIGHTED';
                    const colorIdx = (item.user?.name || '').charCodeAt(0) % avatarColors.length;
                    const replyCount = item.type === 'question' ? (item.replies?.length || 0) : 0;
                    const isExpanded = expandedThreads.has(item.id);
                    const isJustUpvoted = justUpvoted.has(item.id);
                    return (
                  <div key={item.id}>
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * Math.min(i, 8), duration: 0.3 }}
                        style={{
                        background: item.status === 'ANSWERED' ? '#F8FAFC' : '#FFFFFF', borderRadius: '12px', padding: isMobile ? '16px 18px' : '20px 24px',
                        border: isHighlighted ? '2px dashed #2563EB' : `1px solid ${item.status === 'ANSWERED' ? '#E2E8F0' : '#E2E8F0'}`,
                        position: 'relative', 
                        overflow: isHighlighted ? 'visible' : 'hidden', 
                        opacity: item.status === 'ANSWERED' ? 0.7 : 1,
                        boxShadow: isHighlighted ? '0 10px 25px -5px rgba(37,99,235,0.12), 0 8px 10px -6px rgba(37,99,235,0.12)' : 'none',
                        marginBottom: isExpanded ? '0' : '8px',
                        borderBottomLeftRadius: isExpanded ? '0' : '12px',
                        borderBottomRightRadius: isExpanded ? '0' : '12px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        zIndex: isHighlighted ? 10 : 1,
                      }}
                    >
                      {item.isPending && (
                        <div style={{
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                          background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
                          zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563EB', fontWeight: 700 }}>
                            <span className="dot-pulse" style={{ display: 'inline-block', width: '6px', height: '6px', background: '#2563EB', borderRadius: '50%' }}></span>
                            Sending Question...
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); cancelSubmission(item.id); }}
                            style={{
                              background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '6px 16px',
                              borderRadius: '20px', color: '#64748B', fontWeight: 600, fontSize: '12px',
                              cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.borderColor = '#DC2626'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.borderColor = '#E2E8F0'; }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {item.status === 'ANALYZING' && (
                        <div style={{
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                          background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
                          zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            color: '#7C3AED', fontWeight: 700, fontSize: '14px',
                            background: '#fff', padding: '8px 16px', borderRadius: '20px',
                            boxShadow: '0 4px 15px rgba(124,58,237,0.15)',
                          }}>
                            <HiOutlineSparkles className="animate-pulse" size={18} />
                            AI Analyzing...
                          </div>
                        </div>
                      )}
                      
                      {item.status === 'ANSWERED' && (
                        <div style={{
                          position: 'absolute', top: 0, right: '24px',
                          background: '#64748B', color: '#fff', padding: '4px 12px',
                          borderRadius: '0 0 8px 8px', fontSize: '11px', fontWeight: 800,
                          display: 'flex', alignItems: 'center', gap: '4px',
                        }}>
                          ✅ Answered
                        </div>
                      )}
                      {/* Currently Answering Badge */}
                      {isHighlighted && (
                        <div style={{
                          position: 'absolute', top: '-14px', left: '20px',
                          background: '#16A34A', color: '#fff', padding: '4px 14px',
                          borderRadius: '100px', fontSize: '11px', fontWeight: 800,
                          display: 'flex', alignItems: 'center', gap: '6px',
                          boxShadow: '0 4px 12px rgba(22,163,74,0.3)',
                          zIndex: 20,
                          animation: 'badgePulse 2s infinite'
                        }}>
                          <span style={{ width: '8px', height: '8px', background: '#fff', borderRadius: '50%', animation: 'innerPulse 1.5s infinite' }} />
                          Currently Answering
                          <style>{`
                            @keyframes badgePulse {
                              0% { transform: scale(1); }
                              50% { transform: scale(1.05); }
                              100% { transform: scale(1); }
                            }
                            @keyframes innerPulse {
                              0% { opacity: 1; transform: scale(1); }
                              100% { opacity: 0; transform: scale(2.5); }
                            }
                          `}</style>
                        </div>
                      )}

                      {/* User Row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <div style={{
                          width: isMobile ? '32px' : '36px', height: isMobile ? '32px' : '36px', borderRadius: '50%',
                          background: item.type === 'voicenote' ? '#7C3AED' : avatarColors[colorIdx],
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: isMobile ? '12px' : '13px', fontWeight: 700, color: '#fff', flexShrink: 0,
                        }}>
                          {item.type === 'voicenote' ? <HiMicrophone size={isMobile ? 14 : 16} /> : getInitials(item.user?.name)}
                        </div>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>
                            {item.user?.name || 'Anonymous'}
                          </span>
                          {item.user?.isGuest && <span style={{ fontWeight: 400, color: '#94A3B8', fontSize: '12px' }}> (guest)</span>}
                          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 500 }}>{timeAgo(item.createdAt)}</div>
                        </div>
                        {user && item.user?.id === user.id && (
                          <button onClick={() => deleteFeedItem(item.id, item.type)} style={{
                            marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                            color: '#94A3B8', padding: '4px', display: 'flex', alignItems: 'center',
                            transition: 'color 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#DC2626'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#94A3B8'}
                          >
                            <HiOutlineTrash size={16} />
                          </button>
                        )}
                      </div>

                      {/* Content */}
                      {item.type === 'question' ? (
                        <p style={{ fontSize: '15px', color: '#1E293B', lineHeight: 1.65, marginBottom: '14px', fontWeight: 400 }}>
                          {item.text}
                        </p>
                      ) : (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px',
                          background: '#F8FAFC', padding: '10px 14px', borderRadius: '10px', border: '1px solid #E2E8F0',
                        }}>
                          <audio controls src={item.audioUrl} style={{ height: '32px', flex: 1 }} />
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', background: '#E2E8F0', padding: '3px 8px', borderRadius: '6px' }}>
                            {formatDuration(item.duration || 0)}
                          </span>
                        </div>
                      )}

                      {/* Bottom Row: Reply Toggle, Reply Button, Upvote */}
                      {item.type === 'question' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {/* View Replies Toggle (YouTube style) */}
                          {replyCount > 0 && (() => {
                            const similarCount = (item.replies || []).filter((r: any) => r.isSimilarMerge).length;
                            const manualReplies = replyCount - similarCount;
                            return (
                            <button
                              onClick={() => {
                                setExpandedThreads(prev => {
                                  const next = new Set(prev);
                                  if (next.has(item.id)) next.delete(item.id);
                                  else next.add(item.id);
                                  return next;
                                });
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '6px 14px', borderRadius: '20px',
                                background: isExpanded ? (similarCount > 0 ? '#FFF7ED' : '#EFF6FF') : 'transparent',
                                color: similarCount > 0 ? '#EA580C' : '#2563EB', border: 'none',
                                fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = similarCount > 0 ? '#FFF7ED' : '#EFF6FF'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = isExpanded ? (similarCount > 0 ? '#FFF7ED' : '#EFF6FF') : 'transparent'; }}
                            >
                              {similarCount > 0 ? <HiOutlineFire size={16} style={{ flexShrink: 0 }} /> : <HiOutlineChatBubbleOvalLeftEllipsis size={16} style={{ flexShrink: 0 }} />}
                              <span style={{ whiteSpace: 'nowrap' }}>
                                {similarCount > 0 && `${similarCount} similar`}
                                {similarCount > 0 && manualReplies > 0 && ' · '}
                                {manualReplies > 0 && `${manualReplies} ${manualReplies === 1 ? 'reply' : 'replies'}`}
                              </span>
                              <span style={{
                                display: 'inline-block', transition: 'transform 0.2s',
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                fontSize: '10px', lineHeight: 1, marginLeft: '2px'
                              }}>▼</span>
                            </button>
                          );
                          })()}

                          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                            <button 
                              onClick={() => {
                                setReplyingTo(item.id);
                                if (!isExpanded && replyCount > 0) {
                                  setExpandedThreads(prev => new Set(prev).add(item.id));
                                }
                                setTimeout(() => document.getElementById('qa-input')?.focus(), 100);
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '6px 14px', borderRadius: '8px',
                                background: replyingTo === item.id ? '#EFF6FF' : '#FFFFFF',
                                color: replyingTo === item.id ? '#2563EB' : '#64748B',
                                border: `1px solid ${replyingTo === item.id ? '#BFDBFE' : '#E2E8F0'}`,
                                fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                            >
                              <HiOutlineArrowUturnLeft size={16} />
                              Reply
                            </button>
                            <button onClick={() => toggleUpvote(item.id)} style={{
                              display: 'flex', alignItems: 'center', gap: '6px',
                              padding: '6px 14px', borderRadius: '8px',
                              background: item.hasUpvoted ? '#2563EB' : '#FFFFFF',
                              color: item.hasUpvoted ? '#FFFFFF' : '#64748B',
                              border: `1px solid ${item.hasUpvoted ? '#2563EB' : '#E2E8F0'}`,
                              fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                              transition: 'all 0.2s',
                              transform: isJustUpvoted ? 'scale(1.15)' : 'scale(1)',
                            }}>
                              {item.hasUpvoted ? <HiHandThumbUp size={16} /> : <HiOutlineHandThumbUp size={16} />}
                              {item.upvoteCount}
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>

                    {/* ── YouTube-Style Threaded Replies ── */}
                    <AnimatePresence>
                      {item.type === 'question' && isExpanded && item.replies && item.replies.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{
                            paddingLeft: '24px', marginLeft: '18px',
                            borderLeft: '2px solid #E2E8F0',
                            display: 'flex', flexDirection: 'column', gap: '0',
                            paddingBottom: '8px', marginBottom: '8px',
                            background: 'linear-gradient(90deg, rgba(241,245,249,0.5) 0%, transparent 60%)',
                            borderBottomLeftRadius: '12px',
                          }}>
                            {item.replies.map((reply: any, rIdx: number) => {
                              const replyColorIdx = (reply.user?.name || '').charCodeAt(0) % avatarColors.length;
                              const isReplyJustUpvoted = justUpvoted.has(reply.id);
                              return (
                                <motion.div
                                  key={reply.id}
                                  initial={{ opacity: 0, x: -12 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: rIdx * 0.06, duration: 0.25 }}
                                  style={{
                                    padding: '14px 16px',
                                    borderBottom: rIdx < item.replies!.length - 1 ? '1px solid rgba(226,232,240,0.6)' : 'none',
                                    position: 'relative',
                                  }}
                                >
                                  {/* Reply connector dot */}
                                  <div style={{
                                    position: 'absolute', left: '-29px', top: '22px',
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    background: '#CBD5E1', border: '2px solid #F1F5F9',
                                  }} />

                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                    <div style={{
                                      width: '28px', height: '28px', borderRadius: '50%',
                                      background: avatarColors[replyColorIdx],
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: '10px', fontWeight: 700, color: '#fff', flexShrink: 0,
                                      marginTop: '1px',
                                    }}>
                                      {getInitials(reply.user?.name)}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                                          {reply.user?.name}
                                        </span>
                                        {reply.user?.isGuest && (
                                          <span style={{ fontWeight: 400, color: '#94A3B8', fontSize: '11px' }}>(guest)</span>
                                        )}
                                        {reply.isSimilarMerge && (
                                          <span style={{ fontWeight: 700, color: '#EA580C', fontSize: '10px', background: '#FFF7ED', padding: '2px 8px', borderRadius: '10px', border: '1px solid #FDBA74' }}>
                                            Similar
                                          </span>
                                        )}
                                        <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 500 }}>
                                          {timeAgo(reply.createdAt)}
                                        </span>
                                      </div>
                                      <p style={{ fontSize: '14px', color: '#334155', margin: '0 0 8px 0', lineHeight: 1.55 }}>
                                        {reply.text}
                                      </p>
                                      {/* Reply actions */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <button
                                          onClick={() => toggleUpvote(reply.id)}
                                          style={{
                                            display: 'flex', alignItems: 'center', gap: '4px',
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: reply.hasUpvoted ? '#2563EB' : '#94A3B8',
                                            fontWeight: 700, fontSize: '12px',
                                            padding: '2px 4px', borderRadius: '4px',
                                            transition: 'all 0.2s',
                                            transform: isReplyJustUpvoted ? 'scale(1.2)' : 'scale(1)',
                                          }}
                                        >
                                          {reply.hasUpvoted ? <HiHandThumbUp size={14} /> : <HiOutlineHandThumbUp size={14} />}
                                          {reply.upvoteCount > 0 && <span>{reply.upvoteCount}</span>}
                                        </button>
                                        <button
                                          onClick={() => {
                                            setReplyingTo(item.id);
                                            setTimeout(() => document.getElementById('qa-input')?.focus(), 100);
                                          }}
                                          style={{
                                            display: 'flex', alignItems: 'center', gap: '4px',
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: '#94A3B8', fontWeight: 700, fontSize: '12px',
                                            padding: '2px 4px', borderRadius: '4px',
                                            transition: 'color 0.2s',
                                          }}
                                          onMouseEnter={(e) => e.currentTarget.style.color = '#2563EB'}
                                          onMouseLeave={(e) => e.currentTarget.style.color = '#94A3B8'}
                                        >
                                          <HiOutlineArrowUturnLeft size={13} />
                                          Reply
                                        </button>
                                        {user && reply.user?.id === user.id && (
                                          <button
                                            onClick={() => deleteFeedItem(reply.id, 'question')}
                                            style={{
                                              display: 'flex', alignItems: 'center', gap: '4px',
                                              background: 'none', border: 'none', cursor: 'pointer',
                                              color: '#94A3B8', fontWeight: 700, fontSize: '12px',
                                              padding: '2px 4px', borderRadius: '4px',
                                              transition: 'color 0.2s',
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.color = '#DC2626'}
                                            onMouseLeave={(e) => e.currentTarget.style.color = '#94A3B8'}
                                          >
                                            <HiOutlineTrash size={13} />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
                  };

                  return (
                    <>
                      {/* Processing / Analyzing questions at the top of the board */}
                      {questionItems.filter(q => q.status === 'ANALYZING').length > 0 && (
                        <div className="animate-pulse" style={{
                          border: '1px solid #7C3AED', borderRadius: '16px',
                          overflow: 'hidden', background: 'rgba(124,58,237,0.05)',
                          marginBottom: '20px', borderStyle: 'dashed',
                          boxShadow: '0 0 20px rgba(124,58,237,0.1)'
                        }}>
                          <div style={{
                            padding: '10px 20px', background: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)',
                            borderBottom: '1px solid rgba(124,58,237,0.2)',
                            display: 'flex', alignItems: 'center', gap: '10px',
                          }}>
                            <HiOutlineSparkles size={18} style={{ color: '#7C3AED' }} />
                            <span style={{ fontWeight: 800, fontSize: '13px', color: '#6D28D9', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Processing New Questions</span>
                            <span style={{
                              marginLeft: 'auto', fontSize: '11px', fontWeight: 700,
                              color: '#fff', background: '#7C3AED', padding: '2px 8px',
                              borderRadius: '10px',
                            }}>{questionItems.filter(q => q.status === 'ANALYZING').length}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                            {questionItems.filter(q => q.status === 'ANALYZING').map((item, i) => renderQuestion(item, i))}
                          </div>
                        </div>
                      )}

                      {sortedClusters.map(cluster => {
                        const clusterQuestions = cluster.questionIds
                          .map(id => questionItems.find(q => q.id === id))
                          .filter(Boolean);
                        if (clusterQuestions.length === 0) return null;
                        return (
                          <div key={`cluster-${cluster.label}`} style={{
                            border: '1px solid #E2E8F0', borderRadius: '16px',
                            overflow: 'hidden', background: '#FAFAFA',
                          }}>
                            <div style={{
                              padding: '12px 20px', background: 'linear-gradient(135deg, #EFF6FF, #F0F9FF)',
                              borderBottom: '1px solid #E2E8F0',
                              display: 'flex', alignItems: 'center', gap: '10px',
                            }}>
                              <span style={{ fontSize: '20px' }}>{cluster.emoji}</span>
                              <span style={{ fontWeight: 800, fontSize: '14px', color: '#1E40AF' }}>{cluster.label}</span>
                              <span style={{
                                marginLeft: 'auto', fontSize: '11px', fontWeight: 700,
                                color: '#2563EB', background: '#DBEAFE', padding: '3px 10px',
                                borderRadius: '12px',
                              }}>{clusterQuestions.length} question{clusterQuestions.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                              {clusterQuestions.map((item, i) => renderQuestion(item, i))}
                            </div>
                          </div>
                        );
                      })}
                      {/* Unclustered questions (excluding those already shown in Processing) */}
                      {unclustered.filter(q => q.status !== 'ANALYZING').map((item, i) => renderQuestion(item, i))}
                      {/* Non-question items (voice notes) */}
                      {nonQuestionItems.map((item, i) => renderQuestion(item, i))}
                    </>
                  );
                }

                // Fallback: no clusters, flat list
                return feedItems.map((item, i) => {
                  const isHighlighted = item.type === 'question' && item.status === 'HIGHLIGHTED';
                  const colorIdx = (item.user?.name || '').charCodeAt(0) % avatarColors.length;
                  const replyCount = item.type === 'question' ? (item.replies?.length || 0) : 0;
                  const isExpanded = expandedThreads.has(item.id);
                  const isJustUpvoted = justUpvoted.has(item.id);
                  return (
                  <div key={item.id}>
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * Math.min(i, 8), duration: 0.3 }}
                      style={{
                        background: item.status === 'ANSWERED' ? '#F8FAFC' : '#FFFFFF', borderRadius: '12px', padding: '20px 24px',
                        border: isHighlighted ? '2px dashed #2563EB' : `1px solid ${item.status === 'ANSWERED' ? '#E2E8F0' : '#E2E8F0'}`,
                        position: 'relative', 
                        overflow: isHighlighted ? 'visible' : 'hidden', 
                        opacity: item.status === 'ANSWERED' ? 0.7 : 1,
                        boxShadow: isHighlighted ? '0 10px 25px -5px rgba(37,99,235,0.12), 0 8px 10px -6px rgba(37,99,235,0.12)' : 'none',
                        marginBottom: isExpanded ? '0' : '8px',
                        borderBottomLeftRadius: isExpanded ? '0' : '12px',
                        borderBottomRightRadius: isExpanded ? '0' : '12px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        zIndex: isHighlighted ? 10 : 1,
                      }}
                    >
                      {item.isPending && (
                        <div style={{
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                          background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
                          zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563EB', fontWeight: 700 }}>
                            <span className="dot-pulse" style={{ display: 'inline-block', width: '6px', height: '6px', background: '#2563EB', borderRadius: '50%' }}></span>
                            Sending Question...
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); cancelSubmission(item.id); }}
                            style={{
                              background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '6px 16px',
                              borderRadius: '20px', color: '#64748B', fontWeight: 600, fontSize: '12px',
                              cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.borderColor = '#DC2626'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.borderColor = '#E2E8F0'; }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {item.status === 'ANALYZING' && (
                        <div style={{
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                          background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
                          zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            color: '#7C3AED', fontWeight: 700, fontSize: '14px',
                            background: '#fff', padding: '8px 16px', borderRadius: '20px',
                            boxShadow: '0 4px 15px rgba(124,58,237,0.15)',
                          }}>
                            <HiOutlineSparkles className="animate-pulse" size={18} />
                            AI Analyzing...
                          </div>
                        </div>
                      )}

                      {item.status === 'ANSWERED' && (
                        <div style={{
                          position: 'absolute', top: 0, right: '24px',
                          background: '#64748B', color: '#fff', padding: '4px 12px',
                          borderRadius: '0 0 8px 8px', fontSize: '11px', fontWeight: 800,
                          display: 'flex', alignItems: 'center', gap: '4px',
                        }}>
                          ✅ Answered
                        </div>
                      )}
                      {isHighlighted && (
                        <div style={{
                          position: 'absolute', top: '-14px', left: '20px',
                          background: '#16A34A', color: '#fff', padding: '4px 14px',
                          borderRadius: '100px', fontSize: '11px', fontWeight: 800,
                          display: 'flex', alignItems: 'center', gap: '6px',
                          boxShadow: '0 4px 12px rgba(22,163,74,0.3)',
                          zIndex: 20,
                          animation: 'badgePulse 2s infinite'
                        }}>
                          <span style={{ width: '8px', height: '8px', background: '#fff', borderRadius: '50%', animation: 'innerPulse 1.5s infinite' }} />
                          Currently Answering
                          <style>{`
                            @keyframes badgePulse {
                              0% { transform: scale(1); }
                              50% { transform: scale(1.05); }
                              100% { transform: scale(1); }
                            }
                            @keyframes innerPulse {
                              0% { opacity: 1; transform: scale(1); }
                              100% { opacity: 0; transform: scale(2.5); }
                            }
                          `}</style>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <div style={{
                          width: isMobile ? '32px' : '36px', height: isMobile ? '32px' : '36px', borderRadius: '50%',
                          background: item.type === 'voicenote' ? '#7C3AED' : avatarColors[colorIdx],
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: isMobile ? '12px' : '13px', fontWeight: 700, color: '#fff', flexShrink: 0,
                        }}>
                          {item.type === 'voicenote' ? <HiMicrophone size={isMobile ? 14 : 16} /> : getInitials(item.user?.name)}
                        </div>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>
                            {item.user?.name || 'Anonymous'}
                          </span>
                          {item.user?.isGuest && <span style={{ fontWeight: 400, color: '#94A3B8', fontSize: '12px' }}> (guest)</span>}
                          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 500 }}>{timeAgo(item.createdAt)}</div>
                        </div>
                        {user && item.user?.id === user.id && (
                          <button onClick={() => deleteFeedItem(item.id, item.type)} style={{
                            marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                            color: '#94A3B8', padding: '4px', display: 'flex', alignItems: 'center',
                            transition: 'color 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#DC2626'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#94A3B8'}
                          >
                            <HiOutlineTrash size={16} />
                          </button>
                        )}
                      </div>

                      {item.type === 'question' ? (
                        <p style={{ fontSize: '15px', color: '#1E293B', lineHeight: 1.65, marginBottom: '14px', fontWeight: 400 }}>
                          {item.text}
                        </p>
                      ) : (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px',
                          background: '#F8FAFC', padding: '10px 14px', borderRadius: '10px', border: '1px solid #E2E8F0',
                        }}>
                          <audio controls src={item.audioUrl} style={{ height: '32px', flex: 1 }} />
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', background: '#E2E8F0', padding: '3px 8px', borderRadius: '6px' }}>
                            {formatDuration(item.duration || 0)}
                          </span>
                        </div>
                      )}

                      {item.type === 'question' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {replyCount > 0 && (() => {
                            const similarCount = (item.replies || []).filter((r: any) => r.isSimilarMerge).length;
                            const manualReplies = replyCount - similarCount;
                            return (
                            <button
                              onClick={() => {
                                setExpandedThreads(prev => {
                                  const next = new Set(prev);
                                  if (next.has(item.id)) next.delete(item.id);
                                  else next.add(item.id);
                                  return next;
                                });
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '6px 14px', borderRadius: '20px',
                                background: isExpanded ? (similarCount > 0 ? '#FFF7ED' : '#EFF6FF') : 'transparent',
                                color: similarCount > 0 ? '#EA580C' : '#2563EB', border: 'none',
                                fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = similarCount > 0 ? '#FFF7ED' : '#EFF6FF'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = isExpanded ? (similarCount > 0 ? '#FFF7ED' : '#EFF6FF') : 'transparent'; }}
                            >
                              {similarCount > 0 ? <HiOutlineFire size={16} /> : <HiOutlineChatBubbleOvalLeftEllipsis size={16} />}
                              <span>
                                {similarCount > 0 && `${similarCount} similar`}
                                {similarCount > 0 && manualReplies > 0 && ' · '}
                                {manualReplies > 0 && `${manualReplies} ${manualReplies === 1 ? 'reply' : 'replies'}`}
                              </span>
                              <span style={{
                                display: 'inline-block', transition: 'transform 0.2s',
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                fontSize: '10px', lineHeight: 1,
                              }}>▼</span>
                            </button>
                          );
                          })()}

                          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => {
                                setReplyingTo(item.id);
                                if (!isExpanded && replyCount > 0) {
                                  setExpandedThreads(prev => new Set(prev).add(item.id));
                                }
                                setTimeout(() => document.getElementById('qa-input')?.focus(), 100);
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '6px 14px', borderRadius: '8px',
                                background: replyingTo === item.id ? '#EFF6FF' : '#FFFFFF',
                                color: replyingTo === item.id ? '#2563EB' : '#64748B',
                                border: `1px solid ${replyingTo === item.id ? '#BFDBFE' : '#E2E8F0'}`,
                                fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                            >
                              <HiOutlineArrowUturnLeft size={16} />
                              Reply
                            </button>
                            <button onClick={() => toggleUpvote(item.id)} style={{
                              display: 'flex', alignItems: 'center', gap: '6px',
                              padding: '6px 14px', borderRadius: '8px',
                              background: item.hasUpvoted ? '#2563EB' : '#FFFFFF',
                              color: item.hasUpvoted ? '#FFFFFF' : '#64748B',
                              border: `1px solid ${item.hasUpvoted ? '#2563EB' : '#E2E8F0'}`,
                              fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                              transition: 'all 0.2s',
                              transform: isJustUpvoted ? 'scale(1.15)' : 'scale(1)',
                            }}>
                              {item.hasUpvoted ? <HiHandThumbUp size={16} /> : <HiOutlineHandThumbUp size={16} />}
                              {item.upvoteCount}
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>

                    <AnimatePresence>
                      {item.type === 'question' && isExpanded && item.replies && item.replies.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{
                            paddingLeft: '24px', marginLeft: '18px',
                            borderLeft: '2px solid #E2E8F0',
                            display: 'flex', flexDirection: 'column', gap: '0',
                            paddingBottom: '8px', marginBottom: '8px',
                            background: 'linear-gradient(90deg, rgba(241,245,249,0.5) 0%, transparent 60%)',
                            borderBottomLeftRadius: '12px',
                          }}>
                            {item.replies.map((reply: any, rIdx: number) => {
                              const replyColorIdx = (reply.user?.name || '').charCodeAt(0) % avatarColors.length;
                              const isReplyJustUpvoted = justUpvoted.has(reply.id);
                              return (
                                <motion.div
                                  key={reply.id}
                                  initial={{ opacity: 0, x: -12 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: rIdx * 0.06, duration: 0.25 }}
                                  style={{
                                    padding: '14px 16px',
                                    borderBottom: rIdx < item.replies!.length - 1 ? '1px solid rgba(226,232,240,0.6)' : 'none',
                                    position: 'relative',
                                  }}
                                >
                                  <div style={{
                                    position: 'absolute', left: '-29px', top: '22px',
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    background: '#CBD5E1', border: '2px solid #F1F5F9',
                                  }} />
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                    <div style={{
                                      width: '28px', height: '28px', borderRadius: '50%',
                                      background: avatarColors[replyColorIdx],
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: '10px', fontWeight: 700, color: '#fff', flexShrink: 0,
                                      marginTop: '1px',
                                    }}>
                                      {getInitials(reply.user?.name)}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                                          {reply.user?.name}
                                        </span>
                                        {reply.user?.isGuest && (
                                          <span style={{ fontWeight: 400, color: '#94A3B8', fontSize: '11px' }}>(guest)</span>
                                        )}
                                        {reply.isSimilarMerge && (
                                          <span style={{ fontWeight: 700, color: '#EA580C', fontSize: '10px', background: '#FFF7ED', padding: '2px 8px', borderRadius: '10px', border: '1px solid #FDBA74' }}>
                                            Similar
                                          </span>
                                        )}
                                        <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 500 }}>
                                          {timeAgo(reply.createdAt)}
                                        </span>
                                      </div>
                                      <p style={{ fontSize: '14px', color: '#334155', margin: '0 0 8px 0', lineHeight: 1.55 }}>
                                        {reply.text}
                                      </p>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <button
                                          onClick={() => toggleUpvote(reply.id)}
                                          style={{
                                            display: 'flex', alignItems: 'center', gap: '4px',
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: reply.hasUpvoted ? '#2563EB' : '#94A3B8',
                                            fontWeight: 700, fontSize: '12px',
                                            padding: '2px 4px', borderRadius: '4px',
                                            transition: 'all 0.2s',
                                            transform: isReplyJustUpvoted ? 'scale(1.2)' : 'scale(1)',
                                          }}
                                        >
                                          {reply.hasUpvoted ? <HiHandThumbUp size={14} /> : <HiOutlineHandThumbUp size={14} />}
                                          {reply.upvoteCount > 0 && <span>{reply.upvoteCount}</span>}
                                        </button>
                                        <button
                                          onClick={() => {
                                            setReplyingTo(item.id);
                                            setTimeout(() => document.getElementById('qa-input')?.focus(), 100);
                                          }}
                                          style={{
                                            display: 'flex', alignItems: 'center', gap: '4px',
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: '#94A3B8', fontWeight: 700, fontSize: '12px',
                                            padding: '2px 4px', borderRadius: '4px',
                                            transition: 'color 0.2s',
                                          }}
                                          onMouseEnter={(e) => e.currentTarget.style.color = '#2563EB'}
                                          onMouseLeave={(e) => e.currentTarget.style.color = '#94A3B8'}
                                        >
                                          <HiOutlineArrowUturnLeft size={13} />
                                          Reply
                                        </button>
                                        {user && reply.user?.id === user.id && (
                                          <button
                                            onClick={() => deleteFeedItem(reply.id, 'question')}
                                            style={{
                                              display: 'flex', alignItems: 'center', gap: '4px',
                                              background: 'none', border: 'none', cursor: 'pointer',
                                              color: '#94A3B8', fontWeight: 700, fontSize: '12px',
                                              padding: '2px 4px', borderRadius: '4px',
                                              transition: 'color 0.2s',
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.color = '#DC2626'}
                                            onMouseLeave={(e) => e.currentTarget.style.color = '#94A3B8'}
                                          >
                                            <HiOutlineTrash size={13} />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  );
                });
              })()}
            </div>
            )}

                {/* Floating Reactions Overlay */}
                <div style={{ position: 'fixed', bottom: '100px', right: '30px', pointerEvents: 'none', zIndex: 100, height: '400px', width: '60px' }}>
                  <AnimatePresence>
                    {reactions.map((r) => (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, y: 0, x: 0 }}
                        animate={{ opacity: [0, 1, 1, 0], y: -300, x: [0, (Math.random() - 0.5) * 40, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 3, ease: "easeOut" }}
                        style={{ position: 'absolute', bottom: 0, fontSize: '28px' }}
                      >
                        {r.emoji}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Fixed Bottom Input */}
                <div className="safe-bottom" style={{
                  position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90,
                  background: '#FFFFFF', borderTop: '1px solid #E2E8F0',
                  padding: isMobile ? '8px 12px' : '16px 24px', boxShadow: '0 -4px 20px rgba(0,0,0,0.03)'
                }}>
                  <div style={{ maxWidth: '720px', margin: '0 auto' }}>
                    
                    {/* Reply Indicator */}
                    <AnimatePresence>
                      {replyingTo && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          style={{ 
                            background: '#F1F5F9', padding: '8px 12px', borderRadius: '8px 8px 0 0',
                            border: '1px solid #E2E8F0', borderBottom: 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            fontSize: '13px', color: '#64748B'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <HiOutlineArrowUturnLeft size={14} />
                            <span>Replying to <strong>{questions.find(q => q.id === replyingTo)?.user?.name}</strong></span>
                          </div>
                          <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>Cancel</button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Typing Indicator */}
                    <div style={{ height: '20px', marginBottom: '4px' }}>
                      <AnimatePresence>
                        {typingIndicator && (
                          <motion.div 
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            style={{ fontSize: '12px', color: '#16A34A', fontWeight: 600, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <span className="dot-pulse" style={{ display: 'inline-block', width: '4px', height: '4px', background: '#16A34A', borderRadius: '50%' }}></span>
                            {typingIndicator}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div style={{ 
                      display: 'flex', 
                      gap: isMobile ? '12px' : '6px', 
                      marginRight: isMobile ? '0' : '4px',
                      marginBottom: isMobile ? '6px' : '0',
                      justifyContent: isMobile ? 'center' : 'flex-start',
                      borderBottom: isMobile ? '1px solid rgba(226,232,240,0.3)' : 'none',
                      paddingBottom: isMobile ? '6px' : '0'
                    }}>
                      {['❤️', '👍', '👏', '💡'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => sendReaction(emoji)}
                          style={{
                            background: 'none', border: 'none', fontSize: isMobile ? '24px' : '20px', cursor: 'pointer',
                            padding: '4px', borderRadius: '8px', transition: 'all 0.1s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: isMobile ? '40px' : 'auto', height: isMobile ? '40px' : 'auto'
                          }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    <form onSubmit={submitQuestion} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <input
                          id="qa-input"
                          type="text"
                          value={newQuestion}
                          onChange={handleTyping}
                          placeholder={isRecording ? `Recording... ${formatDuration(recordingDuration)}` : (replyingTo ? 'Write a reply...' : 'Ask a question...')}
                          disabled={!connected || isRecording}
                          style={{
                            width: '100%', padding: '12px 16px', borderRadius: '12px',
                            border: '1px solid #E2E8F0', background: isMobile ? '#FFFFFF' : '#F8FAFC',
                            fontSize: '14px', outline: 'none', color: '#0F172A',
                            transition: 'border-color 0.2s',
                            paddingRight: '80px',
                            height: '46px',
                          }}
                          onFocus={(e) => e.currentTarget.style.borderColor = '#2563EB'}
                          onBlur={(e) => e.currentTarget.style.borderColor = '#E2E8F0'}
                        />
                        {!isRecording && (
                          <div style={{
                            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                            display: 'flex', alignItems: 'center', gap: '8px'
                          }}>
                            <span style={{
                              fontSize: '11px', fontWeight: 600,
                              color: newQuestion.length > MAX_QUESTION_LENGTH ? '#DC2626' : '#94A3B8',
                            }}>
                              {newQuestion.length}/{MAX_QUESTION_LENGTH}
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', opacity: 0.7, padding: '2px', display: 'flex' }}
                              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                            >
                              😀
                            </button>
                          </div>
                        )}
                        
                        {/* Emoji Picker Popup */}
                        <AnimatePresence>
                          {showEmojiPicker && (
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              style={{
                                position: 'absolute', bottom: 'calc(100% + 10px)', right: 0,
                                background: '#FFF', border: '1px solid #E2E8F0',
                                borderRadius: '12px', padding: '8px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', zIndex: 100
                              }}
                            >
                              {['😂','❤️','🔥','👍','🙏','🙌','🎉','💡','💯','🚀','👀','✨','🤔','👏','✅'].map(emoji => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => insertEmoji(emoji)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', padding: '6px', borderRadius: '6px' }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <button
                        type="button"
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={!connected}
                        style={{
                          width: '46px', height: '46px', borderRadius: '12px', border: 'none',
                          background: isRecording ? '#DC2626' : '#F1F5F9',
                          color: isRecording ? '#fff' : '#64748B',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.2s', flexShrink: 0,
                        }}
                      >
                        {isRecording ? <HiOutlineStop size={22} /> : <HiOutlineMicrophone size={22} />}
                      </button>
                      <button
                        type="submit"
                        disabled={submitting || !newQuestion.trim() || !connected || newQuestion.length > MAX_QUESTION_LENGTH}
                        style={{
                          width: '46px', height: '46px', borderRadius: '12px', border: 'none',
                          background: newQuestion.trim() && connected ? '#2563EB' : '#E2E8F0',
                          color: '#FFFFFF', cursor: newQuestion.trim() && connected ? 'pointer' : 'not-allowed',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.2s', flexShrink: 0,
                        }}
                      >
                        <HiOutlinePaperAirplane size={20} />
                      </button>
                    </form>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px' }}>
                      <span style={{ color: '#94A3B8' }}>Posting as <strong style={{ color: '#64748B' }}>{user?.name || 'Guest'}</strong></span>
                      {connected ? (
                        <span style={{ color: '#16A34A', display: 'flex', alignItems: 'center', gap: '4px' }}><HiOutlineSignal size={14} /> Live</span>
                      ) : (
                        <span style={{ color: '#DC2626', display: 'flex', alignItems: 'center', gap: '4px' }}><HiOutlineSignalSlash size={14} /> Reconnecting...</span>
                      )}
                    </div>
                  </div>
                </div>
          </>
        )}

        {/* ── Feedback Tab ── */}
        {activeTab === 'feedback' && (
          <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: isMobile ? '24px 16px' : '40px', border: '1px solid #E2E8F0' }}>
            {feedbackSubmitted ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '64px', height: '64px', margin: '0 auto 16px', borderRadius: '50%',
                  background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <HiOutlineCheckCircle size={32} style={{ color: '#16A34A' }} />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>Thank You!</h3>
                <p style={{ fontSize: '14px', color: '#64748B' }}>Your feedback helps us improve future sessions.</p>
              </div>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px', fontFamily: 'var(--font-heading)' }}>Rate This Session</h3>
                  <p style={{ fontSize: '14px', color: '#64748B' }}>How would you rate your experience?</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
                  {[1,2,3,4,5].map(star => (
                    <button key={star} onClick={() => setFeedbackRating(star)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                      color: star <= feedbackRating ? '#F59E0B' : '#CBD5E1',
                      transition: 'all 0.15s', transform: star <= feedbackRating ? 'scale(1.15)' : 'scale(1)',
                    }}>
                      <HiOutlineStar size={36} style={{ fill: star <= feedbackRating ? 'currentColor' : 'none' }} />
                    </button>
                  ))}
                </div>
                <div style={{ maxWidth: '480px', margin: '0 auto' }}>
                  <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Share additional thoughts (optional)..." rows={4}
                    style={{
                      width: '100%', background: '#F8FAFC', border: '1px solid #E2E8F0',
                      borderRadius: '10px', padding: '12px', fontSize: '14px', resize: 'vertical',
                      outline: 'none', fontFamily: 'var(--font-body)', marginBottom: '16px',
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#2563EB'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#E2E8F0'}
                  />
                  <button onClick={submitFeedback} disabled={!feedbackRating} style={{
                    width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                    background: feedbackRating ? '#2563EB' : '#E2E8F0', color: '#fff',
                    fontWeight: 700, fontSize: '14px', cursor: feedbackRating ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                  }}>Submit Feedback</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Info / Resources Tab ── */}
        {activeTab === 'info' && (
          <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: isMobile ? '20px 16px' : '28px', border: '1px solid #E2E8F0' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px', fontFamily: 'var(--font-heading)' }}>{session.title}</h3>
            {session.description && <p style={{ color: '#64748B', lineHeight: 1.7, marginBottom: '20px', fontSize: '14px' }}>{session.description}</p>}
            {session.objectives && (
              <div style={{ marginBottom: '20px', padding: '16px', background: '#F0F9FF', borderRadius: '10px', border: '1px solid #DBEAFE' }}>
                <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#2563EB', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Objectives</h4>
                <p style={{ color: '#1E293B', fontSize: '14px', lineHeight: 1.7 }}>{session.objectives}</p>
              </div>
            )}
            {session.speakers?.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#2563EB', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>Speakers</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {session.speakers.map(sp => (
                    <div key={sp.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                        {getInitials(sp.speaker.name)}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '14px' }}>{sp.speaker.name}</p>
                        <p style={{ fontSize: '12px', color: '#94A3B8' }}>{sp.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {contents.length > 0 && (
              <div>
                <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#2563EB', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>Session Materials</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {contents.map(c => (
                    <a key={c.id} href={c.url || '#'} target="_blank" rel="noopener noreferrer" style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '14px', background: '#F8FAFC', borderRadius: '10px',
                      border: '1px solid #E2E8F0', textDecoration: 'none', color: 'inherit',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.background = '#F0F9FF'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#F8FAFC'; }}
                    >
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <HiOutlineDocumentText size={20} style={{ color: '#2563EB' }} />
                      </div>
                      <div>
                        <h5 style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{c.title}</h5>
                        <p style={{ fontSize: '12px', color: '#94A3B8' }}>{c.body || c.type}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes pulse-live { 0%,100%{opacity:1}50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
