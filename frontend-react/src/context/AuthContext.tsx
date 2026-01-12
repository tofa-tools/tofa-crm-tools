'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { authAPI } from '@/lib/api';
import type { AuthUser } from '@/types';

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Token expiration check (JWT tokens have exp claim)
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    // Consider token expired if it expires within 1 minute (buffer)
    return now >= (exp - 60000);
  } catch (error) {
    return true; // If we can't parse, consider it expired
  }
}

// Get token expiration time in milliseconds
function getTokenExpirationTime(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000; // Convert to milliseconds
  } catch (error) {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tokenCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const logout = React.useCallback(() => {
    // Clear timers
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (tokenCheckIntervalRef.current) {
      clearInterval(tokenCheckIntervalRef.current);
      tokenCheckIntervalRef.current = null;
    }
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    setUser(null);
    window.location.href = '/login';
  }, []);

  const refreshUser = React.useCallback(async (silent: boolean = false) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        if (!silent) {
          logout();
        }
        return;
      }
      
      // Check if token is expired before making API call
      if (isTokenExpired(token)) {
        console.log('Token expired, logging out');
        if (!silent) {
          logout();
        }
        return;
      }
      
      const userData = await authAPI.getCurrentUser();
      // Convert User type to AuthUser type (match what login returns)
      // AuthUser only has email and role, not full_name
      const authUser: AuthUser = {
        email: userData.email,
        role: userData.role,
      };
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(authUser));
      }
      setUser(authUser);
    } catch (error: any) {
      console.error('Error refreshing user:', error);
      // Only logout if it's a 401 (unauthorized), not network errors
      if (error?.response?.status === 401) {
        if (!silent) {
          logout();
        }
      }
      // For other errors (network, etc.), don't logout - just log the error
    }
  }, [logout]);

  // Setup token expiration checking and inactivity timer
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    // Check token expiration immediately
    if (isTokenExpired(token)) {
      console.log('Token expired on mount');
      logout();
      setIsLoading(false);
      return;
    }

    // Set up periodic token expiration check (every 30 seconds)
    tokenCheckIntervalRef.current = setInterval(() => {
      const currentToken = localStorage.getItem('token');
      if (currentToken && isTokenExpired(currentToken)) {
        console.log('Token expired during session');
        logout();
      }
    }, 30000); // Check every 30 seconds

    // Set up inactivity timer (55 minutes - 5 minutes before token expires)
    // This gives user a chance to stay logged in if they're active
    const resetInactivityTimer = () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      
      // Set timer for 55 minutes (5 minutes before 60 min expiration)
      inactivityTimerRef.current = setTimeout(() => {
        const currentToken = localStorage.getItem('token');
        if (currentToken) {
          const expTime = getTokenExpirationTime(currentToken);
          if (expTime) {
            const timeUntilExp = expTime - Date.now();
            if (timeUntilExp <= 0) {
              // Token already expired
              logout();
            } else if (timeUntilExp < 300000) { // Less than 5 minutes left
              // Show warning and logout soon
              console.log('Token expiring soon, will logout in', Math.floor(timeUntilExp / 1000), 'seconds');
              setTimeout(() => logout(), timeUntilExp);
            }
          }
        }
      }, 55 * 60 * 1000); // 55 minutes
    };

    // Reset inactivity timer on user activity
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(event => {
      window.addEventListener(event, resetInactivityTimer, { passive: true });
    });

    resetInactivityTimer();

    // Cleanup
    return () => {
      if (tokenCheckIntervalRef.current) {
        clearInterval(tokenCheckIntervalRef.current);
        tokenCheckIntervalRef.current = null;
      }
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [logout]);

  useEffect(() => {
    // Restore user from localStorage on mount
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      
      if (storedUser && token) {
        try {
          // Check token expiration before setting user
          if (!isTokenExpired(token)) {
            setUser(JSON.parse(storedUser));
            // Refresh user data from backend silently (don't logout on error)
            refreshUser(true);
          } else {
            console.log('Token expired, not restoring user');
            logout();
          }
        } catch (error) {
          console.error('Error parsing stored user:', error);
          localStorage.removeItem('user');
          localStorage.removeItem('token');
        }
      }
      setIsLoading(false);
    }
  }, [logout, refreshUser]);

  const login = async (email: string, password: string) => {
    try {
      const response = await authAPI.login(email, password);
      const userData: AuthUser = { email, role: response.role };
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', response.access_token);
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Reset inactivity timer after login
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
      }
      
      setUser(userData);
      
      // Return user data for redirect logic
      return userData;
    } catch (error) {
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        refreshUser,
        isAuthenticated: !!user,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


