/**
 * React Native implementation of TokenStorage using expo-secure-store
 */

import * as SecureStore from 'expo-secure-store';

// TokenStorage interface - platform-agnostic interface
export interface TokenStorage {
  getToken(): Promise<string | null>;
  setToken(token: string): Promise<void>;
  removeToken(): Promise<void>;
  getUser(): Promise<any | null>;
  setUser(user: any): Promise<void>;
  removeUser(): Promise<void>;
  clear(): Promise<void>;
}

export class ReactNativeTokenStorage implements TokenStorage {
  private readonly TOKEN_KEY = 'token';
  private readonly USER_KEY = 'user';

  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(this.TOKEN_KEY);
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  async setToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(this.TOKEN_KEY, token);
    } catch (error) {
      console.error('Error setting token:', error);
      throw error;
    }
  }

  async removeToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(this.TOKEN_KEY);
    } catch (error) {
      console.error('Error removing token:', error);
    }
  }

  async getUser(): Promise<any | null> {
    try {
      const userStr = await SecureStore.getItemAsync(this.USER_KEY);
      if (!userStr) return null;
      return JSON.parse(userStr);
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  async setUser(user: any): Promise<void> {
    try {
      await SecureStore.setItemAsync(this.USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Error setting user:', error);
      throw error;
    }
  }

  async removeUser(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(this.USER_KEY);
    } catch (error) {
      console.error('Error removing user:', error);
    }
  }

  async clear(): Promise<void> {
    await this.removeToken();
    await this.removeUser();
  }
}

