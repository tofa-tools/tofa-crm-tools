/**
 * Navigation handler abstraction interface
 * Allows platform-specific implementations (Web window.location, React Native navigation, etc.)
 */

export interface NavigationHandler {
  /**
   * Navigate to the login page
   */
  navigateToLogin(): void;
  
  /**
   * Navigate to a specific path
   * @param path - Path to navigate to (e.g., '/dashboard', '/leads')
   */
  navigateTo(path: string): void;
}

