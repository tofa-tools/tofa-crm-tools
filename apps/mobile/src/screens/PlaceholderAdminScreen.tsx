import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StandardText } from '../components/StandardText';

type Props = { title: string };

export function PlaceholderAdminScreen({ title }: Props) {
  return (
    <View style={styles.container}>
      <StandardText variant="heading">{title}</StandardText>
      <StandardText variant="muted">Admin screen (placeholder)</StandardText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
});
