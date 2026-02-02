import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StandardText } from '../components/StandardText';

export function LeadsScreen() {
  return (
    <View style={styles.container}>
      <StandardText variant="heading">Leads</StandardText>
      <StandardText variant="muted">Lead list and actions</StandardText>
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
