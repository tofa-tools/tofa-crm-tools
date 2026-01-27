/**
 * Web implementation of TokenStorage using localStorage
 */

import type { TokenStorage } from './TokenStorage';

export class WebTokenStorage implements TokenStorage {
  private readonly TOKEN_KEY = 'token';
  private readonly USER_KEY = 'user';

  async getToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.TOKEN_KEY);
  }

  async setToken(token: string): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  async removeToken(): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.TOKEN_KEY);
  }

  async getUser(): Promise<any | null> {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem(this.USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  async setUser(user: any): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  async removeUser(): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.USER_KEY);
  }

  async clear(): Promise<void> {
    await this.removeToken();
    await this.removeUser();
  }
}

