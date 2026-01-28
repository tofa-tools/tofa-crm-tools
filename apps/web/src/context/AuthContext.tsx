'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { authAPI } from '@/lib/api';
import type { AuthUser } from '@tofa/core';
import { createTokenStorage, type TokenStorage } from '@/lib/storage';
import { createNavigationHandler, type NavigationHandler } from '@/lib/navigation';
import { isTokenExpired, getTokenExpirationTime } from '@tofa/core';

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  refreshUser?: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Token expiration functions now imported from @/lib/logic/auth

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tokenCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Create platform-specific instances
  const tokenStorageRef = useRef<TokenStorage | null>(null);
  const navigationHandlerRef = useRef<NavigationHandler | null>(null);
  
  // Initialize storage and navigation handlers
  React.useEffect(() => {
    tokenStorageRef.current = createTokenStorage();
    navigationHandlerRef.current = createNavigationHandler();
  }, []);

  const logout = React.useCallback(async () => {
    // Clear timers
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (tokenCheckIntervalRef.current) {
      clearInterval(tokenCheckIntervalRef.current);
      tokenCheckIntervalRef.current = null;
    }
    
    // Clear token storage
    if (tokenStorageRef.current) {
      await tokenStorageRef.current.clear();
    }
    
    setUser(null);
    
    // Navigate to login
    if (navigationHandlerRef.current) {
      navigationHandlerRef.current.navigateToLogin();
    }
  }, []);

  const refreshUser = React.useCallback(async (silent: boolean = false) => {
    console.log('[AuthContext] refreshUser called, silent:', silent);
    try {
      if (!tokenStorageRef.current) {
        console.log('[AuthContext] No token storage available in refreshUser');
        return;
      }
      
      const token = await tokenStorageRef.current.getToken();
      if (!token) {
        console.log('[AuthContext] No token found in refreshUser');
        if (!silent) {
          await logout();
        }
        return;
      }
      
      // Check if token is expired before making API call
      if (isTokenExpired(token)) {
        console.log('[AuthContext] Token expired, logging out');
        if (!silent) {
          await logout();
        }
        return;
      }
      
      console.log('[AuthContext] Calling authAPI.getCurrentUser() (GET /me)...');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      console.log('[AuthContext] API URL:', apiUrl);
      
      const userData = await authAPI.getCurrentUser();
      console.log('[AuthContext] getCurrentUser response received:', userData);
      
      // Convert User type to AuthUser type (match what login returns)
      // AuthUser only has email and role, not full_name
      const authUser: AuthUser = {
        email: userData.email,
        role: userData.role,
      };
      
      if (tokenStorageRef.current) {
        await tokenStorageRef.current.setUser(authUser);
      }
      setUser(authUser);
      console.log('[AuthContext] User updated successfully');
    } catch (error: any) {
      console.error('[AuthContext] Error refreshing user:', error);
      console.error('[AuthContext] Error details:', {
        message: error?.message,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        url: error?.config?.url,
        baseURL: error?.config?.baseURL,
      });
      // Only logout if it's a 401 (unauthorized), not network errors
      if (error?.response?.status === 401) {
        console.log('[AuthContext] 401 Unauthorized, logging out');
        if (!silent) {
          await logout();
        }
      } else {
        console.log('[AuthContext] Non-401 error, not logging out (network error?)');
      }
      // For other errors (network, etc.), don't logout - just log the error
    }
  }, [logout]);

  // Setup token expiration checking and inactivity timer
  useEffect(() => {
    if (!tokenStorageRef.current) {
      setIsLoading(false);
      return;
    }

    const initializeAuth = async () => {
      const token = await tokenStorageRef.current!.getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      // Check token expiration immediately
      if (isTokenExpired(token)) {
        console.log('Token expired on mount');
        await logout();
        setIsLoading(false);
        return;
      }

      // Set up periodic token expiration check (every 30 seconds)
      tokenCheckIntervalRef.current = setInterval(async () => {
        if (tokenStorageRef.current) {
          const currentToken = await tokenStorageRef.current.getToken();
          if (currentToken && isTokenExpired(currentToken)) {
            console.log('Token expired during session');
            await logout();
          }
        }
      }, 30000); // Check every 30 seconds

      // Set up inactivity timer (55 minutes - 5 minutes before token expires)
      // This gives user a chance to stay logged in if they're active
      const resetInactivityTimer = async () => {
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
        
        // Set timer for 55 minutes (5 minutes before 60 min expiration)
        inactivityTimerRef.current = setTimeout(async () => {
          if (tokenStorageRef.current) {
            const currentToken = await tokenStorageRef.current.getToken();
            if (currentToken) {
              const expTime = getTokenExpirationTime(currentToken);
              if (expTime) {
                const timeUntilExp = expTime - Date.now();
                if (timeUntilExp <= 0) {
                  // Token already expired
                  await logout();
                } else if (timeUntilExp < 300000) { // Less than 5 minutes left
                  // Show warning and logout soon
                  console.log('Token expiring soon, will logout in', Math.floor(timeUntilExp / 1000), 'seconds');
                  setTimeout(() => logout(), timeUntilExp);
                }
              }
            }
          }
        }, 55 * 60 * 1000); // 55 minutes
      };

      // Reset inactivity timer on user activity (only in browser)
      if (typeof window !== 'undefined') {
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
      } else {
        // In non-browser environment, just set up the timer once
        resetInactivityTimer();
        return () => {
          if (tokenCheckIntervalRef.current) {
            clearInterval(tokenCheckIntervalRef.current);
            tokenCheckIntervalRef.current = null;
          }
          if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
          }
        };
      }
    };

    initializeAuth();
  }, [logout]);

  useEffect(() => {
    // Restore user from token storage on mount
    const restoreUser = async () => {
      console.log('[AuthContext] Starting restoreUser...');
      if (!tokenStorageRef.current) {
        console.log('[AuthContext] No token storage available');
        setIsLoading(false);
        return;
      }
      
      try {
        const storedUser = await tokenStorageRef.current.getUser();
        const token = await tokenStorageRef.current.getToken();
        console.log('[AuthContext] Stored user:', storedUser ? 'found' : 'not found');
        console.log('[AuthContext] Token:', token ? 'found' : 'not found');
        
        if (storedUser && token) {
          // Check token expiration before setting user
          if (!isTokenExpired(token)) {
            console.log('[AuthContext] Token valid, setting user and refreshing from backend...');
            setUser(storedUser);
            // Refresh user data from backend silently (don't logout on error)
            await refreshUser(true);
            console.log('[AuthContext] User refresh completed');
          } else {
            console.log('[AuthContext] Token expired, not restoring user');
            await logout();
          }
        } else {
          console.log('[AuthContext] No stored user or token, skipping restore');
        }
      } catch (error) {
        console.error('[AuthContext] Error restoring user:', error);
        if (tokenStorageRef.current) {
          await tokenStorageRef.current.clear();
        }
      } finally {
        console.log('[AuthContext] Restore complete, setting isLoading to false');
        setIsLoading(false);
      }
    };
    
    restoreUser();
  }, [logout, refreshUser]);

  const login = async (email: string, password: string) => {
    try {
      const response = await authAPI.login(email, password);
      const userData: AuthUser = { email, role: response.role };
      
      if (tokenStorageRef.current) {
        await tokenStorageRef.current.setToken(response.access_token);
        await tokenStorageRef.current.setUser(userData);
      }
      
      // Reset inactivity timer after login
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
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


