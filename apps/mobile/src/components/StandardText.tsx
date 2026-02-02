import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { brandColors } from '../theme/brandTheme';

type Variant = 'heading' | 'body' | 'muted' | 'accent';

interface StandardTextProps {
  children: React.ReactNode;
  variant?: Variant;
  style?: TextStyle;
}

export function StandardText({ children, variant = 'body', style }: StandardTextProps) {
  return <Text style={[styles.base, styles[variant], style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  base: {
    fontSize: 16,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: brandColors.primary,
  },
  body: {
    color: brandColors.primary,
  },
  muted: {
    color: brandColors.textMuted,
  },
  accent: {
    color: brandColors.accent,
    fontWeight: '600',
  },
});
