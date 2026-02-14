/**
 * Attendance screen - coach marks Present/Absent for batch participants.
 * Uses AttendanceCreate schema: send lead_id (trial) OR student_id (active student) in JSON body.
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StandardText } from '../components/StandardText';
import { StandardButton } from '../components/StandardButton';
import { batchesAPI, leadsAPI, studentsAPI, attendanceAPI } from '../lib/api';
import { buildAttendancePayload, type ParticipantType } from '@tofa/core';
import { brandColors } from '../theme/brandTheme';

export function AttendanceScreen() {
  const queryClient = useQueryClient();
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, 'Present' | 'Absent'>>({});

  const { data: batchesData, isLoading: batchesLoading } = useQuery({
    queryKey: ['batches', 'my-batches'],
    queryFn: () => batchesAPI.getMyBatches(),
  });

  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads', 'my-leads'],
    queryFn: () => leadsAPI.getMyLeads({ limit: 500 }),
  });

  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentsAPI.getStudents({ is_active: true }),
  });

  const recordAttendanceMutation = useMutation({
    mutationFn: (payload: { lead_id?: number; student_id?: number; batch_id: number; status: string }) =>
      attendanceAPI.checkIn(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'command-center'] });
    },
  });

  const allLeads = leadsData?.leads || [];
  const allStudents = studentsData || [];

  const batchParticipants = useMemo(() => {
    if (!selectedBatchId) return [];
    const trialLeads = allLeads
      .filter(
        (l: Record<string, unknown>) =>
          l.trial_batch_id === selectedBatchId && l.status === 'Trial Scheduled'
      )
      .map((lead: Record<string, unknown>) => ({
        id: lead.id as number,
        name: String(lead.player_name || 'Unknown'),
        type: 'trial' as ParticipantType,
        studentId: null as number | null,
        leadId: lead.id as number,
      }));
    const activeStudents = allStudents
      .filter((s: Record<string, unknown>) => {
        const batchIds = (s.student_batch_ids as number[]) || [];
        return batchIds.includes(selectedBatchId);
      })
      .map((student: Record<string, unknown>) => ({
        id: student.id as number,
        name: String(student.lead_player_name || 'Unknown'),
        type: 'student' as ParticipantType,
        studentId: student.id as number,
        leadId: student.lead_id as number,
      }));
    return [...trialLeads, ...activeStudents];
  }, [allLeads, allStudents, selectedBatchId]);

  const handleMarkAttendance = async (
    participantType: ParticipantType,
    studentId: number | null,
    leadId: number,
    status: 'Present' | 'Absent'
  ) => {
    if (!selectedBatchId) return;
    const payload = buildAttendancePayload(participantType, studentId, leadId, selectedBatchId, status);
    try {
      await recordAttendanceMutation.mutateAsync(payload);
      setStatusMap((prev) => ({ ...prev, [String(leadId)]: status }));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      Alert.alert('Error', msg || 'Failed to record attendance');
    }
  };

  const batches = batchesData?.batches || [];
  const isLoading = batchesLoading || leadsLoading || studentsLoading;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={brandColors.accent} />
      </View>
    );
  }

  if (batches.length === 0) {
    return (
      <View style={styles.container}>
        <StandardText variant="heading">Attendance</StandardText>
        <StandardText variant="muted">No batches assigned. Contact your team lead.</StandardText>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StandardText variant="heading" style={styles.title}>
        Attendance
      </StandardText>
      <StandardText variant="muted" style={styles.subtitle}>
        Select a batch and mark attendance
      </StandardText>

      <View style={styles.batchList}>
        {batches.map((batch: Record<string, unknown>) => {
          const id = batch.id as number;
          const isSelected = selectedBatchId === id;
          return (
            <TouchableOpacity
              key={id}
              style={[styles.batchChip, isSelected && styles.batchChipSelected]}
              onPress={() => setSelectedBatchId(id)}
            >
              <StandardText style={isSelected ? styles.batchChipTextSelected : undefined}>
                {String(batch.name || 'Batch')}
              </StandardText>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedBatchId && batchParticipants.length === 0 && (
        <StandardText variant="muted">No participants in this batch for today.</StandardText>
      )}

      {selectedBatchId &&
        batchParticipants.map((p) => {
          const currentStatus = statusMap[String(p.leadId)];
          return (
            <View key={p.leadId} style={styles.participantRow}>
              <StandardText style={styles.participantName}>{p.name}</StandardText>
              <View style={styles.buttonRow}>
                <StandardButton
                  title="Present"
                  onPress={() =>
                    handleMarkAttendance(p.type, p.studentId, p.leadId, 'Present')
                  }
                  variant={currentStatus === 'Present' ? 'accent' : 'outline'}
                  style={styles.markBtn}
                />
                <StandardButton
                  title="Absent"
                  onPress={() =>
                    handleMarkAttendance(p.type, p.studentId, p.leadId, 'Absent')
                  }
                  variant={currentStatus === 'Absent' ? 'accent' : 'outline'}
                  style={styles.markBtn}
                />
              </View>
            </View>
          );
        })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.surface },
  content: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { marginBottom: 8 },
  subtitle: { marginBottom: 24 },
  batchList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  batchChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(10, 25, 47, 0.08)',
    borderWidth: 2,
    borderColor: 'rgba(10, 25, 47, 0.2)',
  },
  batchChipSelected: { backgroundColor: brandColors.accent, borderColor: brandColors.accent },
  batchChipTextSelected: { color: brandColors.primary },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(10, 25, 47, 0.1)',
  },
  participantName: { flex: 1 },
  buttonRow: { flexDirection: 'row', gap: 8 },
  markBtn: { minWidth: 80 },
});
