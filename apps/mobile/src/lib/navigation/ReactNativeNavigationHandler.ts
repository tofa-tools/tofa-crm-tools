/**
 * React Native implementation of NavigationHandler using Expo Router
 */

import { router } from 'expo-router';

// NavigationHandler interface - platform-agnostic interface
export interface NavigationHandler {
  navigateToLogin(): void;
  navigateTo(path: string): void;
}

export class ReactNativeNavigationHandler implements NavigationHandler {
  navigateToLogin(): void {
    router.replace('/login');
  }

  navigateTo(path: string): void {
    // Map web paths to React Native routes
    const routeMap: Record<string, string> = {
      '/login': '/login',
      '/dashboard': '/coach/dashboard',
      '/coach/dashboard': '/coach/dashboard',
      '/leads': '/leads',
      '/batches': '/batches',
      '/check-in': '/check-in',
    };
    
    const route = routeMap[path] || path;
    router.push(route as any);
  }
}

