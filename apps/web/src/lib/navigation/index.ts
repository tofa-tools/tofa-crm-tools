/**
 * Navigation handler factory
 * Returns platform-specific implementation
 */

import type { NavigationHandler } from './NavigationHandler';
import { WebNavigationHandler } from './WebNavigationHandler';
// Future: import { ReactNativeNavigationHandler } from './ReactNativeNavigationHandler';

/**
 * Create a navigation handler instance based on the current platform
 */
export function createNavigationHandler(): NavigationHandler {
  // Web platform
  if (typeof window !== 'undefined') {
    return new WebNavigationHandler();
  }
  
  // React Native platform (to be implemented)
  // if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
  //   return new ReactNativeNavigationHandler(navigation);
  // }
  
  // Fallback: no-op implementation
  return {
    navigateToLogin: () => {},
    navigateTo: () => {},
  };
}

// Re-export types and implementations
export type { NavigationHandler } from './NavigationHandler';
export { WebNavigationHandler } from './WebNavigationHandler';

