/**
 * Error handler abstraction for API errors
 * Provides standardized error handling across platforms
 */

import type { AxiosError } from 'axios';
import type { TokenStorage } from '@/lib/storage';
import type { NavigationHandler } from '@/lib/navigation';

/**
 * Validation error structure
 */
export interface ValidationError {
  field?: string;
  message: string;
  code: string;
  details?: any;
}

/**
 * Error handler interface
 */
export interface ErrorHandler {
  /**
   * Handle 401 Unauthorized errors
   */
  handle401(error: AxiosError, tokenStorage: TokenStorage): Promise<void>;
  
  /**
   * Handle 400 Bad Request / Validation errors
   */
  handle400(error: AxiosError): ValidationError;
  
  /**
   * Handle network errors
   */
  handleNetworkError(error: AxiosError): void;
}

/**
 * Standard error handler implementation
 */
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
    const detail = (error.response?.data as any)?.detail;
    
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
    // This is a placeholder for future network error handling logic
    console.error('Network error:', error.message);
  }
}

