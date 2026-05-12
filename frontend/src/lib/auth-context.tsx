'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import apiClient from '@/lib/api-client';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  guestLogin: (name: string) => Promise<void>;
  adminLogin: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('ides_user');
      try { return savedUser ? JSON.parse(savedUser) : null; } catch { return null; }
    }
    return null;
  });
  const [token, setToken] = useState<string | null>(() => 
    typeof window !== 'undefined' ? localStorage.getItem('ides_token') : null
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user && token) {
      connectSocket(user.id, user.name, user.role);
    }
    setIsLoading(false);
  }, [user, token]);

  const guestLogin = useCallback(async (name: string) => {
    const res = await apiClient.post('/auth/guest', { name });
    const { token: t, user: u } = res.data;
    setToken(t);
    setUser(u);
    localStorage.setItem('ides_token', t);
    localStorage.setItem('ides_user', JSON.stringify(u));
    localStorage.setItem('ides_user_id', u.id);
    connectSocket(u.id, u.name, u.role);
  }, []);

  const adminLogin = useCallback(async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password });
    const { token: t, user: u } = res.data;
    setToken(t);
    setUser(u);
    localStorage.setItem('ides_token', t);
    localStorage.setItem('ides_user', JSON.stringify(u));
    localStorage.setItem('ides_user_id', u.id);
    connectSocket(u.id, u.name, u.role);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('ides_token');
    localStorage.removeItem('ides_user');
    localStorage.removeItem('ides_user_id');
    disconnectSocket();
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, guestLogin, adminLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
