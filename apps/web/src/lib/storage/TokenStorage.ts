/**
 * Token storage abstraction interface
 * Allows platform-specific implementations (Web localStorage, React Native SecureStore, etc.)
 */

export interface TokenStorage {
  /**
   * Get the authentication token
   */
  getToken(): Promise<string | null>;
  
  /**
   * Set the authentication token
   */
  setToken(token: string): Promise<void>;
  
  /**
   * Remove the authentication token
   */
  removeToken(): Promise<void>;
  
  /**
   * Get the stored user data
   */
  getUser(): Promise<any | null>;
  
  /**
   * Set the user data
   */
  setUser(user: any): Promise<void>;
  
  /**
   * Remove the user data
   */
  removeUser(): Promise<void>;
  
  /**
   * Clear all stored data (token and user)
   */
  clear(): Promise<void>;
}

