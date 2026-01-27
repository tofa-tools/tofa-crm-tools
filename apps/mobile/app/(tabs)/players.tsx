import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Modal, ScrollView, Alert } from 'react-native';
import { useStudents } from '@/hooks/useStudents';
import { studentsAPI, skillsAPI } from '@/lib/api';
import { TOFA_THEME } from '@/constants/theme';
import { Search, Trophy, Star } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Student {
  id: number;
  lead_id: number;
  lead_player_name: string;
  lead_player_age_category?: string;
  student_batch_ids: number[];
  in_grace_period?: boolean;
}

interface MilestoneData {
  total_sessions: number;
  next_milestone?: number;
  milestone_message?: string;
}

export default function PlayersScreen() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showSkillReport, setShowSkillReport] = useState(false);
  const [skillScores, setSkillScores] = useState({
    technical_score: 5,
    fitness_score: 5,
    teamwork_score: 5,
    discipline_score: 5,
    coach_notes: '',
  });
  const queryClient = useQueryClient();

  const { data: studentsData, isLoading } = useStudents({ is_active: true });
  const students = studentsData || [];

  // Fetch milestones for students (we'll fetch on demand)
  const [milestoneData, setMilestoneData] = useState<Record<number, MilestoneData>>({});
  
  useEffect(() => {
    const fetchMilestones = async () => {
      const milestoneMap: Record<number, MilestoneData> = {};
      const promises = filteredStudents.map(async (student: Student) => {
        try {
          const data = await studentsAPI.getMilestones(student.id);
          milestoneMap[student.id] = data;
        } catch (error) {
          console.error(`Error fetching milestones for student ${student.id}:`, error);
        }
      });
      await Promise.all(promises);
      setMilestoneData(milestoneMap);
    };
    
    if (filteredStudents.length > 0) {
      fetchMilestones();
    }
  }, [filteredStudents]);

  // Filter students by search
  const filteredStudents = useMemo(() => {
    if (!searchTerm) return students;
    const searchLower = searchTerm.toLowerCase();
    return students.filter((s: Student) =>
      (s.lead_player_name || '').toLowerCase().includes(searchLower)
    );
  }, [students, searchTerm]);

  // Skill report mutation
  const submitSkillReportMutation = useMutation({
    mutationFn: (data: {
      leadId: number;
      technical_score: number;
      fitness_score: number;
      teamwork_score: number;
      discipline_score: number;
      coach_notes?: string;
    }) => skillsAPI.createEvaluation(data.leadId, {
      technical_score: data.technical_score,
      fitness_score: data.fitness_score,
      teamwork_score: data.teamwork_score,
      discipline_score: data.discipline_score,
      coach_notes: data.coach_notes,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      Alert.alert('Success', 'Skill report submitted successfully!', [
        { text: 'OK', onPress: () => {
          setShowSkillReport(false);
          setSelectedStudent(null);
          setSkillScores({
            technical_score: 5,
            fitness_score: 5,
            teamwork_score: 5,
            discipline_score: 5,
            coach_notes: '',
          });
        }},
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.response?.data?.detail || 'Failed to submit skill report');
    },
  });

  const handleStudentPress = (student: Student) => {
    setSelectedStudent(student);
    setShowSkillReport(true);
  };

  const handleSubmitSkillReport = () => {
    if (!selectedStudent) return;
    
    submitSkillReportMutation.mutate({
      leadId: selectedStudent.lead_id,
      ...skillScores,
    });
  };

  const getMilestoneBadge = (student: Student) => {
    const milestone = milestoneData[student.id];
    if (!milestone) return null;
    
    const totalSessions = milestone.total_sessions || 0;
    
    // Check if today is a milestone session
    if (totalSessions === 10 || totalSessions === 25 || totalSessions === 50) {
      return (
        <View style={styles.milestoneBadge}>
          <Trophy size={16} color={TOFA_THEME.colors.gold} />
          <Text style={styles.milestoneText}>{totalSessions}th Session!</Text>
        </View>
      );
    }
    
    return null;
  };

  const renderStudent = ({ item }: { item: Student }) => {
    const milestoneBadge = getMilestoneBadge(item);
    
    return (
      <TouchableOpacity
        style={styles.studentCard}
        onPress={() => handleStudentPress(item)}
      >
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{item.lead_player_name}</Text>
          {item.lead_player_age_category && (
            <Text style={styles.studentAge}>{item.lead_player_age_category}</Text>
          )}
          {milestoneBadge}
        </View>
        <View style={styles.arrowContainer}>
          <Text style={styles.arrow}>→</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderStarRating = (
    label: string,
    value: number,
    onChange: (value: number) => void
  ) => {
    return (
      <View style={styles.ratingContainer}>
        <Text style={styles.ratingLabel}>{label}</Text>
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => onChange(star)}
              style={styles.starButton}
            >
              <Star
                size={32}
                color={star <= value ? TOFA_THEME.colors.gold : TOFA_THEME.colors.border}
                fill={star <= value ? TOFA_THEME.colors.gold : 'transparent'}
              />
            </TouchableOpacity>
          ))}
          <Text style={styles.ratingValue}>{value}/5</Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={TOFA_THEME.colors.gold} />
          <Text style={styles.loadingText}>Loading players...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sticky Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={20} color={TOFA_THEME.colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search players..."
          placeholderTextColor={TOFA_THEME.colors.placeholder}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      {/* Players List */}
      <FlatList
        data={filteredStudents}
        renderItem={renderStudent}
        keyExtractor={(item) => `student-${item.id}`}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No players found</Text>
          </View>
        }
      />

      {/* Skill Report Modal */}
      <Modal
        visible={showSkillReport}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSkillReport(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Skill Report</Text>
            <Text style={styles.modalSubtitle}>{selectedStudent?.lead_player_name}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowSkillReport(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {renderStarRating(
              'Technical',
              skillScores.technical_score,
              (value) => setSkillScores(prev => ({ ...prev, technical_score: value }))
            )}
            {renderStarRating(
              'Fitness',
              skillScores.fitness_score,
              (value) => setSkillScores(prev => ({ ...prev, fitness_score: value }))
            )}
            {renderStarRating(
              'Teamwork',
              skillScores.teamwork_score,
              (value) => setSkillScores(prev => ({ ...prev, teamwork_score: value }))
            )}
            {renderStarRating(
              'Discipline',
              skillScores.discipline_score,
              (value) => setSkillScores(prev => ({ ...prev, discipline_score: value }))
            )}

            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>Coach Notes (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Add any additional notes..."
                placeholderTextColor={TOFA_THEME.colors.placeholder}
                value={skillScores.coach_notes}
                onChangeText={(text) => setSkillScores(prev => ({ ...prev, coach_notes: text }))}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, submitSkillReportMutation.isPending && styles.submitButtonDisabled]}
              onPress={handleSubmitSkillReport}
              disabled={submitSkillReportMutation.isPending}
            >
              {submitSkillReportMutation.isPending ? (
                <ActivityIndicator color={TOFA_THEME.colors.navy} />
              ) : (
                <Text style={styles.submitButtonText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
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
  listContent: {
    padding: TOFA_THEME.spacing.md,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: TOFA_THEME.colors.background,
    borderRadius: TOFA_THEME.borderRadius.md,
    padding: TOFA_THEME.spacing.md,
    marginBottom: TOFA_THEME.spacing.sm,
    ...TOFA_THEME.shadows.sm,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: TOFA_THEME.typography.fontSize.md,
    fontWeight: '600',
    color: TOFA_THEME.colors.text,
    marginBottom: TOFA_THEME.spacing.xs,
  },
  studentAge: {
    fontSize: TOFA_THEME.typography.fontSize.sm,
    color: TOFA_THEME.colors.textSecondary,
  },
  milestoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: TOFA_THEME.spacing.xs,
    marginTop: TOFA_THEME.spacing.xs,
    paddingHorizontal: TOFA_THEME.spacing.sm,
    paddingVertical: TOFA_THEME.spacing.xs,
    backgroundColor: '#fef3c7',
    borderRadius: TOFA_THEME.borderRadius.sm,
    alignSelf: 'flex-start',
  },
  milestoneText: {
    fontSize: TOFA_THEME.typography.fontSize.xs,
    fontWeight: 'bold',
    color: TOFA_THEME.colors.gold,
  },
  arrowContainer: {
    padding: TOFA_THEME.spacing.sm,
  },
  arrow: {
    fontSize: TOFA_THEME.typography.fontSize.lg,
    color: TOFA_THEME.colors.textSecondary,
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
  modalContainer: {
    flex: 1,
    backgroundColor: TOFA_THEME.colors.background,
  },
  modalHeader: {
    backgroundColor: TOFA_THEME.colors.navy,
    padding: TOFA_THEME.spacing.lg,
    paddingTop: TOFA_THEME.spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: TOFA_THEME.typography.fontSize.xl,
    fontWeight: 'bold',
    color: TOFA_THEME.colors.gold,
  },
  modalSubtitle: {
    fontSize: TOFA_THEME.typography.fontSize.sm,
    color: TOFA_THEME.colors.textSecondary,
    marginTop: TOFA_THEME.spacing.xs,
  },
  closeButton: {
    padding: TOFA_THEME.spacing.sm,
  },
  closeButtonText: {
    fontSize: TOFA_THEME.typography.fontSize.xl,
    color: TOFA_THEME.colors.gold,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: TOFA_THEME.spacing.lg,
  },
  ratingContainer: {
    marginBottom: TOFA_THEME.spacing.xl,
  },
  ratingLabel: {
    fontSize: TOFA_THEME.typography.fontSize.md,
    fontWeight: '600',
    color: TOFA_THEME.colors.text,
    marginBottom: TOFA_THEME.spacing.md,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: TOFA_THEME.spacing.sm,
  },
  starButton: {
    padding: TOFA_THEME.spacing.xs,
  },
  ratingValue: {
    marginLeft: TOFA_THEME.spacing.md,
    fontSize: TOFA_THEME.typography.fontSize.md,
    fontWeight: 'bold',
    color: TOFA_THEME.colors.text,
  },
  notesContainer: {
    marginBottom: TOFA_THEME.spacing.xl,
  },
  notesLabel: {
    fontSize: TOFA_THEME.typography.fontSize.md,
    fontWeight: '600',
    color: TOFA_THEME.colors.text,
    marginBottom: TOFA_THEME.spacing.sm,
  },
  notesInput: {
    backgroundColor: TOFA_THEME.colors.surface,
    borderRadius: TOFA_THEME.borderRadius.md,
    padding: TOFA_THEME.spacing.md,
    fontSize: TOFA_THEME.typography.fontSize.md,
    color: TOFA_THEME.colors.text,
    minHeight: 100,
    borderWidth: 1,
    borderColor: TOFA_THEME.colors.border,
  },
  submitButton: {
    backgroundColor: TOFA_THEME.colors.gold,
    borderRadius: TOFA_THEME.borderRadius.md,
    padding: TOFA_THEME.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: TOFA_THEME.spacing.lg,
    marginBottom: TOFA_THEME.spacing.xl,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: TOFA_THEME.colors.navy,
    fontSize: TOFA_THEME.typography.fontSize.md,
    fontWeight: 'bold',
  },
});

