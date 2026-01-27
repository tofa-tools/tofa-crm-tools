import { useQuery } from '@tanstack/react-query';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { batchesAPI, tokenStorage } from '@/lib/api';
import { TOFA_THEME } from '@/constants/theme';
import { getBatchesForDate, type Batch } from '@tofa/core';
import { Calendar, Clock, Users, LogOut, Plus } from 'lucide-react-native';
import { format } from 'date-fns';
import { Alert } from 'react-native';
import { useState } from 'react';
import { QuickAddLeadModal } from '../components/QuickAddLeadModal';

export default function CoachDashboardScreen() {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Fetch coach's batches
  const { data: coachBatchesData, isLoading } = useQuery({
    queryKey: ['coachBatches'],
    queryFn: () => batchesAPI.getCoachBatches(),
  });

  const coachBatches = coachBatchesData?.batches || [];
  
  // Get batches scheduled for today
  const todayBatches = getBatchesForDate(coachBatches, today);
  
  // Get default center from first batch if available
  const defaultCenterId = todayBatches.length > 0 ? todayBatches[0].center_id : undefined;

  const handleTakeAttendance = (batchId: number) => {
    router.push(`/(tabs)/attendance?batchId=${batchId}`);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await tokenStorage.clear();
            router.replace('/login');
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={TOFA_THEME.colors.gold} />
          <Text style={styles.loadingText}>Loading sessions...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Logout */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Today's Sessions</Text>
          <Text style={styles.headerSubtitle}>{format(today, 'EEEE, MMMM d, yyyy')}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <LogOut size={20} color={TOFA_THEME.colors.gold} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {todayBatches.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Calendar size={48} color={TOFA_THEME.colors.textSecondary} />
            <Text style={styles.emptyText}>No sessions scheduled for today</Text>
          </View>
        ) : (
          <View style={styles.sessionsList}>
            {todayBatches.map((batch: Batch) => (
              <View key={batch.id} style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.batchName}>{batch.name}</Text>
                    <View style={styles.sessionMeta}>
                      <View style={styles.metaItem}>
                        <Clock size={16} color={TOFA_THEME.colors.textSecondary} />
                        <Text style={styles.metaText}>
                          {batch.start_time ? batch.start_time.slice(0, 5) : 'TBD'}
                        </Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Users size={16} color={TOFA_THEME.colors.textSecondary} />
                        <Text style={styles.metaText}>{batch.age_category}</Text>
                      </View>
                    </View>
                  </View>
                </View>
                
                <TouchableOpacity
                  style={styles.attendanceButton}
                  onPress={() => handleTakeAttendance(batch.id)}
                >
                  <Text style={styles.attendanceButtonText}>Take Attendance</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      
      {/* Floating Action Button for Quick Add */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowQuickAdd(true)}
      >
        <Plus size={24} color={TOFA_THEME.colors.navy} />
      </TouchableOpacity>
      
      {/* Quick Add Modal */}
      <QuickAddLeadModal
        visible={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        defaultCenterId={defaultCenterId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOFA_THEME.colors.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: TOFA_THEME.spacing.xl,
  },
  loadingText: {
    marginTop: TOFA_THEME.spacing.md,
    fontSize: TOFA_THEME.typography.fontSize.md,
    color: TOFA_THEME.colors.textSecondary,
  },
  header: {
    backgroundColor: TOFA_THEME.colors.navy,
    padding: TOFA_THEME.spacing.lg,
    paddingTop: TOFA_THEME.spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: TOFA_THEME.typography.fontSize.xxl,
    fontWeight: 'bold',
    color: TOFA_THEME.colors.gold,
  },
  headerSubtitle: {
    fontSize: TOFA_THEME.typography.fontSize.md,
    color: TOFA_THEME.colors.textSecondary,
    marginTop: TOFA_THEME.spacing.xs,
  },
  logoutButton: {
    padding: TOFA_THEME.spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: TOFA_THEME.spacing.xxl,
    minHeight: 400,
  },
  emptyText: {
    marginTop: TOFA_THEME.spacing.md,
    fontSize: TOFA_THEME.typography.fontSize.md,
    color: TOFA_THEME.colors.textSecondary,
    textAlign: 'center',
  },
  sessionsList: {
    padding: TOFA_THEME.spacing.md,
  },
  sessionCard: {
    backgroundColor: TOFA_THEME.colors.background,
    borderRadius: TOFA_THEME.borderRadius.lg,
    padding: TOFA_THEME.spacing.md,
    marginBottom: TOFA_THEME.spacing.md,
    ...TOFA_THEME.shadows.md,
  },
  sessionHeader: {
    marginBottom: TOFA_THEME.spacing.md,
  },
  sessionInfo: {
    flex: 1,
  },
  batchName: {
    fontSize: TOFA_THEME.typography.fontSize.lg,
    fontWeight: 'bold',
    color: TOFA_THEME.colors.text,
    marginBottom: TOFA_THEME.spacing.sm,
  },
  sessionMeta: {
    flexDirection: 'row',
    gap: TOFA_THEME.spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: TOFA_THEME.spacing.xs,
  },
  metaText: {
    fontSize: TOFA_THEME.typography.fontSize.sm,
    color: TOFA_THEME.colors.textSecondary,
  },
  attendanceButton: {
    backgroundColor: TOFA_THEME.colors.gold,
    borderRadius: TOFA_THEME.borderRadius.md,
    padding: TOFA_THEME.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: TOFA_THEME.spacing.sm,
  },
  attendanceButtonText: {
    color: TOFA_THEME.colors.navy,
    fontSize: TOFA_THEME.typography.fontSize.md,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    right: TOFA_THEME.spacing.lg,
    bottom: TOFA_THEME.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: TOFA_THEME.colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    ...TOFA_THEME.shadows.lg,
    elevation: 8,
  },
});

