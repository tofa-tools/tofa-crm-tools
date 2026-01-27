import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { X } from 'lucide-react-native';
import { TOFA_THEME } from '@/constants/theme';
import { stagingAPI } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { batchesAPI, centersAPI } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

interface QuickAddLeadModalProps {
  visible: boolean;
  onClose: () => void;
  defaultCenterId?: number;
}

export function QuickAddLeadModal({ visible, onClose, defaultCenterId }: QuickAddLeadModalProps) {
  const queryClient = useQueryClient();
  const { data: coachBatches } = useQuery({
    queryKey: ['coachBatches'],
    queryFn: () => batchesAPI.getCoachBatches(),
  });
  
  // Get all centers to map center_id to center object
  const { data: centersData } = useQuery({
    queryKey: ['centers'],
    queryFn: () => centersAPI.getCenters(),
  });
  
  const [playerName, setPlayerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedCenterId, setSelectedCenterId] = useState<number | undefined>(defaultCenterId);
  
  // Get unique center IDs from coach's batches
  const batchCenterIds = coachBatches?.batches
    ? Array.from(new Set(coachBatches.batches.map(b => b.center_id)))
    : [];
  
  // Map center IDs to center objects
  const availableCenters = centersData?.centers
    ? centersData.centers.filter(c => batchCenterIds.includes(c.id))
    : [];
  
  // Set default center if available
  useEffect(() => {
    if (!selectedCenterId) {
      if (defaultCenterId && availableCenters.some(c => c.id === defaultCenterId)) {
        setSelectedCenterId(defaultCenterId);
      } else if (availableCenters.length === 1) {
        setSelectedCenterId(availableCenters[0].id);
      }
    }
  }, [defaultCenterId, availableCenters, selectedCenterId]);
  
  const createStagingMutation = useMutation({
    mutationFn: (data: { player_name: string; phone: string; email?: string; center_id: number }) =>
      stagingAPI.createStagingLead(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stagingLeads'] });
      Alert.alert(
        'Success!',
        'Lead captured! Team Member notified.',
        [{ text: 'OK', onPress: handleClose }]
      );
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to capture lead';
      if (errorMessage.includes('already exists')) {
        Alert.alert(
          'Duplicate Lead',
          'This player is already in our system!',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', errorMessage);
      }
    },
  });
  
  const handleClose = () => {
    setPlayerName('');
    setPhone('');
    setEmail('');
    setSelectedCenterId(defaultCenterId || (availableCenters.length === 1 ? availableCenters[0].id : undefined));
    onClose();
  };
  
  const handleSubmit = () => {
    if (!playerName.trim()) {
      Alert.alert('Validation Error', 'Player name is required');
      return;
    }
    
    if (!phone.trim()) {
      Alert.alert('Validation Error', 'Phone number is required');
      return;
    }
    
    if (!selectedCenterId) {
      Alert.alert('Validation Error', 'Please select a center');
      return;
    }
    
    createStagingMutation.mutate({
      player_name: playerName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      center_id: selectedCenterId,
    });
  };
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Quick Add Lead</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={TOFA_THEME.colors.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Player Name *</Text>
              <TextInput
                style={styles.input}
                value={playerName}
                onChangeText={setPlayerName}
                placeholder="Enter player name"
                placeholderTextColor={TOFA_THEME.colors.placeholder}
                autoCapitalize="words"
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Phone *</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter phone number"
                placeholderTextColor={TOFA_THEME.colors.placeholder}
                keyboardType="phone-pad"
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter email (optional)"
                placeholderTextColor={TOFA_THEME.colors.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            
            {availableCenters.length > 1 && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Center *</Text>
                <ScrollView style={styles.centerSelector}>
                  {availableCenters.map((center) => (
                    <TouchableOpacity
                      key={center.id}
                      style={[
                        styles.centerOption,
                        selectedCenterId === center.id && styles.centerOptionSelected,
                      ]}
                      onPress={() => setSelectedCenterId(center.id)}
                    >
                      <Text
                        style={[
                          styles.centerOptionText,
                          selectedCenterId === center.id && styles.centerOptionTextSelected,
                        ]}
                      >
                        {center.display_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            
            {availableCenters.length === 1 && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Center</Text>
                <Text style={styles.centerDisplay}>{availableCenters[0].display_name}</Text>
              </View>
            )}
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={createStagingMutation.isPending}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.submitButton, createStagingMutation.isPending && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={createStagingMutation.isPending}
            >
              {createStagingMutation.isPending ? (
                <ActivityIndicator color={TOFA_THEME.colors.navy} />
              ) : (
                <Text style={styles.submitButtonText}>Capture Lead</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: TOFA_THEME.colors.background,
    borderTopLeftRadius: TOFA_THEME.borderRadius.xl,
    borderTopRightRadius: TOFA_THEME.borderRadius.xl,
    maxHeight: '90%',
    paddingBottom: TOFA_THEME.spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: TOFA_THEME.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: TOFA_THEME.colors.border,
  },
  modalTitle: {
    fontSize: TOFA_THEME.typography.fontSize.xl,
    fontWeight: 'bold',
    color: TOFA_THEME.colors.text,
  },
  closeButton: {
    padding: TOFA_THEME.spacing.xs,
  },
  modalBody: {
    padding: TOFA_THEME.spacing.lg,
    maxHeight: 400,
  },
  formGroup: {
    marginBottom: TOFA_THEME.spacing.md,
  },
  label: {
    fontSize: TOFA_THEME.typography.fontSize.sm,
    fontWeight: '600',
    color: TOFA_THEME.colors.text,
    marginBottom: TOFA_THEME.spacing.xs,
  },
  input: {
    backgroundColor: TOFA_THEME.colors.surface,
    borderWidth: 1,
    borderColor: TOFA_THEME.colors.border,
    borderRadius: TOFA_THEME.borderRadius.md,
    padding: TOFA_THEME.spacing.md,
    fontSize: TOFA_THEME.typography.fontSize.md,
    color: TOFA_THEME.colors.text,
  },
  centerSelector: {
    maxHeight: 150,
  },
  centerOption: {
    padding: TOFA_THEME.spacing.md,
    backgroundColor: TOFA_THEME.colors.surface,
    borderRadius: TOFA_THEME.borderRadius.md,
    marginBottom: TOFA_THEME.spacing.xs,
    borderWidth: 1,
    borderColor: TOFA_THEME.colors.border,
  },
  centerOptionSelected: {
    backgroundColor: TOFA_THEME.colors.gold,
    borderColor: TOFA_THEME.colors.gold,
  },
  centerOptionText: {
    fontSize: TOFA_THEME.typography.fontSize.md,
    color: TOFA_THEME.colors.text,
  },
  centerOptionTextSelected: {
    color: TOFA_THEME.colors.navy,
    fontWeight: 'bold',
  },
  centerDisplay: {
    fontSize: TOFA_THEME.typography.fontSize.md,
    color: TOFA_THEME.colors.textSecondary,
    padding: TOFA_THEME.spacing.md,
    backgroundColor: TOFA_THEME.colors.surface,
    borderRadius: TOFA_THEME.borderRadius.md,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: TOFA_THEME.spacing.md,
    padding: TOFA_THEME.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: TOFA_THEME.colors.border,
  },
  button: {
    flex: 1,
    padding: TOFA_THEME.spacing.md,
    borderRadius: TOFA_THEME.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: TOFA_THEME.colors.surface,
    borderWidth: 1,
    borderColor: TOFA_THEME.colors.border,
  },
  cancelButtonText: {
    fontSize: TOFA_THEME.typography.fontSize.md,
    fontWeight: '600',
    color: TOFA_THEME.colors.text,
  },
  submitButton: {
    backgroundColor: TOFA_THEME.colors.gold,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: TOFA_THEME.typography.fontSize.md,
    fontWeight: 'bold',
    color: TOFA_THEME.colors.navy,
  },
});

