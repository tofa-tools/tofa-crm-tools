import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { brandColors } from '../theme/brandTheme';

type Variant = 'primary' | 'accent' | 'outline';

interface StandardButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function StandardButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  textStyle,
}: StandardButtonProps) {
  const buttonStyle = [
    styles.base,
    variant === 'primary' && styles.primary,
    variant === 'accent' && styles.accent,
    variant === 'outline' && styles.outline,
    disabled && styles.disabled,
    style,
  ];
  const titleStyle = [
    styles.text,
    variant === 'primary' && styles.textOnPrimary,
    variant === 'accent' && styles.textOnAccent,
    variant === 'outline' && styles.textOnOutline,
    disabled && styles.textDisabled,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={titleStyle}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: brandColors.primary,
  },
  accent: {
    backgroundColor: brandColors.accent,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: brandColors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
  textOnPrimary: {
    color: brandColors.textOnPrimary,
  },
  textOnAccent: {
    color: brandColors.textOnAccent,
  },
  textOnOutline: {
    color: brandColors.primary,
  },
  textDisabled: {
    color: brandColors.textMuted,
  },
});
