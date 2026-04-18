'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setAccessToken, api } from './api-client';

interface User {
  id: string;
  email: string;
  role: string;
  teamId: string;
  totpEnabled: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<{ requiresTOTP?: boolean }>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.post<{ user: User; accessToken: string }>('/auth/refresh');
        if (data?.accessToken) {
          setAccessToken(data.accessToken);
          setUser(data.user);
        }
      } catch {
        setAccessToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string, totpCode?: string) => {
    const data = await api.post<{ user: User; accessToken: string; requiresTOTP?: boolean }>(
      '/auth/login',
      { email, password, totpCode },
    );
    if (data.requiresTOTP) {
      return { requiresTOTP: true };
    }
    if (data.accessToken) {
      setAccessToken(data.accessToken);
      setUser(data.user);
    }
    return {};
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const data = await api.post<{ user: User; accessToken: string }>('/auth/register', {
      email,
      password,
      name,
    });
    if (data.accessToken) {
      setAccessToken(data.accessToken);
      setUser(data.user);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
