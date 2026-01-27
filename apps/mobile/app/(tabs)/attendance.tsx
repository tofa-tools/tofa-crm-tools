import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useLeads } from '@/hooks/useLeads';
import { useStudents } from '@/hooks/useStudents';
import { attendanceAPI } from '@/lib/api';
import { TOFA_THEME } from '@/constants/theme';
import { 
  determineParticipantType,
  buildAttendancePayload,
  getAttendanceStatusIndicator,
  calculateAttendanceSummary,
  isAllAttendanceMarked,
  type AttendanceRecord,
  type Participant,
} from '@tofa/core';
import { Search, CheckCircle2, XCircle, Phone } from 'lucide-react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Linking } from 'react-native';
import { EMERGENCY_SUPPORT_CONFIG } from '@/lib/config/crm';
import { LinearGradient } from 'expo-linear-gradient';

interface ParticipantCard {
  id: number;
  name: string;
  type: 'trial' | 'student';
  studentId: number | null;
  leadId: number;
  ageCategory?: string;
  inGracePeriod?: boolean;
}

export default function AttendanceScreen() {
  const { batchId } = useLocalSearchParams<{ batchId?: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState<Record<number, 'Present' | 'Absent' | null>>({});
  const [attendanceHistoryData, setAttendanceHistoryData] = useState<Record<number, AttendanceRecord[]>>({});
  const queryClient = useQueryClient();

  const selectedBatchId = batchId ? parseInt(batchId, 10) : null;

  // Fetch all leads and students
  const { data: leadsResponse, isLoading: leadsLoading } = useLeads({ limit: 1000 });
  const { data: studentsData, isLoading: studentsLoading } = useStudents({ is_active: true });

  const allLeads = leadsResponse?.leads || [];
  const allStudents = studentsData || [];

  // Build participants list
  const batchParticipants = useMemo<ParticipantCard[]>(() => {
    if (!selectedBatchId) return [];
    
    // Get trial leads
    const trialLeads = allLeads
      .filter(lead => lead.trial_batch_id === selectedBatchId && lead.status === 'Trial Scheduled')
      .map(lead => ({
        id: lead.id,
        name: lead.player_name,
        type: 'trial' as const,
        studentId: null,
        leadId: lead.id,
        ageCategory: lead.player_age_category,
      }));
    
    // Get active students
    const activeStudents = allStudents
      .filter((student: any) => {
        const batchIds = student.student_batch_ids || [];
        return batchIds.includes(selectedBatchId);
      })
      .map((student: any) => ({
        id: student.lead_id,
        name: student.lead_player_name || 'Unknown',
        type: 'student' as const,
        studentId: student.id,
        leadId: student.lead_id,
        ageCategory: student.lead_player_age_category || '',
        inGracePeriod: student.in_grace_period || false,
      }));
    
    return [...trialLeads, ...activeStudents];
  }, [allLeads, allStudents, selectedBatchId]);

  // Filter by search
  const filteredParticipants = useMemo(() => {
    if (!searchTerm) return batchParticipants;
    const searchLower = searchTerm.toLowerCase();
    return batchParticipants.filter(p => p.name.toLowerCase().includes(searchLower));
  }, [batchParticipants, searchTerm]);

  // Fetch attendance history
  useEffect(() => {
    const fetchHistory = async () => {
      const historyMap: Record<number, AttendanceRecord[]> = {};
      const promises = filteredParticipants.map(async (participant) => {
        try {
          const data = await attendanceAPI.getHistory(participant.leadId);
          historyMap[participant.leadId] = data.attendance.map((a: any) => ({
            date: a.date,
            status: a.status,
          }));
        } catch (error) {
          console.error(`Error fetching history for lead ${participant.leadId}:`, error);
        }
      });
      await Promise.all(promises);
      setAttendanceHistoryData(historyMap);
    };
    
    if (filteredParticipants.length > 0) {
      fetchHistory();
    }
  }, [filteredParticipants]);

  // Attendance mutation
  const recordAttendanceMutation = useMutation({
    mutationFn: (data: any) => attendanceAPI.checkIn(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });

  const handleAttendanceClick = async (
    participant: ParticipantCard,
    status: 'Present' | 'Absent'
  ) => {
    if (!selectedBatchId) {
      Alert.alert('Error', 'Please select a batch first');
      return;
    }

    // Update local state immediately
    setAttendanceStatus(prev => ({ ...prev, [participant.id]: status }));

    try {
      const payload = buildAttendancePayload(
        participant.type,
        participant.studentId,
        participant.leadId,
        selectedBatchId,
        status
      );
      await recordAttendanceMutation.mutateAsync(payload);
    } catch (error: any) {
      // Revert on error
      setAttendanceStatus(prev => ({ ...prev, [participant.id]: null }));
      Alert.alert('Error', error?.response?.data?.detail || 'Failed to record attendance');
    }
  };

  const handleEmergencySOS = () => {
    const supportPhone = EMERGENCY_SUPPORT_CONFIG.DEFAULT_SUPPORT_PHONE;
    const cleanPhone = supportPhone.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`);
  };

  // Get initials for avatar
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get gradient colors based on name
  const getGradientColors = (name: string): [string, string] => {
    const gradients: [string, string][] = [
      ['#6366f1', '#8b5cf6'],
      ['#10b981', '#14b8a6'],
      ['#3b82f6', '#06b6d4'],
      ['#ec4899', '#f43f5e'],
      ['#f59e0b', '#fbbf24'],
      ['#8b5cf6', '#a855f7'],
      ['#059669', '#10b981'],
      ['#ef4444', '#f472b6'],
    ];
    const index = name.charCodeAt(0) % gradients.length;
    return gradients[index];
  };

  const attendanceSummary = useMemo(() => {
    return calculateAttendanceSummary(filteredParticipants, attendanceStatus);
  }, [filteredParticipants, attendanceStatus]);

  if (!selectedBatchId) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Please select a batch from Sessions</Text>
        </View>
      </View>
    );
  }

  if (leadsLoading || studentsLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={TOFA_THEME.colors.gold} />
          <Text style={styles.loadingText}>Loading participants...</Text>
        </View>
      </View>
    );
  }

  const renderParticipant = ({ item }: { item: ParticipantCard }) => {
    const status = attendanceStatus[item.id] || null;
    const history = attendanceHistoryData[item.leadId] || [];
    const indicator = getAttendanceStatusIndicator(history);

    const [color1, color2] = getGradientColors(item.name);
    const initials = getInitials(item.name);

    return (
      <View style={styles.participantCard}>
        {/* Left: Avatar */}
        <LinearGradient
          colors={[color1, color2]}
          style={styles.avatar}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </LinearGradient>

        {/* Center: Name and Status */}
        <View style={styles.participantInfo}>
          <Text style={styles.participantName}>{item.name}</Text>
          {indicator && (
            <View style={styles.statusIndicator}>
              <Text style={[styles.statusText, { color: indicator.color === 'text-emerald-600' ? '#10b981' : '#ef4444' }]}>
                {indicator.icon} {indicator.text}
              </Text>
            </View>
          )}
        </View>

        {/* Right: Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.presentButton, status === 'Present' && styles.activeButton]}
            onPress={() => handleAttendanceClick(item, 'Present')}
          >
            <CheckCircle2 size={24} color={status === 'Present' ? TOFA_THEME.colors.navy : '#10b981'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.absentButton, status === 'Absent' && styles.activeButton]}
            onPress={() => handleAttendanceClick(item, 'Absent')}
          >
            <XCircle size={24} color={status === 'Absent' ? TOFA_THEME.colors.navy : '#ef4444'} />
          </TouchableOpacity>
        </View>

        {/* Emergency SOS Button */}
        <TouchableOpacity
          style={styles.sosButton}
          onPress={handleEmergencySOS}
        >
          <Text style={styles.sosText}>🆘</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Sticky Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={20} color={TOFA_THEME.colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search participants..."
          placeholderTextColor={TOFA_THEME.colors.placeholder}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>
          {attendanceSummary.marked} / {attendanceSummary.total} marked
        </Text>
        {isAllAttendanceMarked(attendanceSummary) && (
          <Text style={styles.completeText}>✓ Complete</Text>
        )}
      </View>

      {/* Participants List */}
      <FlatList
        data={filteredParticipants}
        renderItem={renderParticipant}
        keyExtractor={(item) => `participant-${item.id}`}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No participants found</Text>
          </View>
        }
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOFA_THEME.colors.background,
    paddingHorizontal: TOFA_THEME.spacing.md,
    paddingVertical: TOFA_THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: TOFA_THEME.colors.border,
    gap: TOFA_THEME.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: TOFA_THEME.typography.fontSize.md,
    color: TOFA_THEME.colors.text,
    paddingVertical: TOFA_THEME.spacing.sm,
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: TOFA_THEME.colors.navy,
    padding: TOFA_THEME.spacing.md,
  },
  summaryText: {
    color: TOFA_THEME.colors.gold,
    fontSize: TOFA_THEME.typography.fontSize.md,
    fontWeight: 'bold',
  },
  completeText: {
    color: '#10b981',
    fontSize: TOFA_THEME.typography.fontSize.sm,
    fontWeight: 'bold',
  },
  listContent: {
    padding: TOFA_THEME.spacing.md,
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOFA_THEME.colors.background,
    borderRadius: TOFA_THEME.borderRadius.md,
    padding: TOFA_THEME.spacing.md,
    marginBottom: TOFA_THEME.spacing.sm,
    ...TOFA_THEME.shadows.sm,
    gap: TOFA_THEME.spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: TOFA_THEME.typography.fontSize.md,
    fontWeight: 'bold',
  },
  participantInfo: {
    flex: 1,
    minWidth: 0,
  },
  participantName: {
    fontSize: TOFA_THEME.typography.fontSize.md,
    fontWeight: '600',
    color: TOFA_THEME.colors.text,
    marginBottom: TOFA_THEME.spacing.xs,
  },
  statusIndicator: {
    marginTop: TOFA_THEME.spacing.xs,
  },
  statusText: {
    fontSize: TOFA_THEME.typography.fontSize.sm,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: TOFA_THEME.spacing.sm,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: TOFA_THEME.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  presentButton: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  absentButton: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  activeButton: {
    backgroundColor: TOFA_THEME.colors.gold,
    borderColor: TOFA_THEME.colors.gold,
  },
  sosButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fee2e2',
    borderWidth: 2,
    borderColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: TOFA_THEME.spacing.xxl,
    minHeight: 400,
  },
  emptyText: {
    fontSize: TOFA_THEME.typography.fontSize.md,
    color: TOFA_THEME.colors.textSecondary,
    textAlign: 'center',
  },
});

