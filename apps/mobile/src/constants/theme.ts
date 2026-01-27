/**
 * TOFA Mobile App Theme
 * Brand colors: Navy and Gold
 * 
 * Now synced with @tofa/core brandConfig for consistency across Web and Mobile
 */

import { brandConfig } from '@tofa/core';

export const TOFA_THEME = {
  colors: {
    // Primary brand colors - synced from brandConfig
    navy: brandConfig.colors.primary,
    gold: brandConfig.colors.accent,
    
    // Semantic colors - using brand tokens
    primary: brandConfig.colors.primary,
    secondary: brandConfig.colors.accent,
    background: '#FFFFFF',
    surface: brandConfig.colors.surface,
    text: brandConfig.colors.primary,
    textSecondary: '#6B7280',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    info: '#3B82F6',
    
    // UI elements
    border: '#E5E7EB',
    divider: '#E5E7EB',
    placeholder: '#9CA3AF',
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  
  typography: {
    fontFamily: {
      regular: 'System',
      medium: 'System',
      bold: 'System',
    },
    fontSize: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      xxxl: 32,
    },
  },
  
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
  },
} as const;

export type Theme = typeof TOFA_THEME;

