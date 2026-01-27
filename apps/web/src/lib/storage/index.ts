/**
 * Token storage factory
 * Returns platform-specific implementation
 */

import type { TokenStorage } from './TokenStorage';
import { WebTokenStorage } from './WebTokenStorage';
// Future: import { ReactNativeTokenStorage } from './ReactNativeTokenStorage';

/**
 * Create a token storage instance based on the current platform
 * Returns a safe implementation that works during SSR (returns null/does nothing)
 */
export function createTokenStorage(): TokenStorage {
  // Web platform - always return WebTokenStorage, it handles SSR safely
  // WebTokenStorage checks for window internally and returns null/does nothing during SSR
  return new WebTokenStorage();
  
  // React Native platform (to be implemented)
  // if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
  //   return new ReactNativeTokenStorage();
  // }
}

// Re-export types and implementations
export type { TokenStorage } from './TokenStorage';
export { WebTokenStorage } from './WebTokenStorage';

