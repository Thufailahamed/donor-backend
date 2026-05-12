'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineXMark } from 'react-icons/hi2';

export interface MobileNavItem {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  highlight?: boolean;
}

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  items: MobileNavItem[];
  user?: { name: string; role: string } | null;
  onLogout?: () => void;
}

export default function MobileNav({ isOpen, onClose, items, user, onLogout }: MobileNavProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
            }}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: '280px', maxWidth: '85vw', zIndex: 1001,
              background: '#FFFFFF', boxShadow: '-8px 0 30px rgba(0,0,0,0.15)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 20px', borderBottom: '1px solid #E2E8F0',
            }}>
              {user ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'var(--color-primary)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', fontWeight: 700,
                  }}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>{user.name}</span>
                </div>
              ) : (
                <span style={{ fontWeight: 800, fontSize: '16px', fontFamily: 'var(--font-heading)' }}>Menu</span>
              )}
              <button onClick={onClose} style={{
                background: 'none', border: '1px solid #E2E8F0',
                borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#64748B',
              }}>
                <HiOutlineXMark size={20} />
              </button>
            </div>

            <div style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
              {items.map((item, i) => (
                item.href ? (
                  <Link
                    key={i}
                    href={item.href}
                    onClick={onClose}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '14px 20px', color: item.highlight ? '#fff' : '#334155',
                      fontWeight: item.highlight ? 700 : 600, fontSize: '15px',
                      textDecoration: 'none', margin: item.highlight ? '8px 16px' : '0',
                      borderRadius: item.highlight ? '10px' : '0',
                      background: item.highlight ? 'var(--color-primary)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!item.highlight) e.currentTarget.style.background = '#F1F5F9'; }}
                    onMouseLeave={e => { if (!item.highlight) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={i}
                    onClick={() => { item.onClick?.(); onClose(); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '14px 20px', color: '#334155',
                      fontWeight: 600, fontSize: '15px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      width: '100%', textAlign: 'left', textDecoration: 'none',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                )
              ))}
            </div>

            {user && onLogout && (
              <div style={{ padding: '16px 20px', borderTop: '1px solid #E2E8F0' }}>
                <button
                  onClick={() => { onLogout(); onClose(); }}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '10px',
                    border: '1px solid #E2E8F0', background: '#F8FAFC',
                    color: '#64748B', fontWeight: 600, fontSize: '14px',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
