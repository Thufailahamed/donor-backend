'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineInformationCircle, HiOutlineXMark } from 'react-icons/hi2';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  showToast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const dismissAll = () => setToasts([]);

  const iconMap = {
    success: <HiOutlineCheckCircle size={18} />,
    error: <HiOutlineXCircle size={18} />,
    info: <HiOutlineInformationCircle size={18} />,
  };

  const colorMap = {
    success: { bg: '#F0FDF4', border: 'rgba(22,163,74,0.25)', color: '#16A34A', bar: '#16A34A' },
    error:   { bg: '#FEF2F2', border: 'rgba(220,38,38,0.25)',  color: '#DC2626', bar: '#DC2626' },
    info:    { bg: '#EFF6FF', border: 'rgba(37,99,235,0.25)',  color: '#2563EB', bar: '#2563EB' },
  };

  // Detect mobile for positioning
  const [isMobileToast, setIsMobileToast] = React.useState(false);
  React.useEffect(() => {
    const checkMobile = () => setIsMobileToast(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Stack */}
      <div style={{
        position: 'fixed', 
        top: isMobileToast ? '16px' : 'auto',
        bottom: isMobileToast ? 'auto' : '24px', 
        right: isMobileToast ? '50%' : '24px',
        transform: isMobileToast ? 'translateX(50%)' : 'none',
        zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: '10px',
        maxWidth: '380px', width: 'calc(100vw - 48px)',
        pointerEvents: toasts.length === 0 ? 'none' : 'auto',
      }}>
        {/* Dismiss All — shown when 2+ toasts */}
        <AnimatePresence>
          {toasts.length >= 2 && (
            <motion.button
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              onClick={dismissAll}
              style={{
                alignSelf: 'flex-end',
                background: 'rgba(15,23,42,0.08)',
                border: 'none', borderRadius: '20px',
                padding: '4px 12px', fontSize: '12px', fontWeight: 700,
                color: '#64748B', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '4px',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(15,23,42,0.14)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(15,23,42,0.08)')}
            >
              <HiOutlineXMark size={12} /> Dismiss all
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence mode="popLayout">
          {toasts.map(t => {
            const c = colorMap[t.type];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ 
                  opacity: 0, 
                  y: isMobileToast ? -20 : 0,
                  x: isMobileToast ? 0 : 40, 
                  scale: 0.95 
                }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                exit={{ 
                  opacity: 0, 
                  y: isMobileToast ? -20 : 0,
                  x: isMobileToast ? 40 : 0, 
                  scale: 0.9 
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  color: '#1E293B',
                  fontSize: '13px', fontWeight: 500,
                  boxShadow: '0 4px 24px rgba(15,23,42,0.1)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Colored left accent bar */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, bottom: 0, width: '3px',
                  background: c.bar, borderRadius: '12px 0 0 12px',
                }} />

                <span style={{ color: c.color, flexShrink: 0, marginTop: '1px' }}>
                  {iconMap[t.type]}
                </span>
                <span style={{ flex: 1, lineHeight: 1.5 }}>{t.message}</span>
                <button
                  onClick={() => dismiss(t.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#94A3B8', padding: '1px', flexShrink: 0,
                    display: 'flex', alignItems: 'center',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#475569')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
                >
                  <HiOutlineXMark size={15} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
