'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import Link from 'next/link';
import { HiOutlineLockClosed } from 'react-icons/hi2';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { adminLogin } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('error', 'Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      await adminLogin(email, password);
      showToast('success', 'Welcome back!');
      router.push('/');
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-6)',
    }}>
      <div className="glass-card animate-fade-in-up" style={{
        width: '100%', maxWidth: '460px', padding: 'var(--space-10)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <div style={{
            width: '64px', height: '64px', margin: '0 auto var(--space-4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(99,102,241,0.1))',
            color: 'var(--color-accent)',
          }}>
            <HiOutlineLockClosed size={32} />
          </div>
          <h1 style={{
            fontSize: 'var(--text-2xl)', fontWeight: 800,
            fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-2)',
          }}>
            Staff Login
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
            For speakers, moderators, and administrators.
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label htmlFor="login-email" style={{
              display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600,
              color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)',
            }}>Email</label>
            <input
              id="login-email"
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com" required maxLength={255}
              style={{
                width: '100%', padding: 'var(--space-3) var(--space-4)',
                background: 'var(--color-bg-input)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)',
                fontSize: 'var(--text-base)', outline: 'none',
                transition: 'border-color var(--transition-fast)',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--color-accent)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
            />
          </div>

          <div style={{ marginBottom: 'var(--space-6)' }}>
            <label htmlFor="login-password" style={{
              display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600,
              color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)',
            }}>Password</label>
            <input
              id="login-password"
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password" required maxLength={255}
              style={{
                width: '100%', padding: 'var(--space-3) var(--space-4)',
                background: 'var(--color-bg-input)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)',
                fontSize: 'var(--text-base)', outline: 'none',
                transition: 'border-color var(--transition-fast)',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--color-accent)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
            />
          </div>

          <button id="login-button" type="submit" disabled={loading}
            style={{
              width: '100%', padding: 'var(--space-3) var(--space-6)',
              background: loading ? 'var(--color-text-tertiary)' : 'linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))',
              color: '#fff', border: 'none', borderRadius: 'var(--radius-md)',
              fontWeight: 700, fontSize: 'var(--text-base)',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : 'var(--shadow-glow-accent)',
              transition: 'all var(--transition-base)',
            }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{
          marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)',
          borderTop: '1px solid var(--color-border)', textAlign: 'center',
        }}>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
            Participant?{' '}
            <Link href="/join" style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>
              Join as Guest
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
