import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { AuthUser } from '@tofa/core';
import { isTokenExpired } from '@tofa/core';
import { authAPI } from '../lib/api';
import * as storage from '../lib/storage';

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async () => {
    await storage.clear();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const token = await storage.getToken();
      if (!token || isTokenExpired(token)) {
        await logout();
        return;
      }
      const userData = await authAPI.getCurrentUser();
      const authUser: AuthUser = { email: userData.email, role: userData.role };
      await storage.setUser(authUser);
      setUser(authUser);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) await logout();
    }
  }, [logout]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await storage.getToken();
        const storedUser = await storage.getUser();
        if (!token || !storedUser) {
          if (!cancelled) setIsLoading(false);
          return;
        }
        if (isTokenExpired(token)) {
          await logout();
          if (!cancelled) setIsLoading(false);
          return;
        }
        if (!cancelled) setUser(storedUser);
        await refreshUser();
      } catch {
        await logout();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [logout, refreshUser]);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthUser> => {
      const response = await authAPI.login(email, password);
      const authUser: AuthUser = { email, role: response.role };
      await storage.setToken(response.access_token);
      await storage.setUser(authUser);
      setUser(authUser);
      return authUser;
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
