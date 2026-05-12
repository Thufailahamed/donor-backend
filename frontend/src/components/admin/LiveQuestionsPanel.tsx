'use client';
import { useState, useEffect } from 'react';
import { Session, Question } from '@/types';
import apiClient from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import { format } from 'date-fns';
import { getSocket, joinSession, leaveSession } from '@/lib/socket';
import { HiOutlineFlag, HiOutlineHandThumbUp, HiOutlineClock, HiOutlineMagnifyingGlass } from 'react-icons/hi2';

export default function LiveQuestionsPanel() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      fetchQuestions(selectedSessionId);
      
      const socket = getSocket();
      joinSession(selectedSessionId);

      socket.on('new-question', (q: Question) => {
        setQuestions(prev => [q, ...prev]);
      });

      socket.on('question-upvoted', (data: any) => {
        setQuestions(prev => prev.map(q => 
          q.id === data.questionId ? { ...q, upvoteCount: data.upvoteCount } : q
        ));
      });

      socket.on('question-admin-highlighted', (data: { questionId: string, isAdminHighlighted: boolean }) => {
        setQuestions(prev => prev.map(q => 
          q.id === data.questionId ? { ...q, isAdminHighlighted: data.isAdminHighlighted } : q
        ));
      });

      socket.on('question-status-changed', (data: any) => {
        setQuestions(prev => prev.map(q => 
          q.id === data.questionId ? { ...q, status: data.status } : q
        ));
      });

      socket.on('question-deleted', (data: any) => {
        setQuestions(prev => prev.filter(q => q.id !== data.questionId));
      });

      return () => {
        leaveSession(selectedSessionId);
        socket.off('new-question');
        socket.off('question-upvoted');
        socket.off('question-admin-highlighted');
        socket.off('question-status-changed');
        socket.off('question-deleted');
      };
    }
  }, [selectedSessionId]);

  const fetchSessions = async () => {
    try {
      const res = await apiClient.get('/sessions');
      const sessionsData = res.data.sessions || [];
      setSessions(sessionsData);
      
      // Handle initial session from query param
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session');
      
      if (sessionId && sessionsData.some((s: any) => s.id === sessionId)) {
        setSelectedSessionId(sessionId);
      } else if (sessionsData.length > 0) {
        setSelectedSessionId(sessionsData[0].id);
      }
    } catch {
      showToast('error', 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = async (sessionId: string) => {
    try {
      const res = await apiClient.get(`/questions/session/${sessionId}`);
      setQuestions(res.data.questions || []);
    } catch {
      showToast('error', 'Failed to load questions');
    }
  };

  const toggleAdminHighlight = async (q: Question) => {
    try {
      const newStatus = !q.isAdminHighlighted;
      await apiClient.put(`/questions/${q.id}/admin-highlight`, { isAdminHighlighted: newStatus });
      showToast('success', newStatus ? 'Priority pushed to moderator' : 'Priority removed');
    } catch {
      showToast('error', 'Failed to update priority');
    }
  };

  const filteredQuestions = questions.filter(q => 
    q.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.user?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
      <div className="animate-spin" style={{ width: '32px', height: '32px', border: '3px solid #E2E8F0', borderTopColor: '#2563EB', borderRadius: '50%' }} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Session Selector */}
      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none' }}>
        {sessions.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedSessionId(s.id)}
            style={{
              padding: '10px 20px', borderRadius: '12px', border: '1px solid #E2E8F0',
              background: selectedSessionId === s.id ? '#2563EB' : '#fff',
              color: selectedSessionId === s.id ? '#fff' : '#64748B',
              fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all 0.2s', boxShadow: selectedSessionId === s.id ? '0 4px 12px rgba(37, 99, 235, 0.2)' : 'none'
            }}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative' }}>
        <HiOutlineMagnifyingGlass style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
        <input 
          type="text" 
          placeholder="Search questions or users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%', padding: '14px 14px 14px 44px', borderRadius: '14px',
            border: '1px solid #E2E8F0', outline: 'none', fontSize: '14px',
            transition: 'border-color 0.2s'
          }}
        />
      </div>

      {/* Questions List */}
      <div style={{ display: 'grid', gap: '16px' }}>
        {filteredQuestions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94A3B8', background: '#F8FAFC', borderRadius: '20px', border: '2px dashed #E2E8F0' }}>
            No questions found for this session.
          </div>
        ) : (
          filteredQuestions.map(q => (
            <div key={q.id} style={{ 
              background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px',
              transition: 'all 0.2s', boxShadow: q.isAdminHighlighted ? '0 8px 24px rgba(239, 68, 68, 0.08)' : 'none',
              borderColor: q.isAdminHighlighted ? '#FCA5A5' : '#E2E8F0'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 800, fontSize: '14px', color: '#0F172A' }}>{q.user?.name}</span>
                  <span style={{ fontSize: '12px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <HiOutlineClock size={14} /> {format(new Date(q.createdAt), 'h:mm a')}
                  </span>
                  {q.status === 'HIGHLIGHTED' && (
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, background: '#E0F2FE', color: '#0EA5E9' }}>ON STAGE</span>
                  )}
                </div>
                <p style={{ fontSize: '16px', lineHeight: 1.6, color: '#334155', fontWeight: 500, marginBottom: '16px' }}>{q.text}</p>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#2563EB', background: '#EFF6FF', padding: '4px 10px', borderRadius: '8px' }}>
                    <HiOutlineHandThumbUp size={16} /> {q.upvoteCount}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748B', display: 'flex', alignItems: 'center' }}>
                    ID: {q.id.slice(0, 8)}
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => toggleAdminHighlight(q)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px',
                  borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                  background: q.isAdminHighlighted ? '#EF4444' : '#F8FAFC',
                  color: q.isAdminHighlighted ? '#fff' : '#EF4444',
                  boxShadow: q.isAdminHighlighted ? '0 10px 20px rgba(239, 68, 68, 0.25)' : 'none',
                  fontWeight: 800, fontSize: '13px',
                  border: q.isAdminHighlighted ? 'none' : '1px solid #FCA5A5'
                }}
              >
                <HiOutlineFlag size={20} />
                {q.isAdminHighlighted ? 'PRIORITY ACTIVE' : 'PUSH PRIORITY'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
