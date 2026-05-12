'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '@/lib/api-client';
import {
  HiOutlineHandThumbUp, HiHandThumbUp, HiOutlineArrowUturnLeft,
  HiOutlineTrash, HiOutlineChatBubbleOvalLeftEllipsis, HiOutlineFire,
  HiMicrophone, HiOutlineSparkles, HiMiniPlay, HiMiniPause,
  HiOutlineChevronDown, HiOutlineChevronUp
} from 'react-icons/hi2';

// ─── Types ───
interface BoardViewProps {
  feedItems: any[];
  user: any;
  sessionId: string;
  expandedThreads: Set<string>;
  setExpandedThreads: (fn: (prev: Set<string>) => Set<string>) => void;
  replyingTo: string | null;
  setReplyingTo: (id: string | null) => void;
  toggleUpvote: (id: string) => void;
  deleteFeedItem: (id: string, type: string) => void;
  justUpvoted: Set<string>;
  connected: boolean;
  clusters: { label: string; emoji: string; questionIds: string[] }[];
  clusterLoading: boolean;
  cancelSubmission?: (id: string) => void;
}

// ─── Helpers ───
const seededRandom = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h * 16807 + 0) % 2147483647;
    return (h & 0x7fffffff) / 0x7fffffff;
  };
};

const getInitials = (name?: string) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const timeAgo = (date: string) => {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  const hrs = Math.floor(diff / 60);
  return `${hrs}h ago`;
};

const avatarColors = ['#2563EB', '#0F172A', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2', '#4F46E5'];

const stickyColors: Record<string, { bg: string; border: string; shadow: string }> = {
  question: { bg: '#FFFEF5', border: '#FDE68A', shadow: 'rgba(253,230,138,0.35)' },
  voicenote: { bg: '#F0F4FF', border: '#BFDBFE', shadow: 'rgba(191,219,254,0.35)' },
  highlighted: { bg: '#F5F3FF', border: '#C4B5FD', shadow: 'rgba(196,181,253,0.35)' },
};

const MAX_VISIBLE_CARDS = 100;

// ─── Component ───
export default function BoardView({
  feedItems, user, sessionId, expandedThreads, setExpandedThreads,
  replyingTo, setReplyingTo, toggleUpvote, deleteFeedItem, justUpvoted, connected,
  clusters, clusterLoading, cancelSubmission
}: BoardViewProps) {

  // ─── Clustering State ───
  const [collapsedClusters, setCollapsedClusters] = useState<Set<string>>(new Set());
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // ─── Cluster assignment map ───
  const clusterMap = useMemo(() => {
    const map: Record<string, string> = {};
    clusters.forEach(c => c.questionIds.forEach(id => { map[id] = c.label; }));
    return map;
  }, [clusters]);

  // ─── Build clustered groups ───
  const clusteredItems = useMemo(() => {
    const visible = feedItems.slice(0, MAX_VISIBLE_CARDS);
    if (clusters.length === 0) return [{ label: '', emoji: '', items: visible }];

    const groups: Record<string, { label: string; emoji: string; items: any[] }> = {};
    clusters.forEach(c => { groups[c.label] = { label: c.label, emoji: c.emoji, items: [] }; });
    groups['General'] = { label: 'General', emoji: '💬', items: [] };

    visible.forEach(item => {
      const cluster = clusterMap[item.id];
      if (cluster && groups[cluster]) groups[cluster].items.push(item);
      else groups['General'].items.push(item);
    });

    return Object.values(groups).filter(g => g.items.length > 0);
  }, [feedItems, clusters, clusterMap]);

  // ─── Card position calculator ───
  const getCardPosition = useCallback((index: number, seed: string) => {
    const rng = seededRandom(seed);
    const cols = 3;
    const colWidth = 310;
    const rowHeight = 200;
    const col = index % cols;
    const row = Math.floor(index / cols);
    const baseX = col * colWidth;
    const baseY = row * rowHeight;
    const offsetX = (rng() - 0.5) * 30;
    const offsetY = (rng() - 0.5) * 16;
    const rotation = (rng() - 0.5) * 4;
    return { x: baseX + offsetX, y: baseY + offsetY, rotation };
  }, []);

  // ─── Scale based on votes ───
  const getVoteScale = (votes: number) => Math.min(1 + (votes / 60), 1.25);

  // ─── Top voted IDs for glow effect ───
  const topVotedIds = useMemo(() => {
    return [...feedItems]
      .filter(i => i.type === 'question')
      .sort((a, b) => (b.upvoteCount || 0) - (a.upvoteCount || 0))
      .slice(0, 5)
      .map(i => i.id);
  }, [feedItems]);

  const toggleCluster = (label: string) => {
    setCollapsedClusters(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // ─── Sticky Card renderer ───
  const renderCard = (item: any, index: number) => {
    const isHighlighted = item.type === 'question' && item.status === 'HIGHLIGHTED';
    const colorKey = isHighlighted ? 'highlighted' : item.type === 'voicenote' ? 'voicenote' : 'question';
    const colors = stickyColors[colorKey];
    const colorIdx = (item.user?.name || '').charCodeAt(0) % avatarColors.length;
    const pos = getCardPosition(index, item.id);
    const voteScale = item.type === 'question' ? getVoteScale(item.upvoteCount || 0) : 1;
    const isGlowing = topVotedIds.includes(item.id);
    const isTrending = (item.upvoteCount || 0) > 20;
    const replyCount = item.replies?.length || 0;
    const isExpanded = expandedThreads.has(item.id);
    const isJustUpvoted = justUpvoted.has(item.id);
    const isCardExpanded = expandedCard === item.id;
    const isAnswered = item.type === 'question' && item.status === 'ANSWERED';

    return (
      <motion.div
        key={item.id}
        layout
        layoutId={item.id}
        initial={{ opacity: 0, y: 24, scale: 0.92 }}
        animate={{
          opacity: 1, y: 0,
          scale: isJustUpvoted ? voteScale * 1.08 : voteScale,
          rotate: pos.rotation,
        }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28, delay: Math.min(index * 0.03, 0.3) }}
        whileHover={{ scale: voteScale * 1.04, rotate: 0, zIndex: 50 }}
        onClick={() => setExpandedCard(isCardExpanded ? null : item.id)}
        style={{
          width: isCardExpanded ? '360px' : '280px',
          padding: '16px 18px',
          borderRadius: '14px',
          background: isAnswered ? '#F8FAFC' : colors.bg,
          border: `1.5px solid ${isAnswered ? '#E2E8F0' : colors.border}`,
          boxShadow: isAnswered ? 'none' : isGlowing
            ? `0 8px 32px ${colors.shadow}, 0 0 20px rgba(59,130,246,0.25)`
            : `0 6px 20px ${colors.shadow}`,
          cursor: 'pointer',
          position: 'relative',
          transformOrigin: 'center center',
          zIndex: isCardExpanded ? 60 : isGlowing ? 10 : 1,
          transition: 'width 0.3s ease, box-shadow 0.3s ease',
          opacity: isAnswered ? 0.8 : 1,
        }}
      >
        {/* Answered Badge */}
        {isAnswered && (
          <div style={{
            position: 'absolute', top: '-10px', left: '12px',
            background: '#64748B', color: '#fff', padding: '2px 10px',
            borderRadius: '10px', fontSize: '10px', fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: '3px',
          }}>
            ✅ Answered
          </div>
        )}
        {/* Trending Badge */}
        {isTrending && (
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{
              position: 'absolute', top: '-10px', right: '-6px',
              background: 'linear-gradient(135deg, #F97316, #EF4444)',
              color: '#fff', padding: '3px 10px', borderRadius: '12px',
              fontSize: '11px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '3px',
              boxShadow: '0 2px 8px rgba(239,68,68,0.3)',
            }}
          >
            <HiOutlineFire size={12} /> Trending
          </motion.div>
        )}

        {/* Highlighted badge */}
        {isHighlighted && (
          <div style={{
            position: 'absolute', top: '-10px', left: '12px',
            background: '#16A34A', color: '#fff', padding: '2px 10px',
            borderRadius: '10px', fontSize: '10px', fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: '3px',
          }}>
            ⚡ Answering
          </div>
        )}

        {/* Undo Overlay for Pending Submissions */}
        {item.isPending && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            borderRadius: '12px', zIndex: 100,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563EB', fontWeight: 700, fontSize: '14px' }}>
              <span className="dot-pulse" style={{ display: 'inline-block', width: '6px', height: '6px', background: '#2563EB', borderRadius: '50%' }}></span>
              Sending...
            </div>
            {cancelSubmission && (
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
                Undo
              </button>
            )}
          </div>
        )}

        {/* User row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '50%',
            background: item.type === 'voicenote' ? '#7C3AED' : avatarColors[colorIdx],
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {item.type === 'voicenote' ? <HiMicrophone size={13} /> : getInitials(item.user?.name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '12px', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.user?.name || 'Anonymous'}
            </div>
            <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 500 }}>{timeAgo(item.createdAt)}</div>
          </div>
          {user && item.user?.id === user.id && (
            <button
              onClick={(e) => { e.stopPropagation(); deleteFeedItem(item.id, item.type); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#CBD5E1', padding: '2px', display: 'flex',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
              onMouseLeave={e => e.currentTarget.style.color = '#CBD5E1'}
            >
              <HiOutlineTrash size={14} />
            </button>
          )}
        </div>

        {/* Content */}
        {item.type === 'question' ? (
          <p style={{
            fontSize: '13px', color: '#1E293B', lineHeight: 1.55,
            marginBottom: '12px', fontWeight: 400,
            display: isCardExpanded ? 'block' : '-webkit-box',
            WebkitLineClamp: isCardExpanded ? undefined : 4,
            WebkitBoxOrient: 'vertical' as any,
            overflow: isCardExpanded ? 'visible' : 'hidden',
          }}>
            {item.text}
          </p>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px',
            background: 'rgba(255,255,255,0.6)', padding: '8px 10px', borderRadius: '8px',
          }}>
            {/* Waveform bars */}
            <div style={{ display: 'flex', alignItems: 'end', gap: '2px', height: '24px' }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ height: [4, 8 + Math.random() * 14, 4] }}
                  transition={{ repeat: Infinity, duration: 0.6 + Math.random() * 0.6, delay: i * 0.05 }}
                  style={{ width: '3px', borderRadius: '2px', background: '#7C3AED' }}
                />
              ))}
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#7C3AED' }}>
              Voice Note
            </span>
          </div>
        )}

        {/* Action row */}
        {item.type === 'question' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
            {/* Reply count & Thread Preview */}
            {replyCount > 0 && (
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
                  padding: '4px 10px', borderRadius: '14px',
                  background: isExpanded ? 'rgba(37,99,235,0.08)' : 'transparent',
                  color: '#2563EB', border: 'none',
                  fontWeight: 600, fontSize: '11px', cursor: 'pointer',
                  maxWidth: '180px', overflow: 'hidden'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: '4px' }}>
                  <HiOutlineChatBubbleOvalLeftEllipsis size={13} />
                  <strong>{replyCount}</strong>
                </div>
                {!isExpanded && item.replies && item.replies.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', borderLeft: '1px solid rgba(37,99,235,0.2)', paddingLeft: '6px' }}>
                    <div style={{
                      width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0,
                      background: avatarColors[(item.replies[item.replies.length - 1].user?.name || '').charCodeAt(0) % avatarColors.length],
                      color: '#fff', fontSize: '7px', fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {getInitials(item.replies[item.replies.length - 1].user?.name)}
                    </div>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#64748B', fontWeight: 500 }}>
                      {item.replies[item.replies.length - 1].text}
                    </span>
                  </div>
                )}
                <span style={{
                  display: 'inline-block', transition: 'transform 0.2s', flexShrink: 0,
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: '8px',
                  marginLeft: 'auto'
                }}>▼</span>
              </button>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
              {/* Reply */}
              <button
                onClick={() => {
                  setReplyingTo(item.id);
                  if (!isExpanded && replyCount > 0) {
                    setExpandedThreads(prev => new Set(prev).add(item.id));
                  }
                  setTimeout(() => document.getElementById('qa-input')?.focus(), 100);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '4px 10px', borderRadius: '6px',
                  background: replyingTo === item.id ? 'rgba(37,99,235,0.08)' : 'transparent',
                  color: replyingTo === item.id ? '#2563EB' : '#94A3B8',
                  border: 'none', fontWeight: 700, fontSize: '11px', cursor: 'pointer',
                }}
              >
                <HiOutlineArrowUturnLeft size={12} /> Reply
              </button>

              {/* Avatar "Me Too!" Stacks / Upvote */}
              <motion.button
                animate={isJustUpvoted ? { scale: [1, 1.15, 1] } : {}}
                transition={{ duration: 0.3 }}
                onClick={() => toggleUpvote(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '4px 10px', borderRadius: '6px',
                  background: item.hasUpvoted ? '#2563EB' : 'rgba(0,0,0,0.03)',
                  color: item.hasUpvoted ? '#fff' : '#64748B',
                  border: 'none', fontWeight: 700, fontSize: '11px', cursor: 'pointer',
                  transition: 'background 0.2s, color 0.2s',
                }}
              >
                {item.hasUpvoted ? <HiHandThumbUp size={13} /> : <HiOutlineHandThumbUp size={13} />}
                
                {item.recentUpvoters && item.recentUpvoters.length > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', marginLeft: '2px' }}>
                    {item.recentUpvoters.map((name: string, i: number) => {
                      const initial = getInitials(name);
                      const color = avatarColors[name.charCodeAt(0) % avatarColors.length];
                      return (
                        <div key={i} style={{
                          width: '16px', height: '16px', borderRadius: '50%',
                          background: color, color: '#fff',
                          fontSize: '7px', fontWeight: 800,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          marginLeft: i > 0 ? '-6px' : '0',
                          border: `1.5px solid ${item.hasUpvoted ? '#2563EB' : '#F8FAFC'}`,
                          zIndex: 3 - i
                        }}>
                          {initial}
                        </div>
                      );
                    })}
                    <span style={{ marginLeft: '4px' }}>{item.upvoteCount}</span>
                  </div>
                ) : (
                  <span>{item.upvoteCount || 0}</span>
                )}
              </motion.button>
            </div>
          </div>
        )}

        {/* Expanded replies */}
        <AnimatePresence>
          {isExpanded && item.replies && item.replies.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{ overflow: 'hidden', marginTop: '10px', borderTop: `1px solid ${colors.border}`, paddingTop: '10px' }}
              onClick={e => e.stopPropagation()}
            >
              {item.replies.map((reply: any, rIdx: number) => {
                const replyColorIdx = (reply.user?.name || '').charCodeAt(0) % avatarColors.length;
                return (
                  <div key={reply.id} style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%',
                      background: avatarColors[replyColorIdx],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '9px', fontWeight: 700, color: '#fff', flexShrink: 0, marginTop: '2px',
                    }}>
                      {getInitials(reply.user?.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 700, fontSize: '11px', color: '#0F172A' }}>{reply.user?.name}</span>
                        <span style={{ fontSize: '10px', color: '#94A3B8' }}>{timeAgo(reply.createdAt)}</span>
                      </div>
                      <p style={{ fontSize: '12px', color: '#334155', lineHeight: 1.5, margin: 0 }}>{reply.text}</p>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button
                          onClick={() => toggleUpvote(reply.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '3px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: reply.hasUpvoted ? '#2563EB' : '#94A3B8',
                            fontWeight: 700, fontSize: '10px',
                          }}
                        >
                          {reply.hasUpvoted ? <HiHandThumbUp size={11} /> : <HiOutlineHandThumbUp size={11} />}
                          {reply.upvoteCount > 0 && reply.upvoteCount}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '600px' }}>
      {/* Dot-grid background */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0, borderRadius: '16px',
        backgroundImage: 'radial-gradient(#d1d5db 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        opacity: 0.5,
      }} />

      {/* AI Clustering loading indicator */}
      {clusterLoading && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 16px', marginBottom: '16px',
          background: 'linear-gradient(135deg, #F5F3FF, #EFF6FF)',
          borderRadius: '10px', border: '1px solid #E0E7FF',
          fontSize: '13px', fontWeight: 600, color: '#6D28D9',
          position: 'relative', zIndex: 1,
        }}>
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
            <HiOutlineSparkles size={16} />
          </motion.div>
          AI is organizing questions into topics...
        </div>
      )}

      {/* Render clusters */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {clusteredItems.map((group, gIdx) => (
          <div key={group.label || 'all'} style={{ marginBottom: '32px' }}>
            {/* Cluster Frame Header */}
            {group.label && (
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 18px', marginBottom: '16px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.7)',
                  backdropFilter: 'blur(8px)',
                  border: '1.5px dashed #CBD5E1',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>{group.emoji}</span>
                  <span style={{ fontWeight: 800, fontSize: '15px', color: '#0F172A', fontFamily: 'var(--font-heading)' }}>
                    {group.label}
                  </span>
                  <span style={{
                    background: '#E2E8F0', color: '#475569', padding: '2px 8px',
                    borderRadius: '10px', fontSize: '11px', fontWeight: 700,
                  }}>
                    {group.items.length}
                  </span>
                </div>
                <button
                  onClick={() => toggleCluster(group.label)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: '#64748B',
                    display: 'flex', alignItems: 'center', padding: '4px',
                  }}
                >
                  {collapsedClusters.has(group.label)
                    ? <HiOutlineChevronDown size={18} />
                    : <HiOutlineChevronUp size={18} />
                  }
                </button>
              </div>
            )}

            {/* Cards Grid */}
            <AnimatePresence>
              {!collapsedClusters.has(group.label) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{
                    display: 'flex', flexWrap: 'wrap', gap: '20px',
                    padding: group.label ? '8px 10px 24px' : '0',
                    justifyContent: 'flex-start',
                  }}
                >
                  {group.items.map((item, idx) => renderCard(item, gIdx * 100 + idx))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Overflow indicator */}
      {feedItems.length > MAX_VISIBLE_CARDS && (
        <div style={{
          textAlign: 'center', padding: '16px', fontSize: '13px',
          color: '#64748B', fontWeight: 600,
          background: 'rgba(255,255,255,0.8)', borderRadius: '10px',
          border: '1px dashed #CBD5E1', position: 'relative', zIndex: 1,
        }}>
          Showing {MAX_VISIBLE_CARDS} of {feedItems.length} items. Switch to List view to see all.
        </div>
      )}
    </div>
  );
}
