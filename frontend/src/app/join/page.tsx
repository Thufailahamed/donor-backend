'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import Link from 'next/link';
import { HiOutlineUserCircle, HiOutlineArrowRight } from 'react-icons/hi2';

export default function JoinPage() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { guestLogin } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      showToast('error', 'Please enter your name (at least 2 characters)');
      return;
    }
    setLoading(true);
    try {
      await guestLogin(name.trim());
      showToast('success', 'Welcome to the summit!');
      router.push('/');
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Failed to join. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-6)',
    }}>
      {/* Decorative */}
      <div style={{
        position: 'fixed', top: '20%', left: '10%', width: '400px', height: '400px',
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
        filter: 'blur(80px)', pointerEvents: 'none',
      }} />

      <div className="glass-card animate-fade-in-up" style={{
        width: '100%', maxWidth: '460px', padding: 'var(--space-10)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <div style={{
            width: '64px', height: '64px', margin: '0 auto var(--space-4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(135deg, var(--color-primary-glow), rgba(245,158,11,0.1))',
            color: 'var(--color-primary-light)',
          }}>
            <HiOutlineUserCircle size={32} />
          </div>
          <h1 style={{
            fontSize: 'var(--text-2xl)', fontWeight: 800,
            fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-2)',
          }}>
            Join the Summit
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
            Enter your name to start participating — no account needed.
          </p>
        </div>

        <form onSubmit={handleJoin}>
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <label htmlFor="guest-name-input" style={{
              display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600,
              color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)',
            }}>
              Your Name
            </label>
            <input
              id="guest-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              autoFocus
              maxLength={100}
              style={{
                width: '100%', padding: 'var(--space-3) var(--space-4)',
                background: 'var(--color-bg-input)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--text-base)',
                outline: 'none',
                transition: 'border-color var(--transition-fast)',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
            />
          </div>

          <button
            id="join-button"
            type="submit"
            disabled={loading || name.trim().length < 2}
            style={{
              width: '100%', padding: 'var(--space-3) var(--space-6)',
              background: loading ? 'var(--color-text-tertiary)' : 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
              color: '#fff', border: 'none', borderRadius: 'var(--radius-md)',
              fontWeight: 700, fontSize: 'var(--text-base)',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
              boxShadow: loading ? 'none' : 'var(--shadow-glow-primary)',
              transition: 'all var(--transition-base)',
              opacity: name.trim().length < 2 ? 0.5 : 1,
            }}
          >
            {loading ? 'Joining...' : 'Join Summit'}
            {!loading && <HiOutlineArrowRight size={18} />}
          </button>
        </form>

        <div style={{
          marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)',
          borderTop: '1px solid var(--color-border)', textAlign: 'center',
        }}>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
            Are you a speaker or moderator?{' '}
            <Link href="/login" style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>
              Staff Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
