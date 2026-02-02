import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { StandardText } from '../components/StandardText';
import { StandardButton } from '../components/StandardButton';
import { brandColors } from '../theme/brandTheme';

type Props = {
  onNavigateToBatches?: () => void;
  onNavigateToCenters?: () => void;
  onNavigateToUsers?: () => void;
};

export function MoreScreen({
  onNavigateToBatches,
  onNavigateToCenters,
  onNavigateToUsers,
}: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StandardText variant="heading" style={styles.title}>
        More
      </StandardText>
      <StandardText variant="muted" style={styles.subtitle}>
        Admin tasks (use drawer menu for full list)
      </StandardText>
      <View style={styles.actions}>
        <StandardButton
          title="Batches"
          onPress={onNavigateToBatches ?? (() => {})}
          variant="outline"
        />
        <StandardButton
          title="Centers"
          onPress={onNavigateToCenters ?? (() => {})}
          variant="outline"
        />
        <StandardButton
          title="Users"
          onPress={onNavigateToUsers ?? (() => {})}
          variant="outline"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.surface },
  content: { padding: 24, paddingBottom: 48 },
  title: { marginBottom: 8 },
  subtitle: { marginBottom: 24 },
  actions: { gap: 12 },
});
