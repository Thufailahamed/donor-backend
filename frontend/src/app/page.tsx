'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiOutlineCalendarDays, HiOutlineClock, HiOutlineMapPin,
  HiOutlineChatBubbleLeftRight, HiOutlineArrowRightOnRectangle,
  HiArrowRight, HiOutlineChevronDown, HiOutlineLightBulb,
  HiOutlineUserGroup, HiOutlineBuildingOffice2, HiOutlineSparkles,
  HiOutlineBars3
} from 'react-icons/hi2';
import apiClient from '@/lib/api-client';
import { Session } from '@/types';
import { format } from 'date-fns';
import CountUp from '@/components/CountUp';
import { useIsMobile } from '@/hooks/useIsMobile';
import MobileNav from '@/components/MobileNav';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as any }
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.07 } }
};

export default function HomePage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(1);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    // Try to load from cache first for instant render
    const cached = sessionStorage.getItem('summit_sessions');
    if (cached) {
      try {
        setSessions(JSON.parse(cached));
        setLoading(false);
      } catch (e) {
        console.error('Failed to parse cached sessions');
      }
    }
    
    fetchSessions();
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await apiClient.get('/sessions');
      const data = res.data.sessions;
      setSessions(data);
      sessionStorage.setItem('summit_sessions', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const days = [...new Set(sessions.map(s => s.day))].sort();
  const filteredSessions = sessions.filter(s => s.day === activeDay);

  const formatTime = (dateStr: string) => {
    try { return format(new Date(dateStr), 'h:mm a'); } catch { return ''; }
  };

  const handleSessionClick = (e: React.MouseEvent, session: Session) => {
    e.preventDefault();
    if (!session.isActive && user?.role !== 'ADMIN') {
      alert('This session is currently locked. Please wait for the admin to open it.');
      return;
    }
    if (!user) {
      router.push('/join');
    } else {
      router.push(`/session/${session.id}`);
    }
  };

  const scrollToAgenda = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const el = document.getElementById('agenda');
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const totalSpeakers = new Set(sessions.flatMap(s => s.speakers.map(sp => sp.speaker.id))).size;
  const uniqueTracks = [...new Set(sessions.map(s => s.track).filter(Boolean))];

  if (loading && sessions.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff' }}>
        <div style={{ height: '70px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', padding: '0 32px' }}>
          <div className="skeleton" style={{ width: '120px', height: '30px', borderRadius: '6px' }} />
        </div>
        <div style={{ maxWidth: '860px', margin: '120px auto 0', padding: '0 24px', textAlign: 'center' }}>
          <div className="skeleton" style={{ width: '200px', height: '40px', borderRadius: '30px', margin: '0 auto 32px' }} />
          <div className="skeleton" style={{ width: '100%', height: '80px', borderRadius: '12px', marginBottom: '24px' }} />
          <div className="skeleton" style={{ width: '80%', height: '24px', borderRadius: '6px', margin: '0 auto 48px' }} />
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
            <div className="skeleton" style={{ width: '180px', height: '50px', borderRadius: '30px' }} />
            <div className="skeleton" style={{ width: '180px', height: '50px', borderRadius: '30px' }} />
          </div>
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'transparent' }}>

      {/* Navigation */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${scrolled ? '10px' : '16px'} ${isMobile ? 'var(--space-4)' : 'var(--space-8)'}`,
        background: scrolled ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: scrolled ? '1px solid var(--color-border)' : '1px solid transparent',
        transition: 'all 0.3s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <img
            src="/ministry-logo.jpg"
            alt="Ministry Logo"
            style={{ height: '34px', width: 'auto' }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)', lineHeight: 1.1 }}>
              Ministry of Industry and
            </span>
            <span style={{ fontSize: '9px', color: 'var(--color-text-tertiary)', fontWeight: 600, letterSpacing: '0.02em', lineHeight: 1 }}>
              Entrepreneurship Development
            </span>
          </div>
        </div>

        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>
            <a onClick={scrollToAgenda} style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer', textDecoration: 'none' }}>Agenda</a>
            {user?.role === 'ADMIN' && (
              <Link href="/admin" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}>Admin</Link>
            )}
            {['MODERATOR', 'ADMIN'].includes(user?.role || '') && (
              <Link href="/moderator" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}>Moderator</Link>
            )}
            {['SPEAKER', 'MODERATOR', 'ADMIN'].includes(user?.role || '') && (
              <Link href="/speaker" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}>Speaker</Link>
            )}

            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                  padding: '5px 12px 5px 5px', borderRadius: 'var(--radius-full)',
                  background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
                }}>
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: 'var(--color-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700, color: '#fff',
                  }}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>{user.name}</span>
                </div>
                <button onClick={logout} title="Sign out" style={{
                  background: 'none', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)', padding: '6px',
                  color: 'var(--color-text-tertiary)', cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}>
                  <HiOutlineArrowRightOnRectangle size={16} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                <Link href="/login" style={{
                  fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)',
                  textDecoration: 'none', padding: '8px 16px',
                }}>Staff Login</Link>
                <Link href="/join" style={{
                  fontSize: 'var(--text-sm)', fontWeight: 700, color: '#fff',
                  background: 'var(--color-primary)',
                  padding: '10px 24px', borderRadius: 'var(--radius-full)', textDecoration: 'none',
                  transition: 'all var(--transition-fast)',
                }}>Join Summit</Link>
              </div>
            )}
          </div>
        )}

        {isMobile && (
          <button onClick={() => setMobileMenuOpen(true)} style={{
            background: 'none', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)', padding: '8px',
            color: 'var(--color-text-secondary)', cursor: 'pointer',
          }}>
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
          { label: 'Agenda', onClick: () => scrollToAgenda() },
          ...(user?.role === 'ADMIN' ? [{ label: 'Admin', href: '/admin' }] : []),
          ...(['MODERATOR', 'ADMIN'].includes(user?.role || '') ? [{ label: 'Moderator', href: '/moderator' }] : []),
          ...(['SPEAKER', 'MODERATOR', 'ADMIN'].includes(user?.role || '') ? [{ label: 'Speaker', href: '/speaker' }] : []),
          ...(!user ? [{ label: 'Staff Login', href: '/login' }] : []),
          ...(!user ? [{ label: 'Join Summit', href: '/join', highlight: true }] : []),
        ]}
      />

      {/* Hero */}
      <header style={{
        position: 'relative',
        paddingTop: isMobile ? '120px' : '160px', paddingBottom: isMobile ? '80px' : '80px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', paddingInline: 'var(--space-4)',
        background: 'linear-gradient(180deg, rgba(248,250,255,0.65) 0%, rgba(255,255,255,0.5) 100%)',
        overflow: 'hidden',
      }}>
        {/* Subtle decorative */}
        <div style={{
          position: 'absolute', top: '-20%', right: '-10%',
          width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.04) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', left: '-5%',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.03) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '860px' }}>
          {/* Live Session Alert */}
          {(() => {
            const liveSession = sessions.find(s => s.isActive);
            if (!liveSession) return null;
            return (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '24px',
                  padding: isMobile ? '16px' : '20px 32px',
                  marginBottom: '40px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '20px',
                  textAlign: 'left',
                  maxWidth: '600px',
                  boxShadow: '0 10px 40px rgba(239, 68, 68, 0.1)'
                }}
              >
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute', inset: -4, borderRadius: '50%',
                    border: '2px solid #EF4444', opacity: 0.4,
                  }} className="ping-animate" />
                  <HiOutlineSparkles size={24} color="#fff" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Session is Live Now</span>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444' }} />
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>{liveSession.title}</h3>
                </div>
                <Link 
                  href={`/session/${liveSession.id}`}
                  style={{
                    padding: '12px 24px', background: '#0F172A', color: '#fff',
                    borderRadius: '14px', fontSize: '14px', fontWeight: 700,
                    textDecoration: 'none', transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)'
                  }}
                >
                  Join Now
                </Link>
                <style>{`
                  @keyframes ping {
                    0% { transform: scale(1); opacity: 0.8; }
                    70%, 100% { transform: scale(1.6); opacity: 0; }
                  }
                  .ping-animate { animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; }
                `}</style>
              </motion.div>
            );
          })()}

          {/* Badge */}
          <motion.div
            variants={fadeUp} initial="hidden" animate="visible" custom={0}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
              padding: '8px 20px', marginBottom: 'var(--space-8)',
              background: 'var(--color-primary-glow)', border: '1px solid rgba(37,99,235,0.2)',
              borderRadius: 'var(--radius-full)', fontSize: 'var(--text-sm)', fontWeight: 600,
              color: 'var(--color-primary)',
            }}
          >
            <HiOutlineSparkles size={14} />
            National SME Policy Framework Implementation Dialogue
          </motion.div>

          {/* Title */}
          <motion.h1
            variants={fadeUp} initial="hidden" animate="visible" custom={1}
            style={{
              fontSize: 'clamp(2.25rem, 5.5vw, 4rem)',
              fontWeight: 900, lineHeight: 1.08, marginBottom: 'var(--space-6)',
              fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            Donor Summit on{' '}
            <span style={{ color: 'var(--color-primary)' }}>MSME Transformation</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={fadeUp} initial="hidden" animate="visible" custom={2}
            style={{
              fontSize: 'clamp(1rem, 1.8vw, 1.2rem)', color: 'var(--color-text-secondary)',
              maxWidth: '620px', margin: '0 auto var(--space-10)', lineHeight: 1.75,
            }}
          >
            Transitioning from Policy Launch to Delivery — framing the shift from a
            well-crafted framework to measurable, on-the-ground impact for SMEs across Sri Lanka.
          </motion.p>

          {/* CTA + Details */}
          <motion.div
            variants={fadeUp} initial="hidden" animate="visible" custom={3}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 'var(--space-5)', flexWrap: 'wrap', marginBottom: 'var(--space-12)',
            }}
          >
            <Link href={user ? '/agenda' : '/join'} style={{
              display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
              fontSize: 'var(--text-base)', fontWeight: 700, color: '#fff',
              background: 'var(--color-primary)',
              padding: '14px 32px', borderRadius: 'var(--radius-full)', textDecoration: 'none',
              boxShadow: '0 2px 16px rgba(37, 99, 235, 0.25)',
              transition: 'all var(--transition-fast)',
            }}>
              {user ? 'View Agenda' : 'Join the Summit'} <HiArrowRight size={18} />
            </Link>

            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                padding: '10px 18px', borderRadius: 'var(--radius-lg)',
                background: '#FFFFFF', border: '1px solid var(--color-border)',
                fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)',
              }}>
                <HiOutlineCalendarDays size={16} style={{ color: 'var(--color-primary)' }} />
                May 13-14, 2026
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                padding: '10px 18px', borderRadius: 'var(--radius-lg)',
                background: '#FFFFFF', border: '1px solid var(--color-border)',
                fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)',
              }}>
                <HiOutlineMapPin size={16} style={{ color: 'var(--color-primary)' }} />
                The Grand Maitland, Colombo
              </div>
            </div>
          </motion.div>

          {/* Stats row */}
          <motion.div
            variants={fadeUp} initial="hidden" animate="visible" custom={4}
            style={{
              display: 'flex', justifyContent: 'center', gap: isMobile ? '24px' : '48px', flexWrap: 'wrap',
            }}
          >
            {[
              { value: sessions.length, label: 'Sessions' },
              { value: totalSpeakers, label: 'Speakers' },
              { value: days.length, label: 'Day' + (days.length > 1 ? 's' : '') },
              ...(uniqueTracks.length > 0 ? [{ value: uniqueTracks.length, label: 'Tracks' }] : []),
            ].map((stat, idx) => (
              <div key={stat.label} style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', fontWeight: 900,
                  fontFamily: 'var(--font-heading)', color: 'var(--color-primary)',
                  lineHeight: 1,
                }}>
                  <CountUp to={stat.value} delay={idx * 120} />
                </div>
                <div style={{
                  fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-tertiary)',
                  marginTop: '4px',
                }}>{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          onClick={scrollToAgenda}
          style={{
            position: 'absolute', bottom: isMobile ? '12px' : '24px', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
            zIndex: 10,
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Agenda
          </span>
          <motion.div animate={{ y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}>
            <HiOutlineChevronDown size={18} style={{ color: 'var(--color-text-muted)' }} />
          </motion.div>
        </motion.div>
      </header>

      {/* About Section */}
      <section style={{
        padding: isMobile ? '48px var(--space-4)' : '80px var(--space-6)',
        background: 'rgba(248,250,252,0.7)',
        borderTop: '1px solid var(--color-border)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <motion.div
            variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
            style={{
              display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 'var(--space-8)',
            }}
          >
            <motion.div variants={fadeUp}>
              <span style={{
                display: 'inline-block', fontSize: 'var(--text-xs)', fontWeight: 700,
                color: 'var(--color-primary)', letterSpacing: '0.1em', textTransform: 'uppercase',
                marginBottom: 'var(--space-3)',
              }}>About the Summit</span>
              <h2 style={{
                fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', fontWeight: 800,
                fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)',
                lineHeight: 1.25, marginBottom: 'var(--space-4)',
              }}>
                From Policy Framework to Delivery
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.8, marginBottom: 'var(--space-4)' }}>
                Sri Lanka's National SME Policy Framework set the vision. This summit brings together
                donors, policymakers, and private sector leaders to turn that vision into action —
                focusing on financing access, regulatory reform, digital adoption, and market linkages
                for micro, small, and medium enterprises.
              </p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
                Through interactive sessions, participants will co-develop implementation roadmaps,
                identify funding gaps, and build partnerships that translate policy into measurable outcomes
                for Sri Lanka's 1.2 million MSMEs.
              </p>
            </motion.div>

            <motion.div variants={fadeUp} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <span style={{
                display: 'inline-block', fontSize: 'var(--text-xs)', fontWeight: 700,
                color: 'var(--color-primary)', letterSpacing: '0.1em', textTransform: 'uppercase',
                marginBottom: 'var(--space-2)',
              }}>Key Themes</span>
              {[
                { icon: HiOutlineLightBulb, title: 'Policy-to-Practice Transition', desc: 'Mapping the National SME Policy Framework to actionable delivery milestones.' },
                { icon: HiOutlineBuildingOffice2, title: 'MSME Financing & Investment', desc: 'Identifying funding gaps and structuring donor support for maximum SME impact.' },
                { icon: HiOutlineUserGroup, title: 'Inclusive Growth & Employment', desc: 'Ensuring transformation reaches women-led, rural, and underserved enterprises.' },
              ].map((theme) => (
                <div key={theme.title} style={{
                  display: 'flex', gap: 'var(--space-4)',
                  padding: 'var(--space-4)',
                  background: '#FFFFFF', borderRadius: '12px',
                  border: '1px solid var(--color-border)',
                }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                    background: 'var(--color-primary-glow)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <theme.icon size={20} style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)', marginBottom: '2px' }}>
                      {theme.title}
                    </h3>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                      {theme.desc}
                    </p>
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Agenda Section */}
      <section id="agenda" style={{
        maxWidth: '1100px', margin: '0 auto',
        padding: isMobile ? '48px var(--space-4)' : '80px var(--space-6)', width: '100%', flex: 1,
      }}>
        <motion.div
          variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 'var(--space-8)', flexWrap: 'wrap', gap: 'var(--space-4)',
          }}
        >
          <div>
            <span style={{
              display: 'inline-block', fontSize: 'var(--text-xs)', fontWeight: 700,
              color: 'var(--color-primary)', letterSpacing: '0.1em', textTransform: 'uppercase',
              marginBottom: 'var(--space-2)',
            }}>Programme</span>
            <h2 style={{
              fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', fontWeight: 800,
              fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)',
            }}>Summit Agenda</h2>
          </div>

          <div style={{
            display: 'flex', gap: 'var(--space-2)',
            background: 'var(--color-bg-secondary)', padding: '4px', borderRadius: 'var(--radius-full)',
          }}>
            {days.map(day => (
              <button
                key={day}
                onClick={() => setActiveDay(day)}
                style={{
                  padding: '8px 24px', borderRadius: 'var(--radius-full)', border: 'none',
                  background: activeDay === day ? '#FFFFFF' : 'transparent',
                  color: activeDay === day ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  fontWeight: activeDay === day ? 700 : 600, fontSize: 'var(--text-sm)',
                  cursor: 'pointer', transition: 'all var(--transition-fast)',
                  boxShadow: activeDay === day ? 'var(--shadow-sm)' : 'none',
                }}
              >
                Day {day}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Sessions */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeDay}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
          >
            {filteredSessions.length === 0 ? (
              <div style={{
                background: '#FFFFFF', borderRadius: '12px', padding: 'var(--space-16)',
                textAlign: 'center', border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}>
                <HiOutlineCalendarDays size={40} style={{ margin: '0 auto var(--space-4)', color: 'var(--color-text-muted)' }} />
                <p>No sessions scheduled for this day yet.</p>
              </div>
            ) : (
              filteredSessions.map((session) => (
                <motion.a
                  key={session.id}
                  href={`/session/${session.id}`}
                  onClick={(e) => handleSessionClick(e, session)}
                  whileHover={session.isActive ? { y: -2, boxShadow: '0 6px 24px rgba(15, 23, 42, 0.08)' } : {}}
                  style={{
                    display: 'flex', background: '#FFFFFF',
                    borderRadius: '12px', border: '1px solid var(--color-border)',
                    boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
                    textDecoration: 'none', color: 'inherit', 
                    cursor: session.isActive ? 'pointer' : 'not-allowed',
                    opacity: session.isActive ? 1 : 0.7,
                    filter: session.isActive ? 'none' : 'grayscale(0.4)',
                  }}
                >
                  {/* Left bar */}
                  <div style={{
                    width: '4px', flexShrink: 0,
                    background: session.isActive
                      ? '#DC2626'
                      : session.track ? 'var(--color-primary)' : 'var(--color-border)',
                  }} />

                  <div style={{
                    padding: 'var(--space-5)', flex: 1,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    flexWrap: 'wrap', gap: 'var(--space-4)',
                  }}>
                    <div style={{ flex: 1, minWidth: '280px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                        {session.isActive && (
                          <span className="live-indicator">
                            Live
                          </span>
                        )}
                        {session.track && (
                          <span style={{
                            padding: '3px 10px', borderRadius: 'var(--radius-full)',
                            background: 'var(--color-primary-glow)',
                            fontSize: 'var(--text-xs)', fontWeight: 700,
                            color: 'var(--color-primary)',
                          }}>
                            {session.track}
                          </span>
                        )}
                      </div>

                      <h3 style={{
                        fontSize: '17px', fontWeight: 700, marginBottom: 'var(--space-1)',
                        fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)', lineHeight: 1.35,
                      }}>
                        {session.title}
                      </h3>

                      {session.description && (
                        <p style={{
                          fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)',
                          lineHeight: 1.65, marginBottom: 'var(--space-3)',
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {session.description}
                        </p>
                      )}

                      {session.speakers.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <div style={{ display: 'flex' }}>
                            {session.speakers.slice(0, 3).map((sp, idx) => (
                              <div key={sp.id} style={{
                                width: '24px', height: '24px', borderRadius: '50%',
                                background: 'var(--color-primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '10px', fontWeight: 700, color: '#fff',
                                marginLeft: idx > 0 ? '-5px' : '0',
                                border: '2px solid #fff', position: 'relative', zIndex: 3 - idx,
                              }}>
                                {sp.speaker.name.charAt(0).toUpperCase()}
                              </div>
                            ))}
                          </div>
                          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                            {session.speakers.map(sp => sp.speaker.name).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Meta */}
                    <div style={{
                      display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
                      minWidth: isMobile ? 'auto' : '160px', background: 'var(--color-bg-secondary)',
                      padding: 'var(--space-3) var(--space-4)', borderRadius: '8px',
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                        fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)',
                      }}>
                        <HiOutlineClock size={14} style={{ color: 'var(--color-primary)' }} />
                        {formatTime(session.startTime)} – {formatTime(session.endTime)}
                      </div>
                      {session.location && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                          fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)',
                        }}>
                          <HiOutlineMapPin size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                          {session.location}
                        </div>
                      )}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                        fontSize: 'var(--text-sm)',
                      }}>
                        <HiOutlineChatBubbleLeftRight size={14} style={{ color: session.isActive ? 'var(--color-primary)' : 'var(--color-text-tertiary)' }} />
                        <span style={{ color: session.isActive ? 'var(--color-primary)' : 'var(--color-text-tertiary)', fontWeight: 700 }}>
                          {session.isActive ? 'Join Session →' : 'Locked'}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.a>
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </section>

      {/* CTA */}
      <section style={{
        padding: isMobile ? '48px var(--space-4)' : '80px var(--space-6)',
        background: 'rgba(248,250,252,0.7)',
        borderTop: '1px solid var(--color-border)',
        textAlign: 'center',
      }}>
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
          style={{ maxWidth: '600px', margin: '0 auto' }}
        >
          <h2 style={{
            fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 800,
            fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)',
            marginBottom: 'var(--space-3)', lineHeight: 1.25,
          }}>
            Shape the future of MSMEs in Sri Lanka
          </h2>
          <p style={{
            fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-8)', lineHeight: 1.7,
          }}>
            Your voice matters. Join the conversation and help turn policy into impact.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <Link href={user ? '/agenda' : '/join'} style={{
              display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
              fontSize: 'var(--text-base)', fontWeight: 700, color: '#fff',
              background: 'var(--color-primary)',
              padding: '14px 32px', borderRadius: 'var(--radius-full)', textDecoration: 'none',
              boxShadow: '0 2px 16px rgba(37, 99, 235, 0.25)',
              transition: 'all var(--transition-fast)',
            }}>
              {user ? 'Explore Sessions' : 'Join Now'} <HiArrowRight size={18} />
            </Link>
            {!user && (
              <Link href="/login" style={{
                display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
                fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-text-primary)',
                background: '#FFFFFF', padding: '14px 32px',
                borderRadius: 'var(--radius-full)', textDecoration: 'none',
                border: '1px solid var(--color-border)',
                transition: 'all var(--transition-fast)',
              }}>
                Staff Login
              </Link>
            )}
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: 'var(--space-10) var(--space-4)',
        borderTop: '1px solid var(--color-border)',
        background: 'rgba(255,255,255,0.8)',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '24px' : 'var(--space-8)', marginBottom: 'var(--space-8)',
          }}>
            <div style={{ maxWidth: '340px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <img 
                  src="/ministry-logo.jpg" 
                  alt="Ministry Logo" 
                  style={{ height: '32px', width: 'auto' }}
                  onError={(e) => {
                    // Show text if image fails
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)', lineHeight: 1.1 }}>
                  Ministry of Industry and <br /> Entrepreneurship Development
                </span>
              </div>
              <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.7, color: 'var(--color-text-tertiary)' }}>
                National SME Policy Framework Implementation Dialogue.
                Bringing together donors, policymakers, and private sector leaders.
              </p>
            </div>

            <div style={{ display: 'flex', gap: isMobile ? '24px' : '40px', flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
              <div>
                <h4 style={{
                  fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-primary)',
                  marginBottom: 'var(--space-3)', letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>Event Details</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <HiOutlineCalendarDays size={14} style={{ color: 'var(--color-primary)' }} /> May 13-14, 2026
                  </span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <HiOutlineMapPin size={14} style={{ color: 'var(--color-primary)' }} /> The Grand Maitland, Colombo
                  </span>
                </div>
              </div>
              <div>
                <h4 style={{
                  fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-primary)',
                  marginBottom: 'var(--space-3)', letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>Quick Links</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <Link href="/join" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textDecoration: 'none' }}>Join as Participant</Link>
                  <Link href="/login" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textDecoration: 'none' }}>Staff Login</Link>
                  <a onClick={scrollToAgenda} style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>View Agenda</a>
                </div>
              </div>
            </div>
          </div>

          <div style={{
            paddingTop: 'var(--space-5)', borderTop: '1px solid var(--color-border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)',
          }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              National SME Policy Framework Implementation Dialogue
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Interactive Digital Engagement System © 2026
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
