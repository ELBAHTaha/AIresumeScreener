'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthUser, getUser, getToken, clearAuth, saveAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getUser());
    setToken(getToken());
    setLoading(false);
  }, []);

  async function login(email: string, password: string) {
    const res = await api.auth.login({ email, password });
    saveAuth(res.accessToken, res.user);
    setToken(res.accessToken);
    setUser(res.user);
  }

  async function register(data: any) {
    const res = await api.auth.register(data);
    saveAuth(res.accessToken, res.user);
    setToken(res.accessToken);
    setUser(res.user);
  }

  function logout() {
    clearAuth();
    setUser(null);
    setToken(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
