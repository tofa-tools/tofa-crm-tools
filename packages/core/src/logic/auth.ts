/**
 * Pure JWT token utilities
 * Platform-agnostic - no browser dependencies
 */

/**
 * JWT token payload structure
 */
export interface TokenPayload {
  exp: number;
  [key: string]: any;
}

/**
 * Parse JWT token payload
 * Returns null if token is invalid or cannot be parsed
 */
export function parseTokenPayload(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Check if token is expired
 * @param token - JWT token string
 * @param bufferMs - Buffer time in milliseconds before expiration (default: 60000 = 1 minute)
 * @returns true if token is expired or will expire within buffer time
 */
export function isTokenExpired(token: string, bufferMs: number = 60000): boolean {
  const payload = parseTokenPayload(token);
  if (!payload || !payload.exp) {
    return true; // If we can't parse, consider it expired
  }
  
  const exp = payload.exp * 1000; // Convert to milliseconds
  const now = Date.now();
  return now >= (exp - bufferMs);
}

/**
 * Get token expiration time in milliseconds
 * @param token - JWT token string
 * @returns Expiration timestamp in milliseconds, or null if invalid
 */
export function getTokenExpirationTime(token: string): number | null {
  const payload = parseTokenPayload(token);
  if (!payload || !payload.exp) {
    return null;
  }
  return payload.exp * 1000; // Convert to milliseconds
}

/**
 * Get time until token expiration in milliseconds
 * @param token - JWT token string
 * @returns Milliseconds until expiration, or null if invalid/expired
 */
export function getTimeUntilExpiration(token: string): number | null {
  const expTime = getTokenExpirationTime(token);
  if (!expTime) {
    return null;
  }
  
  const now = Date.now();
  const timeUntilExp = expTime - now;
  return timeUntilExp > 0 ? timeUntilExp : null;
}

