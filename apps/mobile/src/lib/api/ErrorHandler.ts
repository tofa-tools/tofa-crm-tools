/**
 * Error handler for React Native
 * Platform-specific implementation matching the web app pattern
 */

import type { AxiosError } from 'axios';
import type { TokenStorage } from '../storage/ReactNativeTokenStorage';
import type { NavigationHandler } from '../navigation/ReactNativeNavigationHandler';

export interface ValidationError {
  field?: string;
  message: string;
  code: string;
  details?: any;
}

export interface ErrorHandler {
  handle401(error: AxiosError, tokenStorage: TokenStorage): Promise<void>;
  handle400(error: AxiosError): ValidationError;
  handleNetworkError(error: AxiosError): void;
}

export class StandardErrorHandler implements ErrorHandler {
  constructor(
    private navigationHandler: NavigationHandler,
    private onLogout?: () => void
  ) {}

  async handle401(error: AxiosError, tokenStorage: TokenStorage): Promise<void> {
    const token = await tokenStorage.getToken();
    
    if (token) {
      // Clear stored auth data
      await tokenStorage.clear();
      
      // Call custom logout handler if provided, otherwise navigate to login
      if (this.onLogout) {
        this.onLogout();
      } else {
        this.navigationHandler.navigateToLogin();
      }
    }
  }

  handle400(error: AxiosError): ValidationError {
    const detail = error.response?.data?.detail;
    
    // Handle different error formats
    if (typeof detail === 'string') {
      return {
        message: detail,
        code: 'VALIDATION_ERROR',
      };
    }
    
    if (typeof detail === 'object' && detail !== null) {
      // Handle field-specific validation errors
      if (Array.isArray(detail)) {
        const firstError = detail[0];
        return {
          field: firstError?.loc?.[firstError.loc.length - 1],
          message: firstError?.msg || 'Validation error',
          code: firstError?.type || 'VALIDATION_ERROR',
          details: detail,
        };
      }
      
      // Handle object with message
      return {
        message: detail.message || 'Validation error',
        code: detail.code || 'VALIDATION_ERROR',
        details: detail,
      };
    }
    
    return {
      message: 'Validation error',
      code: 'VALIDATION_ERROR',
    };
  }

  handleNetworkError(error: AxiosError): void {
    // Network errors are typically handled by the calling code
    console.error('Network error:', error.message);
  }
}

