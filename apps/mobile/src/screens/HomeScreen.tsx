import React, { useMemo } from 'react';
import {
  View,
  ScrollView,
  SectionList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { StandardText } from '../components/StandardText';
import { MobileLeadCard } from '../components/MobileLeadCard';
import { useCommandCenterAnalytics } from '../hooks/useAnalytics';
import { useDailyQueue } from '../hooks/useTasks';
import { brandColors } from '../theme/brandTheme';
import type { Lead } from '@tofa/core';

const today = new Date().toISOString().split('T')[0];

type Section = { title: string; data: Lead[] };

const METRIC_CARDS = [
  { key: 'overdue', icon: '🛑', label: 'Overdue', getValue: (d: Record<string, unknown>) => (d?.overdue as number) ?? 0 },
  { key: 'today', icon: '🟢', label: 'Today', getValue: (d: Record<string, unknown>) => (d?.today_progress_count as number) ?? 0 },
  { key: 'unscheduled', icon: '📅', label: 'Unscheduled', getValue: (d: Record<string, unknown>) => (d?.unscheduled as number) ?? 0 },
  { key: 'hot_trials', icon: '🔥', label: 'Hot Trials', getValue: (d: Record<string, unknown>) => (d?.hot_trials_count as number) ?? 0 },
  { key: 'reschedule', icon: '🔄', label: 'Reschedule', getValue: (d: Record<string, unknown>) => (d?.reschedule_count as number) ?? 0 },
];

export function HomeScreen() {
  const { data: analyticsData, refetch: refetchAnalytics, isRefetching: isRefetchingAnalytics } = useCommandCenterAnalytics(today);
  const { data: taskQueue, refetch: refetchQueue, isRefetching: isRefetchingQueue } = useDailyQueue(today);

  const isRefetching = isRefetchingAnalytics || isRefetchingQueue;
  const onRefresh = () => {
    refetchAnalytics();
    refetchQueue();
  };

  const sections: Section[] = useMemo(() => {
    if (!taskQueue) return [];
    const overdue = (taskQueue.overdue || []).filter((l: Lead) => l.status !== 'Nurture' && l.status !== 'Dead/Not Interested');
    const dueToday = taskQueue.due_today || [];
    const upcoming = (taskQueue.upcoming || []).slice(0, 50);
    return [
      { title: '🛑 OVERDUE', data: overdue },
      { title: '🟢 TODAY', data: dueToday },
      { title: '📅 UPCOMING', data: upcoming },
    ].filter((s) => s.data.length > 0);
  }, [taskQueue]);

  const metrics = analyticsData as Record<string, unknown> | undefined;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.metricsScroll}
        style={styles.metricsScrollWrap}
      >
        {METRIC_CARDS.map((card) => (
          <View key={card.key} style={styles.metricCard}>
            <StandardText style={styles.metricIcon}>{card.icon}</StandardText>
            <StandardText style={styles.metricValue}>{metrics ? card.getValue(metrics) : '–'}</StandardText>
            <StandardText style={styles.metricLabel}>{card.label}</StandardText>
          </View>
        ))}
      </ScrollView>

      <StandardText variant="heading" style={styles.sectionTitle}>
        Action Queue
      </StandardText>

      {!taskQueue && !isRefetching ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={brandColors.accent} />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.centered}>
          <StandardText variant="muted">No tasks for today.</StandardText>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <MobileLeadCard lead={item} />}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <StandardText variant="accent" style={styles.sectionHeaderText}>
                {section.title}
              </StandardText>
            </View>
          )}
          stickySectionHeadersEnabled
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={brandColors.accent} />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.surface },
  metricsScrollWrap: { maxHeight: 100 },
  metricsScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
  },
  metricCard: {
    width: 88,
    marginRight: 12,
    backgroundColor: brandColors.primary,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: brandColors.accent,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricIcon: { fontSize: 20, marginBottom: 4 },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: brandColors.accent,
  },
  metricLabel: {
    fontSize: 10,
    color: brandColors.textOnPrimary,
    marginTop: 2,
  },
  sectionTitle: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionHeader: {
    backgroundColor: brandColors.surface,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(10, 25, 47, 0.1)',
  },
  sectionHeaderText: { fontSize: 14 },
  listContent: { paddingBottom: 24 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});
