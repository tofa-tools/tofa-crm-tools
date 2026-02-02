import { StyleSheet } from 'react-native';

/**
 * Navy & Gold theme ported from @tofa/core brandConfig.
 * Use for StandardButton, StandardText, and app-wide styling.
 */
export const brandColors = {
  primary: '#0A192F',   // Navy
  accent: '#D4AF37',    // Gold
  surface: '#F8FAFC',  // Slate 50
  white: '#FFFFFF',
  black: '#000000',
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#0A192F',
  textMuted: '#64748B',
};

export const brandTheme = StyleSheet.create({
  primaryBg: { backgroundColor: brandColors.primary },
  accentBg: { backgroundColor: brandColors.accent },
  surfaceBg: { backgroundColor: brandColors.surface },
  primaryBorder: { borderColor: brandColors.primary },
  accentBorder: { borderColor: brandColors.accent },
});
