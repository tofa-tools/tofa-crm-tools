import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StandardText } from '../components/StandardText';

export function TasksScreen() {
  return (
    <View style={styles.container}>
      <StandardText variant="heading">Tasks</StandardText>
      <StandardText variant="muted">Tasks and follow-ups</StandardText>
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
