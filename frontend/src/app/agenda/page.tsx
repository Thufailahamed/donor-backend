'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '@/lib/api-client';
import { Session } from '@/types';
import { format, isAfter, isBefore, differenceInSeconds } from 'date-fns';
import {
  HiOutlineArrowLeft, HiOutlineClock, HiOutlineMapPin,
  HiOutlineUserGroup, HiOutlineCalendarDays,
  HiOutlineArrowRightOnRectangle, HiOutlineSparkles,
  HiOutlineBars3,
} from 'react-icons/hi2';
import { useIsMobile } from '@/hooks/useIsMobile';
import MobileNav from '@/components/MobileNav';

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */
const fadeUp: any = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: "easeOut" },
  }),
};

const cardVariants: any = {
  hidden: { opacity: 0, x: -16 },
  visible: (i: number = 0) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.055, duration: 0.4, ease: "easeOut" },
  }),
};

/* ------------------------------------------------------------------ */
/*  Helper: determine session time status                              */
/* ------------------------------------------------------------------ */
type TimeStatus = 'active' | 'upcoming' | 'past';

function getSessionStatus(session: Session): TimeStatus {
  const now = new Date();
  const start = new Date(session.startTime);
  const end = new Date(session.endTime);
  if (isBefore(now, start)) return 'upcoming';
  if (isAfter(now, end)) return 'past';
  return 'active';
}

/* ------------------------------------------------------------------ */
/*  Countdown display                                                  */
/* ------------------------------------------------------------------ */
function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'Starting now';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

/* ================================================================== */
/*  Page Component                                                     */
/* ================================================================== */
export default function AgendaPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(1);
  const [now, setNow] = useState(new Date());
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  /* ---- tick every second for countdown ---- */
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /* ---- track scroll for sticky nav ---- */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ---- fetch sessions ---- */
  const fetchSessions = useCallback(async () => {
    try {
      const res = await apiClient.get('/sessions');
      const data = res.data.sessions;
      setSessions(data);
      sessionStorage.setItem('summit_sessions', JSON.stringify(data));
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Instant load from cache
    const cached = sessionStorage.getItem('summit_sessions');
    if (cached) {
      try {
        setSessions(JSON.parse(cached));
        setLoading(false);
      } catch (e) {}
    }
    fetchSessions();
  }, [fetchSessions]);

  /* ---- derived data ---- */
  const days = [...new Set(sessions.map((s) => s.day))].sort();
  const filteredSessions = sessions
    .filter((s) => s.day === activeDay)
    .sort((a, b) => a.order - b.order || new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  /* ---- "Next Up" session ---- */
  const nextUp = filteredSessions.find((s) => {
    const status = getSessionStatus(s);
    return status === 'upcoming' || status === 'active';
  });
  const nextUpStatus = nextUp ? getSessionStatus(nextUp) : null;
  const nextUpCountdown =
    nextUp && nextUpStatus === 'upcoming'
      ? differenceInSeconds(new Date(nextUp.startTime), now)
      : null;

  /* ---- format helpers ---- */
  const fmtTime = (d: string) => {
    try {
      return format(new Date(d), 'h:mm a');
    } catch {
      return '';
    }
  };

  const fmtDate = (d: string) => {
    try {
      return format(new Date(d), 'EEE, MMM d');
    } catch {
      return '';
    }
  };

  const handleSessionClick = (e: React.MouseEvent, session: Session) => {
    e.preventDefault();
    if (!session.isActive && user?.role !== 'ADMIN' && user?.role !== 'MODERATOR') {
      alert('This session is currently locked. Please wait for the admin to open it.');
      return;
    }
    if (!user) {
      router.push('/join');
    } else {
      router.push(`/session/${session.id}`);
    }
  };

  /* ---- Loading state ---- */
  if (loading && sessions.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', padding: '100px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div className="skeleton" style={{ width: '120px', height: '20px', borderRadius: '4px', marginBottom: '16px' }} />
          <div className="skeleton" style={{ width: '300px', height: '45px', borderRadius: '8px', marginBottom: '32px' }} />
          <div style={{ display: 'flex', gap: '12px', marginBottom: '48px' }}>
            <div className="skeleton" style={{ width: '100px', height: '40px', borderRadius: '20px' }} />
            <div className="skeleton" style={{ width: '100px', height: '40px', borderRadius: '20px' }} />
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
              <div className="skeleton" style={{ width: '12px', height: '12px', borderRadius: '50%', marginTop: '20px' }} />
              <div className="skeleton" style={{ flex: 1, height: '120px', borderRadius: '16px' }} />
            </div>
          ))}
        </div>
        <style>{`
          .skeleton {
            background: linear-gradient(90deg, #f1f5f9 25%, #f8fafc 50%, #f1f5f9 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
          }
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </div>
    );
  }

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, rgba(248,250,255,0.6) 0%, rgba(255,255,255,0.4) 100%)',
      }}
    >
      {/* ---- Sticky Navigation ---- */}
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: scrolled ? '10px 16px' : '16px',
          ...(isMobile ? {} : { padding: scrolled ? '10px 32px' : '16px 32px' }),
          background: scrolled ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: scrolled ? '1px solid rgba(15,23,42,0.1)' : '1px solid transparent',
          transition: 'all 0.3s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none',
              color: '#475569',
              transition: 'color 0.2s',
            }}
          >
            <HiOutlineArrowLeft size={20} />
          </Link>
          {!isMobile && (
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 800,
                color: '#fff',
              }}
            >
              DS
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontSize: isMobile ? '14px' : '15px',
                fontWeight: 800,
                fontFamily: 'var(--font-heading)',
                color: '#0F172A',
                lineHeight: 1.2,
              }}
            >
              Summit Agenda
            </span>
            {!isMobile && (
              <span
                style={{
                  fontSize: '10px',
                  color: '#94A3B8',
                  fontWeight: 600,
                  letterSpacing: '0.03em',
                }}
              >
                Donor Summit on MSME Transformation
              </span>
            )}
          </div>
        </div>

        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {user?.role === 'ADMIN' && (
              <Link href="/admin" style={{ fontSize: '13px', fontWeight: 600, color: '#2563EB', textDecoration: 'none' }}>Admin</Link>
            )}
            {['MODERATOR', 'ADMIN'].includes(user?.role || '') && (
              <Link href="/moderator" style={{ fontSize: '13px', fontWeight: 600, color: '#2563EB', textDecoration: 'none' }}>Moderator</Link>
            )}

            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 12px 5px 5px', borderRadius: '9999px', background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.1)' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff' }}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{user.name}</span>
                </div>
                <button onClick={logout} title="Sign out" style={{ background: 'none', border: '1px solid rgba(15,23,42,0.1)', borderRadius: '10px', padding: '6px', color: '#94A3B8', cursor: 'pointer', transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
                  <HiOutlineArrowRightOnRectangle size={16} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <Link href="/login" style={{ fontSize: '13px', fontWeight: 600, color: '#475569', textDecoration: 'none', padding: '8px 16px' }}>Staff Login</Link>
                <Link href="/join" style={{ fontSize: '13px', fontWeight: 700, color: '#fff', background: '#2563EB', padding: '10px 24px', borderRadius: '9999px', textDecoration: 'none', transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)' }}>Join Summit</Link>
              </div>
            )}
          </div>
        )}

        {isMobile && (
          <button onClick={() => setMobileMenuOpen(true)} style={{ background: 'none', border: '1px solid rgba(15,23,42,0.1)', borderRadius: '10px', padding: '8px', color: '#475569', cursor: 'pointer' }}>
            <HiOutlineBars3 size={20} />
          </button>
        )}
      </nav>

      <MobileNav
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        user={user}
        onLogout={logout}
        items={[
          ...(user?.role === 'ADMIN' ? [{ label: 'Admin', href: '/admin' }] : []),
          ...(['MODERATOR', 'ADMIN'].includes(user?.role || '') ? [{ label: 'Moderator', href: '/moderator' }] : []),
          ...(!user ? [{ label: 'Staff Login', href: '/login' }] : []),
          ...(!user ? [{ label: 'Join Summit', href: '/join', highlight: true }] : []),
        ]}
      />

      {/* ---- Main content area ---- */}
      <main
        style={{
          flex: 1,
          maxWidth: '900px',
          width: '100%',
          margin: '0 auto',
          padding: isMobile ? '80px 16px 60px' : '100px 24px 80px',
        }}
      >
        {/* ---- Page header ---- */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
          style={{ marginBottom: '32px' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
            }}
          >
            <HiOutlineCalendarDays size={18} style={{ color: '#2563EB' }} />
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#2563EB',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              Programme
            </span>
          </div>
          <h1
            style={{
              fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
              fontWeight: 900,
              fontFamily: 'var(--font-heading)',
              color: '#0F172A',
              lineHeight: 1.15,
              marginBottom: '8px',
              letterSpacing: '-0.02em',
            }}
          >
            Summit Agenda
          </h1>
          <p
            style={{
              fontSize: '15px',
              color: '#475569',
              lineHeight: 1.6,
              maxWidth: '560px',
            }}
          >
            Full programme for the Donor Summit on MSME Transformation. Browse sessions, view speakers, and join live Q&A.
          </p>
        </motion.div>

        {/* ---- Day tabs ---- */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '24px',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '4px',
              background: '#F8FAFC',
              padding: '4px',
              borderRadius: '9999px',
              border: '1px solid rgba(15,23,42,0.1)',
            }}
          >
            {days.map((day) => (
              <button
                key={day}
                onClick={() => setActiveDay(day)}
                style={{
                  padding: '10px 28px',
                  borderRadius: '9999px',
                  border: 'none',
                  background: activeDay === day ? '#FFFFFF' : 'transparent',
                  color: activeDay === day ? '#2563EB' : '#475569',
                  fontWeight: activeDay === day ? 700 : 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: activeDay === day ? '0 1px 3px rgba(15,23,42,0.05)' : 'none',
                }}
              >
                Day {day}
              </button>
            ))}
          </div>

          {/* Date display for active day */}
          {filteredSessions.length > 0 && (
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#94A3B8',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <HiOutlineCalendarDays size={14} />
              {fmtDate(filteredSessions[0].startTime)}
            </span>
          )}
        </motion.div>

        {/* ---- "Next Up" banner ---- */}
        <AnimatePresence>
          {nextUp && (
            <motion.div
              key={`nextup-${nextUp.id}`}
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              onClick={(e) => handleSessionClick(e, nextUp)}
              style={{
                marginBottom: '32px',
                padding: '20px 24px',
                borderRadius: '14px',
                background:
                  nextUp.isActive
                    ? 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)'
                    : 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
                border:
                  nextUp.isActive
                    ? '2px solid #34D399'
                    : '2px solid #93C5FD',
                cursor: (nextUp.isActive || ['ADMIN', 'MODERATOR'].includes(user?.role || '')) ? 'pointer' : 'not-allowed',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'flex-start' : 'center',
                gap: '16px',
                opacity: (nextUp.isActive || ['ADMIN', 'MODERATOR'].includes(user?.role || '')) ? 1 : 0.8,
                transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {/* Pulsing dot */}
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: nextUp.isActive ? '#10B981' : '#2563EB',
                  flexShrink: 0,
                  animation: nextUp.isActive ? 'pulseDot 1.5s ease-in-out infinite' : 'none',
                }}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: nextUp.isActive ? '#059669' : '#2563EB',
                    }}
                  >
                    {nextUp.isActive ? 'Live Now' : 'Next Up'}
                  </span>
                  {nextUpStatus === 'upcoming' && nextUpCountdown !== null && (
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#2563EB',
                        fontFamily: 'var(--font-heading)',
                      }}
                    >
                      Starts in {formatCountdown(nextUpCountdown)}
                    </span>
                  )}
                  {nextUpStatus === 'active' && (
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#059669',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <HiOutlineClock size={12} />
                      {fmtTime(nextUp.startTime)} &ndash; {fmtTime(nextUp.endTime)}
                    </span>
                  )}
                </div>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-heading)',
                    color: '#0F172A',
                    lineHeight: 1.3,
                  }}
                >
                  {nextUp.title}
                </h3>
                {nextUp.speakers.length > 0 && (
                  <p
                    style={{
                      fontSize: '13px',
                      color: '#475569',
                      marginTop: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <HiOutlineUserGroup size={13} style={{ color: '#94A3B8' }} />
                    {nextUp.speakers.map((sp) => sp.speaker.name).join(', ')}
                  </p>
                )}
              </div>

              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: nextUp.isActive ? '#059669' : '#2563EB',
                  flexShrink: 0,
                }}
              >
                {nextUp.isActive ? 'Join Now' : 'View Details'} &rarr;
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---- Vertical Timeline ---- */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeDay}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            style={{ position: 'relative' }}
          >
            {filteredSessions.length === 0 ? (
              <div
                style={{
                  background: '#fff',
                  borderRadius: '14px',
                  padding: '64px',
                  textAlign: 'center',
                  border: '1px solid rgba(15,23,42,0.1)',
                  color: '#475569',
                }}
              >
                <HiOutlineCalendarDays
                  size={40}
                  style={{ margin: '0 auto 16px', color: '#94A3B8' }}
                />
                <p style={{ fontWeight: 600 }}>No sessions scheduled for this day.</p>
              </div>
            ) : (
              <div style={{ position: 'relative', paddingLeft: isMobile ? '20px' : '36px' }}>
                {/* Vertical line */}
                <div
                  style={{
                    position: 'absolute',
                    left: isMobile ? '6px' : '11px',
                    top: '8px',
                    bottom: '8px',
                    width: '2px',
                    background: 'linear-gradient(180deg, #E2E8F0 0%, rgba(226,232,240,0.4) 100%)',
                    borderRadius: '1px',
                  }}
                />

                {/* Session cards */}
                {filteredSessions.map((session, idx) => {
                  const status = getSessionStatus(session);
                  const isActive = status === 'active';
                  const isPast = status === 'past';
                  const isUpcoming = status === 'upcoming';

                  const dotColor = isActive
                    ? '#10B981'
                    : isPast
                      ? '#CBD5E1'
                      : '#2563EB';
                  const dotSize = isActive ? 14 : 10;

                  return (
                    <motion.div
                      key={session.id}
                      variants={cardVariants}
                      initial="hidden"
                      animate="visible"
                      custom={idx}
                      style={{
                        position: 'relative',
                        marginBottom: idx === filteredSessions.length - 1 ? 0 : '16px',
                      }}
                    >
                      {/* Timeline dot */}
                      <div
                        style={{
                          position: 'absolute',
                          left: isMobile ? '-20px' : '-36px',
                          top: '22px',
                          width: `${dotSize}px`,
                          height: `${dotSize}px`,
                          borderRadius: '50%',
                          background: dotColor,
                          border: isActive ? '3px solid #D1FAE5' : isUpcoming ? '3px solid #DBEAFE' : '3px solid #F1F5F9',
                          zIndex: 2,
                          animation: isActive ? 'pulseDot 1.5s ease-in-out infinite' : 'none',
                        }}
                      />

                      {/* Connector line from dot to card */}
                      <div
                        style={{
                          position: 'absolute',
                          left: `-${(isMobile ? 20 : 36) - dotSize / 2 - 1}px`,
                          top: `${22 + dotSize / 2}px`,
                          width: `${(isMobile ? 20 : 36) - dotSize / 2 - 1 - 10}px`,
                          height: '2px',
                          background: isActive ? '#10B981' : '#E2E8F0',
                        }}
                      />

                      {/* Card */}
                      <motion.a
                        href={`/session/${session.id}`}
                        onClick={(e) => handleSessionClick(e, session)}
                        whileHover={(session.isActive || ['ADMIN', 'MODERATOR'].includes(user?.role || '')) ? {
                          y: -2,
                          boxShadow: '0 6px 24px rgba(15, 23, 42, 0.08)',
                        } : {}}
                        style={{
                          display: 'block',
                          background: '#fff',
                          borderRadius: '14px',
                          border: session.isActive
                            ? '2px solid #34D399'
                            : '1px solid rgba(15,23,42,0.1)',
                          boxShadow: session.isActive
                            ? '0 0 0 4px rgba(52,211,153,0.1), 0 4px 12px rgba(15,23,42,0.06)'
                            : '0 1px 3px rgba(15,23,42,0.05)',
                          padding: '20px 24px',
                          textDecoration: 'none',
                          color: 'inherit',
                          cursor: (session.isActive || ['ADMIN', 'MODERATOR'].includes(user?.role || '')) ? 'pointer' : 'not-allowed',
                          opacity: isPast ? 0.55 : (session.isActive || ['ADMIN', 'MODERATOR'].includes(user?.role || '')) ? 1 : 0.7,
                          filter: (session.isActive || ['ADMIN', 'MODERATOR'].includes(user?.role || '')) ? 'none' : 'grayscale(0.2)',
                          transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                      >
                        {/* Top row: time + badges */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '8px',
                            flexWrap: 'wrap',
                          }}
                        >
                          {/* Time */}
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '13px',
                              fontWeight: 700,
                              color: isActive ? '#059669' : '#0F172A',
                            }}
                          >
                            <HiOutlineClock
                              size={14}
                              style={{ color: isActive ? '#059669' : '#2563EB' }}
                            />
                            {fmtTime(session.startTime)} &ndash;{' '}
                            {fmtTime(session.endTime)}
                          </span>

                          {/* Live badge */}
                          {isActive && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 10px',
                                borderRadius: '9999px',
                                background: '#ECFDF5',
                                fontSize: '11px',
                                fontWeight: 800,
                                color: '#059669',
                                letterSpacing: '0.04em',
                              }}
                            >
                              <span
                                style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  background: '#10B981',
                                  animation: 'pulseDot 1.2s ease-in-out infinite',
                                }}
                              />
                              LIVE
                            </span>
                          )}

                          {/* Track badge */}
                          {session.track && (
                            <span
                              style={{
                                padding: '2px 10px',
                                borderRadius: '9999px',
                                background: 'rgba(37,99,235,0.1)',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#2563EB',
                              }}
                            >
                              {session.track}
                            </span>
                          )}

                          {/* Location */}
                          {session.location && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '12px',
                                fontWeight: 500,
                                color: '#94A3B8',
                                marginLeft: isMobile ? '0' : 'auto',
                              }}
                            >
                              <HiOutlineMapPin size={13} />
                              {session.location}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h3
                          style={{
                            fontSize: '16px',
                            fontWeight: 700,
                            fontFamily: 'var(--font-heading)',
                            color: '#0F172A',
                            lineHeight: 1.35,
                            marginBottom: '4px',
                          }}
                        >
                          {session.title}
                        </h3>

                        {/* Description */}
                        {session.description && (
                          <p
                            style={{
                              fontSize: '13px',
                              color: '#475569',
                              lineHeight: 1.6,
                              marginBottom: '8px',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {session.description}
                          </p>
                        )}

                        {/* Speakers row */}
                        {session.speakers.length > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            {/* Avatar initials */}
                            <div style={{ display: 'flex' }}>
                              {session.speakers.slice(0, 4).map((sp, i) => (
                                <div
                                  key={sp.id}
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: '#2563EB',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    color: '#fff',
                                    marginLeft: i > 0 ? '-5px' : '0',
                                    border: '2px solid #fff',
                                    position: 'relative',
                                    zIndex: 4 - i,
                                  }}
                                >
                                  {sp.speaker.name.charAt(0).toUpperCase()}
                                </div>
                              ))}
                            </div>
                            <span
                              style={{
                                fontSize: '13px',
                                color: '#475569',
                                fontWeight: 500,
                              }}
                            >
                              {session.speakers
                                .map((sp) => sp.speaker.name)
                                .join(', ')}
                            </span>

                            {/* Join link */}
                            <span
                              style={{
                                marginLeft: 'auto',
                                fontSize: '13px',
                                fontWeight: 700,
                                color: '#2563EB',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                opacity: isPast ? 0.5 : 1,
                              }}
                            >
                              {session.isActive ? 'Join Now' : 'View'}
                              &rarr;
                            </span>
                          </div>
                        )}
                      </motion.a>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ---- Footer ---- */}
      <footer
        style={{
          padding: '40px 24px',
          borderTop: '1px solid rgba(15,23,42,0.1)',
          background: 'rgba(255,255,255,0.8)',
        }}
      >
        <div
          style={{
            maxWidth: '900px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 800,
                color: '#fff',
              }}
            >
              DS
            </div>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: '#0F172A',
                fontFamily: 'var(--font-heading)',
              }}
            >
              Donor Summit on MSME Transformation
            </span>
          </div>
          <span style={{ fontSize: '12px', color: '#94A3B8' }}>
            Interactive Digital Engagement System &copy; 2026
          </span>
        </div>
      </footer>

      {/* ---- Global keyframes ---- */}
      <style>{`
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.25); }
        }
      `}</style>
    </div>
  );
}
