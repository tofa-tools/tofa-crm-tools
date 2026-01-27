/**
 * Web implementation of NavigationHandler using window.location
 */

import type { NavigationHandler } from './NavigationHandler';

export class WebNavigationHandler implements NavigationHandler {
  navigateToLogin(): void {
    if (typeof window === 'undefined') return;
    window.location.href = '/login';
  }

  navigateTo(path: string): void {
    if (typeof window === 'undefined') return;
    window.location.href = path;
  }
}

