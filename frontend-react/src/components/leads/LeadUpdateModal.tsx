'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, MessageCircle, Upload, Check, CheckCircle, Loader2, RefreshCw, FileText, BarChart3, Trophy, Star } from 'lucide-react';
import type { Lead, LeadStatus, Batch } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { CommentInput } from '@/components/forms/CommentInput';
import { ActivityFeed } from '@/components/leads/ActivityFeed';
import { useAuth } from '@/context/AuthContext';
import { useBatches } from '@/hooks/useBatches';
import { useCenters } from '@/hooks/useCenters';
import { useUpdateLead } from '@/hooks/useLeads';
import { useUpdateStudent, useStudents } from '@/hooks/useStudents';
import { useLeadAttendanceHistory } from '@/hooks/useAttendance';
import { useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/utils';
import { uploadFile, approvalsAPI, leadsAPI, studentsAPI } from '@/lib/api';

interface LeadUpdateModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onJoined?: (leadId: number, playerName: string) => void;
}

const STATUS_OPTIONS: LeadStatus[] = [
  'New',
  'Called',
  'Followed up with message',
  'Trial Scheduled',
  'Trial Attended',
  'Joined',
  'On Break',
  'Nurture',
  'Dead/Not Interested',
];

const SUBSCRIPTION_PLANS = [
  { value: 'Monthly', label: 'Monthly', months: 1 },
  { value: 'Quarterly', label: 'Quarterly', months: 3 },
  { value: '6 Months', label: '6 Months', months: 6 },
  { value: 'Yearly', label: 'Yearly', months: 12 },
];

// Helper function to calculate end date from start date and plan
function calculateSubscriptionEndDate(startDate: string, planMonths: number): string {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + planMonths);
  return end.toISOString().split('T')[0];
}

// Helper function to format batch schedule days
function formatBatchScheduleDays(batch: Batch): string {
  const days = [];
  if (batch.is_mon) days.push('Mon');
  if (batch.is_tue) days.push('Tue');
  if (batch.is_wed) days.push('Wed');
  if (batch.is_thu) days.push('Thu');
  if (batch.is_fri) days.push('Fri');
  if (batch.is_sat) days.push('Sat');
  if (batch.is_sun) days.push('Sun');
  return days.length > 0 ? days.join(', ') : 'No days';
}

// Helper function to format batch time
function formatBatchTime(startTime: string | null | undefined, endTime: string | null | undefined): string {
  if (!startTime || !endTime) return 'Time TBD';
  // start_time and end_time are in HH:MM:SS format
  const start = startTime.substring(0, 5); // Get HH:MM
  const end = endTime.substring(0, 5); // Get HH:MM
  return `${start} - ${end}`;
}

// Attendance Summary Component for Student Profile
interface AttendanceSummaryProps {
  leadId: number;
}

function AttendanceSummary({ leadId }: AttendanceSummaryProps) {
  const { data: attendanceData, isLoading } = useLeadAttendanceHistory(leadId);
  
  // Calculate total sessions attended (Present status)
  const totalAttended = attendanceData?.attendance?.filter(
    (att: any) => att.status === 'Present'
  ).length || 0;
  
  // Get last 5 dates marked 'Present'
  const last5PresentDates = attendanceData?.attendance
    ?.filter((att: any) => att.status === 'Present')
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
    .map((att: any) => att.date) || [];
  
  if (isLoading) {
    return (
      <div className="p-5 bg-white border-2 border-green-200 rounded-2xl">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-24"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-5 bg-white border-2 border-green-200 rounded-2xl">
      <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-4">
        📊 Attendance Summary
      </h3>
      
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
        <p className="text-sm font-semibold text-gray-700 mb-1">Total Sessions Attended:</p>
        <p className="text-2xl font-bold text-green-700">{totalAttended}</p>
      </div>
      
      {last5PresentDates.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-widest">Last 5 Sessions:</p>
          <div className="space-y-1">
            {last5PresentDates.map((dateStr: string, index: number) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-xs">
                <span className="text-gray-700">
                  {formatDate(dateStr)}
                </span>
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded font-semibold">
                  ✓ Present
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 italic">No attendance records yet</p>
      )}
    </div>
  );
}

export function LeadUpdateModal({ lead, isOpen, onClose, onJoined }: LeadUpdateModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const updateLeadMutation = useUpdateLead();
  const updateStudentMutation = useUpdateStudent();
  
  // Fetch student data if this is a joined lead
  const { data: studentsData } = useStudents(
    lead?.status === 'Joined' ? { is_active: true } : undefined
  );
  
  // Find the student record for this lead
  const studentRecord = lead?.status === 'Joined' 
    ? studentsData?.find((s: any) => s.lead_id === lead.id)
    : null;
  const { data: batchesData } = useBatches();
  const { data: centersData } = useCenters();
  
  const allBatches = batchesData || [];
  const allCenters = centersData || [];
  
  // Form state for guided workflow
  const [nextDate, setNextDate] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [trialBatchId, setTrialBatchId] = useState<number | null>(null);
  const [studentBatchIds, setStudentBatchIds] = useState<number[]>([]);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string>('');
  const [subscriptionStartDate, setSubscriptionStartDate] = useState<string>('');
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<string>('');
  const [studentCenterId, setStudentCenterId] = useState<number | null>(null);
  const [showCenterTransferWarning, setShowCenterTransferWarning] = useState<boolean>(false);
  const [lossReason, setLossReason] = useState<string>('');
  const [lossReasonNotes, setLossReasonNotes] = useState<string>('');
  
  // Step 2: Call Confirmation state
  const [callConfirmed, setCallConfirmed] = useState<boolean>(false);
  const [callSummary, setCallSummary] = useState<string>('');
  
  // Step 4: Payment Confirmation state
  const [paymentConfirmed, setPaymentConfirmed] = useState<boolean>(false);
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentProofUrl, setPaymentProofUrl] = useState<string>('');
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string>('');
  
  // Off-Ramps state
  const [showOffRamps, setShowOffRamps] = useState<boolean>(false);
  const [offRampStatus, setOffRampStatus] = useState<'Nurture' | 'Dead/Not Interested' | 'On Break' | null>(null);
  const [offRampNote, setOffRampNote] = useState<string>('');
  const [breakReturnDate, setBreakReturnDate] = useState<string>('');
  const [breakReason, setBreakReason] = useState<string>('');
  
  // Reversal Request state
  const [showReversalForm, setShowReversalForm] = useState<boolean>(false);
  const [reversalReason, setReversalReason] = useState<string>('');
  const [pendingApproval, setPendingApproval] = useState<boolean>(false);
  const [pendingApprovalReason, setPendingApprovalReason] = useState<string>('');
  
  // Milestone state
  const [milestoneData, setMilestoneData] = useState<{
    total_present: number;
    current_milestone: number | null;
    next_milestone: number | null;
    sessions_until_next: number | null;
  } | null>(null);
  const [isLoadingMilestones, setIsLoadingMilestones] = useState<boolean>(false);

  const LOSS_REASON_OPTIONS = [
    'Timing Mismatch',
    'Days Mismatch',
    'Duration too long',
    'Location/Distance',
    'Coaching Quality',
    'Price/Fees',
    'Kid lost interest',
    'Other',
  ];

  // Initialize form when lead changes
  useEffect(() => {
    if (lead) {
      setNextDate(lead.next_followup_date ? new Date(lead.next_followup_date).toISOString().split('T')[0] : '');
      setComment('');
      setTrialBatchId(lead.trial_batch_id || null);
      
      // If this is a student, initialize from student record
      if (lead.status === 'Joined' && studentRecord) {
        setStudentBatchIds(studentRecord.student_batch_ids || []);
        setSubscriptionPlan(studentRecord.subscription_plan || '');
        setSubscriptionStartDate(studentRecord.subscription_start_date || '');
        setSubscriptionEndDate(studentRecord.subscription_end_date || '');
        setPaymentProofUrl(studentRecord.payment_proof_url || '');
        setUploadedImagePreview(studentRecord.payment_proof_url || '');
        setStudentCenterId(studentRecord.center_id || null);
        setShowCenterTransferWarning(false);
      } else {
        // Initialize from lead
        const existingBatchIds = (lead as any).student_batch_ids || [];
        setStudentBatchIds(Array.isArray(existingBatchIds) ? existingBatchIds : []);
        setSubscriptionPlan(lead.subscription_plan || '');
        setSubscriptionStartDate(lead.subscription_start_date || '');
        setSubscriptionEndDate(lead.subscription_end_date || '');
      }
      setLossReason(lead.loss_reason || '');
      setLossReasonNotes(lead.loss_reason_notes || '');
      setCallConfirmed(false);
      setCallSummary('');
      setPaymentConfirmed(false);
      setPaymentReference('');
      if (lead.status !== 'Joined') {
        setPaymentProofUrl(lead.payment_proof_url || '');
        setUploadedImagePreview(lead.payment_proof_url || '');
      }
      setShowOffRamps(false);
      setShowReversalForm(false);
      setOffRampStatus(null);
      setOffRampNote('');
      setReversalReason('');
      setShowReversalForm(false);
    }
  }, [lead, studentRecord]);

  // Check for pending approval requests
  useEffect(() => {
    if (lead && lead.id) {
      approvalsAPI.getLeadRequests(lead.id).then(response => {
        const pendingRequest = response.requests.find(req => req.request_status === 'pending');
        const hasPending = !!pendingRequest;
        setPendingApproval(hasPending);
        setPendingApprovalReason(pendingRequest?.reason || '');
      }).catch(() => {
        // Ignore errors - approval system might not be set up yet
        setPendingApproval(false);
        setPendingApprovalReason('');
      });
    }
  }, [lead]);

  // Fetch milestone data for active students
  useEffect(() => {
    if (studentRecord && studentRecord.id) {
      setIsLoadingMilestones(true);
      studentsAPI.getMilestones(studentRecord.id)
        .then(data => {
          setMilestoneData(data);
        })
        .catch(error => {
          console.error('Error fetching milestones:', error);
          setMilestoneData(null);
        })
        .finally(() => {
          setIsLoadingMilestones(false);
        });
    } else {
      setMilestoneData(null);
    }
  }, [studentRecord]);

  // Auto-calculate subscription end date when plan or start date changes
  useEffect(() => {
    if (subscriptionPlan && subscriptionStartDate) {
      const selectedPlan = SUBSCRIPTION_PLANS.find(p => p.value === subscriptionPlan);
      if (selectedPlan) {
        const calculatedEndDate = calculateSubscriptionEndDate(subscriptionStartDate, selectedPlan.months);
        setSubscriptionEndDate(calculatedEndDate);
      }
    }
  }, [subscriptionPlan, subscriptionStartDate]);

  // Set default subscription start date to today when viewing Joined lead
  useEffect(() => {
    if (lead?.status === 'Joined' && !subscriptionStartDate) {
      setSubscriptionStartDate(new Date().toISOString().split('T')[0]);
    }
  }, [lead?.status, subscriptionStartDate]);

  const isCoach = user?.role === 'coach';
  const canEdit = !isCoach;

  // Get coach trial feedback
  const coachTrialFeedback = useMemo(() => {
    if (!lead?.extra_data || typeof lead.extra_data !== 'object') return null;
    const extraData = lead.extra_data as any;
    if (extraData.coach_trial_feedback && Array.isArray(extraData.coach_trial_feedback) && extraData.coach_trial_feedback.length > 0) {
      return extraData.coach_trial_feedback[extraData.coach_trial_feedback.length - 1];
    }
    return null;
  }, [lead?.extra_data]);

  // Filter batches by center and age category - only show ACTIVE batches
  const trialBatches = lead ? allBatches.filter(b => {
    if (b.center_id !== lead.center_id || !b.is_active) return false;
    const batchAgeCategories = b.age_category.toLowerCase().split(',').map(cat => cat.trim());
    return batchAgeCategories.includes(lead.player_age_category.toLowerCase());
  }) : [];
  
  const studentBatches = lead ? allBatches.filter(b => {
    if (b.center_id !== lead.center_id || !b.is_active) return false;
    const batchAgeCategories = b.age_category.toLowerCase().split(',').map(cat => cat.trim());
    return batchAgeCategories.includes(lead.player_age_category.toLowerCase());
  }) : [];

  // Generate WhatsApp message with preference link
  const whatsappMessage = useMemo(() => {
    if (!lead?.public_token) return '';
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const prefUrl = `${baseUrl}/pref/${lead.public_token}`;
    return `Hey! We are following up on your interest for ${lead.player_name} to join TOFA Academy

Please click the link to check our preferred class Schedule and also please mention your preferred time for a quick call to discuss further

${prefUrl}`;
  }, [lead]);

  // Early return check - must be after all hooks
  if (!isOpen || !lead) return null;

  // After early return, we know lead is defined - define variables here
  const centerName = allCenters.find(c => c.id === lead.center_id)?.display_name || 'N/A';
  const currentStatus = lead.status as LeadStatus;

  // Smart step logic: If parent has already provided preferences, skip Step 1
  const hasParentPreferences = lead.preferred_batch_id !== null && lead.preferred_batch_id !== undefined;
  const effectiveStatus = (currentStatus === 'New' && hasParentPreferences) 
    ? 'Followed up with message' 
    : currentStatus;

  // Determine which step to show based on current status
  const showGuidedWorkflow = currentStatus !== 'Joined' && currentStatus !== 'Dead/Not Interested' && currentStatus !== 'Nurture' && currentStatus !== 'On Break';

  // Step 1: Send Preference Link
  const handleSendPreferenceLink = async () => {
    if (!lead.phone || !whatsappMessage.trim()) {
      toast.error('Phone number or preference link is missing');
      return;
    }
    
    const cleanPhone = lead.phone.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(whatsappMessage);
    
    // Open WhatsApp
    window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
    
    // Immediately update status to 'Followed up with message'
    try {
      await updateLeadMutation.mutateAsync({
        leadId: lead.id,
        update: {
          status: 'Followed up with message',
        },
      });
      
      // Invalidate queries to refresh the modal with new status
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      
      toast.success('Preference link sent! Status updated to "Followed up with message"');
      // Modal will refresh automatically via query invalidation, showing Step 2
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to update status';
      toast.error(`Failed to update status: ${errorMessage}`);
    }
  };

  // Step 2: Confirm Call
  const handleConfirmCall = async () => {
    if (!callConfirmed || !callSummary.trim() || callSummary.trim().length < 3) {
      toast.error('Please confirm you called and provide a call summary (min 3 characters)');
      return;
    }

    try {
      await updateLeadMutation.mutateAsync({
        leadId: lead.id,
        update: {
          status: 'Called',
          comment: callSummary.trim(),
          call_confirmation_note: callSummary.trim(),
        },
      });
      
      // Invalidate queries to refresh the modal with new status
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      
      toast.success('Call confirmed! Status updated to "Called"');
      setCallConfirmed(false);
      setCallSummary('');
      
      // Don't close modal - let user see Step 3 appear
      // Modal will refresh automatically via query invalidation
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to update status';
      toast.error(`Failed to update status: ${errorMessage}`);
    }
  };

  // Step 3: Schedule Trial
  const handleScheduleTrial = async () => {
    if (!trialBatchId) {
      toast.error('Please select a trial batch');
      return;
    }

    try {
      await updateLeadMutation.mutateAsync({
        leadId: lead.id,
        update: {
          status: 'Trial Scheduled',
          trial_batch_id: trialBatchId,
          next_date: nextDate || undefined,
        },
      });
      
      // Invalidate queries to refresh the modal with new status
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      
      toast.success('Trial scheduled! Status updated to "Trial Scheduled"');
      
      // Don't close modal - user can continue workflow if needed
      // Modal will refresh automatically via query invalidation
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to schedule trial';
      toast.error(`Failed to schedule trial: ${errorMessage}`);
    }
  };


  // Step 4: Complete Joining
  const handleCompleteJoining = async () => {
    if (!paymentConfirmed) {
      toast.error('Please confirm payment');
      return;
    }
    if (!studentBatchIds || studentBatchIds.length === 0) {
      toast.error('Please select at least one batch for the student');
      return;
    }
    if (!subscriptionPlan || !subscriptionStartDate) {
      toast.error('Please select subscription plan and start date');
      return;
    }

    try {
      // Use convertLead endpoint instead of updateLead
      await leadsAPI.convertLead(lead.id, {
        subscription_plan: subscriptionPlan,
        subscription_start_date: subscriptionStartDate,
        subscription_end_date: subscriptionEndDate || undefined,
        payment_proof_url: paymentProofUrl || undefined,
        student_batch_ids: studentBatchIds,
      });

      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      if (onJoined) {
        onJoined(lead.id, lead.player_name);
      }

      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      
      toast.success('Student joined successfully! 🎉');
      onClose();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to complete joining';
      toast.error(`Failed to complete joining: ${errorMessage}`);
      console.error('Convert lead error:', error);
    }
  };

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setIsUploadingImage(true);
    try {
      // Create preview URL for immediate display
      const previewUrl = URL.createObjectURL(file);
      setUploadedImagePreview(previewUrl);

      // Upload to Supabase
      const uploadedUrl = await uploadFile(file, 'payment-proofs');
      setPaymentProofUrl(uploadedUrl);
      setUploadedImagePreview(uploadedUrl); // Replace preview with actual URL
      
      toast.success('Payment proof uploaded successfully!');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error?.message || 'Failed to upload image. Please try again.');
      setUploadedImagePreview('');
      setPaymentProofUrl('');
    } finally {
      setIsUploadingImage(false);
      // Reset file input
      e.target.value = '';
    }
  };

  // Get previous status in workflow
  const getPreviousStatus = (currentStatus: LeadStatus): LeadStatus | null => {
    const statusFlow: LeadStatus[] = ['New', 'Followed up with message', 'Called', 'Trial Scheduled', 'Trial Attended', 'Joined'];
    const index = statusFlow.indexOf(currentStatus);
    return index > 0 ? statusFlow[index - 1] : null;
  };

  // Handle Off-Ramp (Move to Nurture, Dead, or On Break)
  const handleOffRamp = async () => {
    if (!offRampStatus || !offRampNote.trim()) {
      if (offRampStatus === 'On Break') {
        toast.error('Please provide both a reason and return date');
        return;
      }
      toast.error(offRampStatus === 'Dead/Not Interested' ? 'Please provide a reason' : 'Please provide a note');
      return;
    }

    // On Break requires both reason and return date
    if (offRampStatus === 'On Break' && !breakReason.trim()) {
      toast.error('Please provide a reason for the break');
      return;
    }
    if (offRampStatus === 'On Break' && !breakReturnDate) {
      toast.error('Please provide a return date');
      return;
    }

    try {
      await updateLeadMutation.mutateAsync({
        leadId: lead.id,
        update: {
          status: offRampStatus,
          comment: offRampNote.trim(),
          ...(offRampStatus === 'Dead/Not Interested' ? {
            loss_reason: 'Other',
            loss_reason_notes: offRampNote.trim(),
          } : {}),
          ...(offRampStatus === 'Nurture' ? {
            next_date: nextDate || undefined,
          } : {}),
          ...(offRampStatus === 'On Break' ? {
            next_date: breakReturnDate,
            // Store break reason in comment field
            comment: `Break Reason: ${breakReason.trim()}\n\nNotes: ${offRampNote.trim()}`,
          } : {}),
        },
      });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(`Lead moved to ${offRampStatus}`);
      onClose();
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  // Handle Reversal Request/Reversion
  const handleRevertStatus = async () => {
    if (!lead) return;

    const previousStatus = getPreviousStatus(currentStatus);
    if (!previousStatus) {
      toast.error('Cannot revert from this status');
      return;
    }

    // Team Lead: Immediate revert
    if (user?.role === 'team_lead') {
      const confirmed = window.confirm('Are you sure you want to revert this lead to the previous status step?');
      if (!confirmed) return;

      try {
        await updateLeadMutation.mutateAsync({
          leadId: lead.id,
          update: {
            status: previousStatus,
          },
        });

        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        toast.success('✅ Status successfully reverted.');
      } catch (error: any) {
        const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to revert status';
        toast.error(`Failed to revert: ${errorMessage}`);
      }
    } else {
      // Regular User: Show form for approval request
      setShowReversalForm(true);
    }
  };

  const handleSubmitReversalRequest = async () => {
    if (!lead || !reversalReason.trim() || reversalReason.trim().length < 5) {
      toast.error('Please provide a reason (minimum 5 characters)');
      return;
    }

    const previousStatus = getPreviousStatus(currentStatus);
    if (!previousStatus) {
      toast.error('Cannot revert from this status');
      return;
    }

    try {
      await approvalsAPI.createRequest({
        lead_id: lead.id,
        current_status: currentStatus,
        requested_status: previousStatus,
        reason: reversalReason.trim(),
      });

      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setShowReversalForm(false);
      setReversalReason('');
      toast.success('📩 Request sent to Team Lead for approval.');
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to submit request';
      toast.error(`Failed to submit request: ${errorMessage}`);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-[32px] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pending Approval Banner */}
        {pendingApproval && (
          <div className="bg-yellow-50 border-b-4 border-yellow-500 p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏳</span>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-yellow-900">Reversal Request Pending</h3>
                {pendingApprovalReason && (
                  <p className="text-xs text-yellow-700 mt-1">Reason: {pendingApprovalReason}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Header - Green for Active Students */}
        <div className={`p-8 border-b-4 flex justify-between items-center ${
          currentStatus === 'Joined' 
            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-500' 
            : 'bg-gray-50/50 border-gray-200'
        }`}>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                {lead.player_name}
              </h2>
              <StatusBadge status={currentStatus} />
              {currentStatus === 'Joined' && (
                <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">
                  ✨ Active Member
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 font-medium">
                {lead.player_age_category}
              </span>
              <span className="text-xs font-bold text-gray-400">ID: #{lead.id}</span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-3 hover:bg-gray-200 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-8 overflow-y-auto space-y-8 flex-1">
          {/* Contact Section */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100">
              <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest mb-1">Contact Phone</p>
              <p className="font-bold text-gray-900">
                {isCoach ? '🔒 Hidden' : (studentRecord?.lead_phone || lead.phone || 'N/A')}
              </p>
            </div>
            <div className="bg-gray-50 p-5 rounded-2xl border">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Center</p>
              <p className="font-bold text-gray-900">{centerName}</p>
            </div>
            {(studentRecord?.lead_email || lead.email) && (
              <div className="bg-gray-50 p-5 rounded-2xl border col-span-2">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Email</p>
                <p className="font-bold text-gray-900">{studentRecord?.lead_email || lead.email}</p>
              </div>
            )}
          </div>

          {/* Parent Input Section - Read-only Reference (Hidden for Active Members) */}
          {currentStatus !== 'Joined' && (lead.preferred_batch_id || lead.preferred_call_time || lead.preferred_timing_notes) && (
            <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl shadow-sm">
              <p className="text-xs font-black text-blue-800 uppercase tracking-widest mb-4">
                📋 Parent Input
              </p>
              <div className="space-y-3">
                {lead.preferred_batch_id && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-1">Parent's Preferred Batch:</p>
                    <p className="text-sm font-bold text-blue-900">
                      {(() => {
                        const preferredBatch = allBatches.find(b => b.id === lead.preferred_batch_id);
                        return preferredBatch ? preferredBatch.name : `Batch #${lead.preferred_batch_id}`;
                      })()}
                    </p>
                  </div>
                )}
                {lead.preferred_call_time && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-1">Best Time to Call:</p>
                    <p className="text-sm font-bold text-blue-900">{lead.preferred_call_time}</p>
                  </div>
                )}
                {lead.preferred_timing_notes && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-1">Additional Notes:</p>
                    <p className="text-sm text-blue-900 whitespace-pre-wrap">{lead.preferred_timing_notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Coach Trial Feedback */}
          {coachTrialFeedback && (
            <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-2xl">
              <p className="text-xs font-bold text-purple-800 uppercase tracking-widest mb-2">💡 Coach's Tip</p>
              <p className="text-sm text-purple-900">{coachTrialFeedback.note || ''}</p>
            </div>
          )}

          {/* GUIDED WORKFLOW */}
          {showGuidedWorkflow && (
            <div className="space-y-6 border-t pt-6">
              {/* Step 1: New - Send Preference Link (Skip if parent already provided preferences) */}
              {currentStatus === 'New' && !hasParentPreferences && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 font-bold">
                      1
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Send Preference Link</h3>
                  </div>
                  {!isCoach && lead.phone && lead.public_token && (
                    <button
                      onClick={handleSendPreferenceLink}
                      disabled={updateLeadMutation.isPending || pendingApproval}
                      className="w-full py-4 bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-600 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                    >
                      {updateLeadMutation.isPending ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <MessageCircle className="h-5 w-5" />
                          💬 Send Preference Link
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Step 2: Followed up with message - Log Confirmation Call (Also show if New + has preferences) */}
              {(effectiveStatus === 'Followed up with message') && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-bold">
                      2
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Log Confirmation Call</h3>
                      {hasParentPreferences && currentStatus === 'New' && (
                        <p className="text-xs text-blue-600 mt-1">✓ Parent preferences received - skipping Step 1</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-4 p-5 bg-blue-50 border border-blue-200 rounded-2xl">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={callConfirmed}
                        onChange={(e) => setCallConfirmed(e.target.checked)}
                        disabled={!canEdit}
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <span className="font-semibold text-gray-900">I have called the parent</span>
                    </label>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-700 uppercase tracking-widest">
                        Call Summary <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={callSummary}
                        onChange={(e) => setCallSummary(e.target.value)}
                        disabled={!canEdit}
                        placeholder="Enter a brief summary of the call (min 3 characters)..."
                        rows={4}
                        className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        minLength={3}
                      />
                      {callSummary.length > 0 && callSummary.length < 3 && (
                        <p className="text-xs text-red-600">Call summary must be at least 3 characters</p>
                      )}
                    </div>

                    <button
                      onClick={handleConfirmCall}
                      disabled={!canEdit || !callConfirmed || callSummary.trim().length < 3 || updateLeadMutation.isPending || pendingApproval}
                      className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {updateLeadMutation.isPending ? 'Confirming...' : '✓ Confirm Call'}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Called - Schedule Trial */}
              {currentStatus === 'Called' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 text-purple-600 font-bold">
                      3
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Schedule Trial</h3>
                  </div>
                  
                  <div className="space-y-4 p-5 bg-purple-50 border border-purple-200 rounded-2xl">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-700 uppercase tracking-widest">
                        Trial/Demo Batch <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={trialBatchId || ''}
                        onChange={(e) => {
                          const id = Number(e.target.value) || null;
                          setTrialBatchId(id);
                        }}
                        disabled={!canEdit}
                        className="w-full p-3 bg-white border border-gray-200 rounded-xl font-medium outline-none disabled:bg-gray-100 disabled:cursor-not-allowed focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="">Select Batch...</option>
                        {trialBatches.map(b => {
                          const isPreferred = b.id === lead?.preferred_batch_id;
                          const scheduleDays = formatBatchScheduleDays(b);
                          const timeRange = formatBatchTime(b.start_time, b.end_time);
                          return (
                            <option key={b.id} value={b.id}>
                              {b.name} ({scheduleDays} | {timeRange}){isPreferred ? ' ⭐ Parent Preferred' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-700 uppercase tracking-widest">
                        Trial Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={nextDate}
                        onChange={(e) => setNextDate(e.target.value)}
                        disabled={!canEdit}
                        className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleScheduleTrial}
                        disabled={!canEdit || !trialBatchId || updateLeadMutation.isPending || pendingApproval}
                        className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {updateLeadMutation.isPending ? 'Scheduling...' : '✓ Schedule Trial'}
                      </button>
                      <button
                        onClick={handleRevertStatus}
                        disabled={pendingApproval}
                        className="px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
                      >
                        ⏮️ Mistake? Revert status
                      </button>
                    </div>
                    {showReversalForm && user?.role !== 'team_lead' && (
                      <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                        <label className="block text-xs font-semibold text-gray-700 mb-2">
                          Reason for Reversal Request <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={reversalReason}
                          onChange={(e) => setReversalReason(e.target.value)}
                          placeholder="Explain why you need to revert the status (min 5 characters)..."
                          rows={3}
                          className="w-full p-2 text-sm bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          minLength={5}
                        />
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={handleSubmitReversalRequest}
                            disabled={!reversalReason.trim() || reversalReason.trim().length < 5}
                            className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Send Reversal Request
                          </button>
                          <button
                            onClick={() => {
                              setShowReversalForm(false);
                              setReversalReason('');
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 4: Trial Attended - Finalize Enrollment */}
              {currentStatus === 'Trial Attended' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-600 font-bold">
                      4
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Finalize Enrollment</h3>
                  </div>
                  
                  <div className="space-y-4 p-5 bg-green-50 border border-green-200 rounded-2xl">
                    {/* Batch Selection for Student */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-700 uppercase tracking-widest">
                        Assign to Batch(es) <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {studentBatches.map(batch => (
                          <label key={batch.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={studentBatchIds.includes(batch.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setStudentBatchIds([...studentBatchIds, batch.id]);
                                } else {
                                  setStudentBatchIds(studentBatchIds.filter(id => id !== batch.id));
                                }
                              }}
                              disabled={!canEdit}
                              className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            <div className="flex-1">
                              <span className="font-semibold text-gray-900">{batch.name}</span>
                              <span className="text-xs text-gray-500 ml-2">
                                ({formatBatchScheduleDays(batch)} | {formatBatchTime(batch.start_time, batch.end_time)})
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Payment Confirmation */}
                    <div className="space-y-4 border-t pt-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={paymentConfirmed}
                          onChange={(e) => setPaymentConfirmed(e.target.checked)}
                          disabled={!canEdit}
                          className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50"
                        />
                        <span className="font-semibold text-gray-900">Payment Confirmed</span>
                      </label>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-700 uppercase tracking-widest">
                          Payment Reference (Optional)
                        </label>
                        <input
                          type="text"
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          disabled={!canEdit}
                          placeholder="Transaction ID, Receipt Number, etc."
                          className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-700 uppercase tracking-widest">
                          Payment Proof (Optional)
                        </label>
                        <label className={`flex items-center justify-center gap-2 p-4 bg-white border-2 border-dashed rounded-xl transition-colors ${
                          isUploadingImage 
                            ? 'border-blue-300 bg-blue-50 cursor-wait' 
                            : 'border-gray-300 hover:bg-gray-50 cursor-pointer'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}>
                          {isUploadingImage ? (
                            <>
                              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                              <span className="text-sm font-medium text-blue-700">Uploading proof...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-5 h-5 text-gray-500" />
                              <span className="text-sm font-medium text-gray-700">
                                {paymentProofUrl ? 'Change Image' : 'Upload Payment Proof'}
                              </span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={!canEdit || isUploadingImage}
                            className="hidden"
                          />
                        </label>
                        {uploadedImagePreview && (
                          <div className="mt-2 p-3 bg-white border border-gray-200 rounded-xl">
                            <p className="text-xs font-semibold text-gray-600 mb-2">Uploaded Proof:</p>
                            <img 
                              src={uploadedImagePreview} 
                              alt="Payment proof" 
                              className="w-full max-w-xs h-auto rounded-lg border border-gray-200"
                              onError={(e) => {
                                // Fallback if image fails to load
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                            {paymentProofUrl && (
                              <p className="text-xs text-green-600 font-medium mt-2">✓ Proof saved successfully</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Subscription Details */}
                      <div className="space-y-4 border-t pt-4">
                        <h4 className="text-sm font-bold text-gray-900">Subscription Details</h4>
                        
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-700 uppercase tracking-widest">
                            Subscription Plan <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={subscriptionPlan}
                            onChange={(e) => setSubscriptionPlan(e.target.value)}
                            disabled={!canEdit}
                            className="w-full p-3 bg-white border border-gray-200 rounded-xl font-medium outline-none disabled:bg-gray-100 disabled:cursor-not-allowed focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          >
                            <option value="">Select Plan...</option>
                            {SUBSCRIPTION_PLANS.map(plan => (
                              <option key={plan.value} value={plan.value}>
                                {plan.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-700 uppercase tracking-widest">
                            Subscription Start Date <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={subscriptionStartDate}
                            onChange={(e) => setSubscriptionStartDate(e.target.value)}
                            disabled={!canEdit}
                            className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                        </div>

                        {subscriptionEndDate && (
                          <div className="p-3 bg-white border border-gray-200 rounded-xl">
                            <p className="text-xs font-semibold text-gray-600 mb-1">End Date (Auto-calculated)</p>
                            <p className="text-sm font-bold text-gray-900">{formatDate(subscriptionEndDate)}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={handleCompleteJoining}
                          disabled={!canEdit || !paymentConfirmed || !studentBatchIds.length || !subscriptionPlan || !subscriptionStartDate || updateLeadMutation.isPending || pendingApproval}
                          className="flex-1 py-4 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-lg"
                        >
                          {updateLeadMutation.isPending ? 'Completing...' : '🎉 Complete Joining'}
                        </button>
                        <button
                          onClick={handleRevertStatus}
                          disabled={pendingApproval}
                          className="px-4 py-4 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
                        >
                          ⏮️ Mistake? Revert status
                        </button>
                      </div>
                      {showReversalForm && user?.role !== 'team_lead' && (
                        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                          <label className="block text-xs font-semibold text-gray-700 mb-2">
                            Reason for Reversal Request <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            value={reversalReason}
                            onChange={(e) => setReversalReason(e.target.value)}
                            placeholder="Explain why you need to revert the status (min 5 characters)..."
                            rows={3}
                            className="w-full p-2 text-sm bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            minLength={5}
                          />
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={handleSubmitReversalRequest}
                              disabled={!reversalReason.trim() || reversalReason.trim().length < 5}
                              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Send Reversal Request
                            </button>
                            <button
                              onClick={() => {
                                setShowReversalForm(false);
                                setReversalReason('');
                              }}
                              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ON BREAK STATUS: Re-activation Section */}
          {currentStatus === 'On Break' && (() => {
            // Check if return date is within this week (7 days)
            const isReturningSoon = lead.next_followup_date && (() => {
              const returnDate = new Date(lead.next_followup_date);
              const now = new Date();
              const oneWeekFromNow = new Date(now);
              oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
              
              returnDate.setHours(0, 0, 0, 0);
              now.setHours(0, 0, 0, 0);
              oneWeekFromNow.setHours(23, 59, 59, 999);
              
              return returnDate >= now && returnDate <= oneWeekFromNow;
            })();
            
            // Get batch name from student_batch_ids
            const batchName = (() => {
              if (!lead.student_batch_ids || lead.student_batch_ids.length === 0) {
                return 'their assigned batch';
              }
              const firstBatchId = lead.student_batch_ids[0];
              const batch = allBatches.find(b => b.id === firstBatchId);
              return batch ? batch.name : 'their assigned batch';
            })();
            
            // Get parent name from email or use "Parent"
            const parentName = lead.email ? lead.email.split('@')[0] : 'Parent';
            
            // Format return date
            const returnDateFormatted = lead.next_followup_date 
              ? new Date(lead.next_followup_date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })
              : 'the return date';
            
            return (
              <div className="border-t pt-6 space-y-4">
                <div className="p-5 bg-sky-50 border-2 border-sky-300 rounded-2xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-sky-400 flex items-center justify-center text-white font-bold text-lg">
                      ⏸️
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-sky-900">Student On Break</h3>
                      <p className="text-sm text-sky-700">This student is temporarily pausing their training</p>
                      {lead.next_followup_date && (
                        <p className="text-xs text-sky-600 mt-1 font-semibold">
                          Expected return: {new Date(lead.next_followup_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {/* Welcome Back Nudge - only show if returning soon */}
                    {isReturningSoon && lead.phone && (
                      <button
                        onClick={() => {
                          if (!lead.phone) {
                            toast.error('Phone number is required to send welcome back message');
                            return;
                          }
                          
                          const message = `Hi ${parentName}, we hope ${lead.player_name}'s break was good! We've saved his spot in the ${batchName} batch. Are you ready to reactivate his training this ${returnDateFormatted}?`;
                          
                          const cleanPhone = lead.phone.replace(/\D/g, '');
                          const encodedMessage = encodeURIComponent(message);
                          window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
                          toast.success('Welcome back nudge sent via WhatsApp!');
                        }}
                        disabled={!canEdit}
                        className="w-full flex items-center justify-center gap-2 p-3 bg-orange-50 border-2 border-orange-200 rounded-xl hover:bg-orange-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <MessageCircle className="w-5 h-5 text-orange-600" />
                        <span className="font-semibold text-orange-800">📱 Welcome Back Nudge</span>
                      </button>
                    )}
                    
                    <button
                      onClick={async () => {
                        try {
                          await updateLeadMutation.mutateAsync({
                            leadId: lead.id,
                            update: {
                              status: 'Joined',
                              comment: 'Student re-activated from On Break',
                            },
                          });
                          
                          queryClient.invalidateQueries({ queryKey: ['leads'] });
                          queryClient.invalidateQueries({ queryKey: ['tasks'] });
                          queryClient.invalidateQueries({ queryKey: ['analytics'] });
                          toast.success('Student re-activated!');
                          onClose();
                        } catch (error: any) {
                          console.error('Error re-activating student:', error);
                          toast.error(error.response?.data?.detail || 'Failed to re-activate student');
                        }
                      }}
                      disabled={!canEdit || updateLeadMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 p-3 bg-green-50 border-2 border-green-200 rounded-xl hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-semibold text-green-800">🔄 Re-activate Student</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* NURTURE STATUS: Re-activation Section */}
          {currentStatus === 'Nurture' && (
            <div className="border-t pt-6 space-y-4">
              <div className="p-5 bg-yellow-50 border-2 border-yellow-300 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-white font-bold text-lg">
                    💛
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-yellow-900">Lead in Nurture Pipeline</h3>
                    <p className="text-sm text-yellow-700">This lead is being nurtured for future opportunities</p>
                    {lead.nudge_count !== undefined && lead.nudge_count > 0 && (
                      <p className="text-xs text-yellow-600 mt-1 font-semibold">
                        Nudge {lead.nudge_count} of 3
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={async () => {
                      if (!lead?.public_token || !lead?.phone) {
                        toast.error('Missing public token or phone number');
                        return;
                      }
                      
                      try {
                        // Increment nudge count
                        const nudgeResponse = await leadsAPI.sendNudge(lead.id);
                        
                        // Generate WhatsApp message with Yes/No links
                        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                        const prefUrl = `${baseUrl}/pref/${lead.public_token}`;
                        const feedbackUrl = `${baseUrl}/feedback/${lead.public_token}`;
                        const playerName = lead.player_name;
                        
                        const whatsappMessage = `Hi! We miss ${playerName} at TOFA! Want to get back to the field?

✅ Yes: ${prefUrl}
❌ No: ${feedbackUrl}`;
                        
                        // Open WhatsApp
                        const cleanPhone = lead.phone.replace(/\D/g, '');
                        const encodedMessage = encodeURIComponent(whatsappMessage);
                        window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
                        
                        toast.success(`Re-engagement nudge sent! (${nudgeResponse.nudge_count}/3)`);
                        
                        // Refresh lead data
                        queryClient.invalidateQueries({ queryKey: ['leads'] });
                        queryClient.invalidateQueries({ queryKey: ['analytics'] });
                      } catch (error: any) {
                        console.error('Error sending nudge:', error);
                        toast.error(error.response?.data?.detail || 'Failed to send nudge');
                      }
                    }}
                    disabled={!canEdit || (lead.nudge_count !== undefined && lead.nudge_count >= 3)}
                    className="flex items-center justify-center gap-2 p-3 bg-green-50 border-2 border-green-200 rounded-xl hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MessageCircle className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-800">📱 Send Re-engagement Nudge</span>
                  </button>
                  
                  <button
                    onClick={async () => {
                      try {
                        await updateLeadMutation.mutateAsync({
                          leadId: lead.id,
                          update: {
                            status: 'Called',
                            comment: 'Lead re-activated from Nurture pipeline',
                          },
                        });
                        
                        queryClient.invalidateQueries({ queryKey: ['leads'] });
                      queryClient.invalidateQueries({ queryKey: ['tasks'] });
                      toast.success('Lead re-activated! Status updated to "Called"');
                      // Modal will refresh automatically via query invalidation, showing Step 3
                    } catch (error: any) {
                      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to re-activate lead';
                      toast.error(`Failed to re-activate: ${errorMessage}`);
                    }
                  }}
                  disabled={!canEdit || updateLeadMutation.isPending}
                  className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-lg"
                >
                  {updateLeadMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Re-activating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-5 w-5" />
                      🔄 Re-activate Lead
                    </>
                  )}
                </button>
                </div>
                <p className="text-xs text-yellow-600 mt-3 text-center">
                  Re-activating will change status to "Called" and you'll see Step 3 (Schedule Trial) immediately
                </p>
              </div>
            </div>
          )}

          {/* ACTIVE STUDENT PROFILE VIEW (for Joined status) */}
          {currentStatus === 'Joined' && studentRecord && (
            <div className="space-y-6 border-t-4 border-green-500 pt-6">
              {/* Subscription Expired Banner */}
              {studentRecord.subscription_end_date && new Date(studentRecord.subscription_end_date) < new Date() && (
                <div className="p-4 bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-500 rounded-2xl shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                      ⚠
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-black text-red-900">Subscription Expired</h3>
                      <p className="text-sm text-red-700 mt-1">
                        This subscription expired on {formatDate(studentRecord.subscription_end_date)}. Please renew to continue services.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Milestone Celebration Badge */}
              {milestoneData && milestoneData.current_milestone && [10, 25, 50, 100].includes(milestoneData.current_milestone) && (
                <div className="p-5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 border-2 border-yellow-600 rounded-2xl shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center text-yellow-600 shadow-md">
                      <Trophy className="w-8 h-8" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-black text-white drop-shadow-md">
                        🎉 {milestoneData.current_milestone}-Session Milestone Reached!
                      </h3>
                      <p className="text-sm text-yellow-100 mt-1">
                        Amazing commitment! Keep up the great work!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Student Badge */}
              <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xl">
                    ✓
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-green-900">Active Member Profile</h3>
                    <p className="text-sm text-green-700">This student has completed enrollment</p>
                  </div>
                </div>
              </div>

              {/* Milestone Progress Bar */}
              {milestoneData && milestoneData.next_milestone && (
                <div className="p-4 bg-white border-2 border-gray-200 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-gray-700">Progress to Next Milestone</h4>
                    <span className="text-xs font-semibold text-gray-600">
                      {milestoneData.total_present} / {milestoneData.next_milestone} sessions
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min((milestoneData.total_present / milestoneData.next_milestone) * 100, 100)}%`
                      }}
                    />
                  </div>
                  {milestoneData.sessions_until_next !== null && (
                    <p className="text-xs text-gray-500 mt-2">
                      {milestoneData.sessions_until_next} more session{milestoneData.sessions_until_next !== 1 ? 's' : ''} until {milestoneData.next_milestone}-session milestone! 🎯
                    </p>
                  )}
                </div>
              )}

              {/* Current Subscription */}
              <div className="p-5 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl">
                <h3 className="text-sm font-black text-green-800 uppercase tracking-widest mb-4">
                  📋 Current Subscription
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-white p-4 rounded-xl border border-green-200">
                    <p className="text-xs font-semibold text-gray-600 mb-1">Plan</p>
                    <p className="text-lg font-bold text-gray-900">{studentRecord.subscription_plan || 'Not Set'}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-green-200">
                    <p className="text-xs font-semibold text-gray-600 mb-1">Expiry Date</p>
                    <p className={`text-lg font-bold ${
                      studentRecord.subscription_end_date && new Date(studentRecord.subscription_end_date) < new Date()
                        ? 'text-red-600 font-black' // Red and bold if expired
                        : studentRecord.subscription_end_date && new Date(studentRecord.subscription_end_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                        ? 'text-yellow-600'
                        : 'text-green-600'
                    }`}>
                      {studentRecord.subscription_end_date ? formatDate(studentRecord.subscription_end_date) : 'Ongoing'}
                    </p>
                  </div>
                </div>
                {studentRecord.subscription_start_date && (
                  <div className="bg-white p-3 rounded-xl border border-green-200">
                    <p className="text-xs font-semibold text-gray-600 mb-1">Subscription Period</p>
                    <p className="text-sm font-bold text-gray-900">
                      {formatDate(studentRecord.subscription_start_date)} - {studentRecord.subscription_end_date ? formatDate(studentRecord.subscription_end_date) : 'Ongoing'}
                    </p>
                  </div>
                )}
              </div>

              {/* Center Selection (Transfer Governance) */}
              {canEdit && (
                <div className="p-5 bg-white border-2 border-green-200 rounded-2xl">
                  <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-4">
                    🏢 Center Assignment
                  </h3>
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-gray-700">
                      Center <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={studentCenterId || studentRecord?.center_id || lead?.center_id || ''}
                        onChange={(e) => {
                          const newCenterId = e.target.value ? parseInt(e.target.value, 10) : null;
                          const currentCenterId = studentRecord?.center_id || lead?.center_id;
                          
                          // Check if center is being changed
                          if (newCenterId && newCenterId !== currentCenterId) {
                            setShowCenterTransferWarning(true);
                          } else {
                            setShowCenterTransferWarning(false);
                          }
                          
                          setStudentCenterId(newCenterId);
                        }}
                        disabled={user?.role !== 'team_lead'}
                        className={`w-full p-3 bg-white border border-gray-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                          user?.role !== 'team_lead' 
                            ? 'bg-gray-100 cursor-not-allowed opacity-60' 
                            : ''
                        }`}
                        title={user?.role !== 'team_lead' ? 'Contact Team Lead for center transfers.' : undefined}
                      >
                        <option value="">Select Center...</option>
                        {allCenters.map(center => (
                          <option key={center.id} value={center.id}>
                            {center.display_name}
                          </option>
                        ))}
                      </select>
                      {user?.role !== 'team_lead' && (
                        <div className="absolute inset-0 flex items-center justify-end pr-3 pointer-events-none">
                          <span className="text-xs text-gray-500 italic">Read-only</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Center Transfer Warning */}
                    {showCenterTransferWarning && user?.role === 'team_lead' && (
                      <div className="p-3 bg-yellow-50 border-2 border-yellow-300 rounded-xl">
                        <div className="flex items-start gap-2">
                          <span className="text-xl">⚠️</span>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-yellow-900 mb-1">
                              Center Transfer Warning
                            </p>
                            <p className="text-xs text-yellow-800">
                              Changing centers will remove all current batch assignments for this student. You will need to re-assign batches in the new center.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Update Center Button (only show if center changed) */}
                    {showCenterTransferWarning && user?.role === 'team_lead' && studentCenterId && studentCenterId !== (studentRecord?.center_id || lead?.center_id) && (
                      <button
                        onClick={async () => {
                          if (!studentCenterId) {
                            toast.error('Please select a center');
                            return;
                          }
                          
                          try {
                            await updateStudentMutation.mutateAsync({
                              studentId: studentRecord.id,
                              data: {
                                center_id: studentCenterId,
                                // Clear batch assignments during center transfer
                                student_batch_ids: [],
                              },
                            });
                            queryClient.invalidateQueries({ queryKey: ['students'] });
                            queryClient.invalidateQueries({ queryKey: ['leads'] });
                            setShowCenterTransferWarning(false);
                            toast.success('Center transferred successfully! Please re-assign batches in the new center.');
                          } catch (error: any) {
                            // Error handled in mutation
                          }
                        }}
                        disabled={updateStudentMutation.isPending}
                        className="w-full py-3 bg-yellow-600 text-white font-bold rounded-xl hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                      >
                        {updateStudentMutation.isPending ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Transferring...
                          </>
                        ) : (
                          <>
                            ⚠️ Confirm Center Transfer
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {/* Read-only Center Display (for non-team-leads) */}
              {!canEdit && (
                <div className="p-5 bg-gray-50 border-2 border-gray-200 rounded-2xl">
                  <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-4">
                    🏢 Center Assignment
                  </h3>
                  <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <p className="text-xs font-semibold text-gray-600 mb-1">Center</p>
                    <p className="text-lg font-bold text-gray-900">
                      {allCenters.find(c => c.id === (studentRecord?.center_id || lead?.center_id))?.display_name || 'N/A'}
                    </p>
                  </div>
                </div>
              )}

                {/* Multi-Batch Management */}
                <div className="p-5 bg-white border-2 border-green-200 rounded-2xl">
                  <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-4">
                    🎯 Assigned Batches
                  </h3>
                  
                  {/* Current Batches */}
                  {(() => {
                    const assignedBatchIds = studentRecord.student_batch_ids || [];
                    const assignedBatches = allBatches.filter(b => assignedBatchIds.includes(b.id));
                    
                    if (assignedBatches.length === 0) {
                      return (
                        <p className="text-sm text-gray-500 italic mb-4">No batches assigned yet</p>
                      );
                    }
                    
                    return (
                      <div className="space-y-2 mb-4">
                        {assignedBatches.map(batch => (
                          <div key={batch.id} className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">{batch.name}</p>
                              <p className="text-xs text-gray-600 mt-1">
                                {formatBatchScheduleDays(batch)} | {formatBatchTime(batch.start_time, batch.end_time)}
                              </p>
                            </div>
                            {canEdit && (
                              <button
                                onClick={async () => {
                                  const newBatchIds = assignedBatchIds.filter((id: number) => id !== batch.id);
                                  try {
                                    await updateStudentMutation.mutateAsync({
                                      studentId: studentRecord.id,
                                      data: {
                                        student_batch_ids: newBatchIds,
                                      },
                                    });
                                    queryClient.invalidateQueries({ queryKey: ['students'] });
                                    queryClient.invalidateQueries({ queryKey: ['leads'] });
                                  } catch (error) {
                                    // Error handled in mutation
                                  }
                                }}
                                className="px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                </div>

                {/* Payment Proof */}
                {studentRecord.payment_proof_url && (
                  <div className="p-5 bg-white border-2 border-green-200 rounded-2xl">
                    <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-4">
                      💳 Payment Proof
                    </h3>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <img
                        src={studentRecord.payment_proof_url}
                        alt="Payment proof"
                        className="w-full max-w-md mx-auto rounded-lg border border-gray-300 shadow-sm"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            parent.innerHTML = '<p class="text-red-600 text-sm">Failed to load payment proof image</p>';
                          }
                        }}
                      />
                      <p className="text-xs text-gray-500 text-center mt-2">
                        Uploaded on {formatDate(studentRecord.created_at)}
                      </p>
                    </div>
                  </div>
                )}

              {/* Attendance Summary */}
              {lead && lead.id && (
                <AttendanceSummary leadId={lead.id} />
              )}

              {/* Progress Hub - Development History */}
              <div className="p-3 sm:p-5 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border-2 border-indigo-200 rounded-2xl overflow-y-auto max-h-[400px] sm:max-h-[600px]" data-section="progress-hub">
                <h3 className="text-xs sm:text-sm font-black text-indigo-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
                  📈 Development History
                </h3>
                
                {(() => {
                  // Get skill reports from lead's extra_data or student's extra_data
                  const extraData = lead?.extra_data || (studentRecord as any)?.extra_data;
                  const skillReports = extraData && typeof extraData === 'object' 
                    ? (extraData as any).skill_reports || []
                    : [];
                  
                  if (!Array.isArray(skillReports) || skillReports.length === 0) {
                    return (
                      <div className="p-4 sm:p-6 bg-white border-2 border-dashed border-gray-300 rounded-xl text-center">
                        <p className="text-gray-500 text-xs sm:text-sm">
                          No skill reports yet. Reports will appear here after milestone sessions (15, 30, 45, 60...).
                        </p>
                      </div>
                    );
                  }
                  
                  // Sort reports by date (newest first)
                  const sortedReports = [...skillReports].sort((a: any, b: any) => {
                    const dateA = new Date(a.date || a.timestamp || 0).getTime();
                    const dateB = new Date(b.date || b.timestamp || 0).getTime();
                    return dateB - dateA;
                  });
                  
                  const latestReport = sortedReports[0];
                  const averageRating = latestReport ? (
                    (Number(latestReport.technical_skill || 0) +
                     Number(latestReport.fitness || 0) +
                     Number(latestReport.teamwork || 0) +
                     Number(latestReport.discipline || 0)) / 4
                  ) : 0;
                  
                  return (
                    <div className="space-y-3 sm:space-y-4">
                      {/* Latest Achievement Label */}
                      {latestReport && (
                        <div className="flex items-center gap-2 mb-2">
                          <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
                          <p className="text-xs sm:text-sm font-bold text-indigo-900 uppercase tracking-wide">
                            🏆 Latest Achievement
                          </p>
                        </div>
                      )}
                      
                      {/* Latest FUT Card - Mobile Responsive */}
                      {latestReport && (
                        <div className="w-full max-w-full sm:max-w-md mx-auto bg-gradient-to-br from-yellow-400 via-orange-400 to-red-500 rounded-xl p-3 sm:p-6 shadow-2xl border-2 sm:border-4 border-white transform hover:scale-[1.01] sm:hover:scale-[1.02] transition-transform">
                          <div className="bg-white/95 backdrop-blur-sm rounded-lg p-3 sm:p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 sm:mb-4">
                              <div className="flex-1">
                                <p className="text-[10px] sm:text-xs font-semibold text-gray-600 uppercase tracking-wider">Latest Report</p>
                                <p className="text-lg sm:text-2xl font-black text-gray-900 mt-0.5 sm:mt-1 break-words">
                                  {lead.player_name}
                                </p>
                              </div>
                              <div className="text-left sm:text-right">
                                {latestReport.milestone_label && (
                                  <p className="text-[10px] sm:text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 sm:py-1 rounded-full mb-1 inline-block">
                                    {latestReport.milestone_label}
                                  </p>
                                )}
                                <p className="text-xs sm:text-sm font-semibold text-gray-700">
                                  {latestReport.date ? new Date(latestReport.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date N/A'}
                                </p>
                              </div>
                            </div>
                            
                            {/* Stats Grid - Responsive with high contrast for mobile */}
                            <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4">
                              <div className="bg-white p-2 sm:p-3 rounded-lg border-2 border-gray-300 shadow-sm">
                                <p className="text-[10px] sm:text-xs font-bold text-gray-900 mb-1">TEC</p>
                                <div className="flex flex-wrap items-center gap-0.5 sm:gap-1">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`h-3 w-3 sm:h-4 sm:w-4 ${
                                        i < (Number(latestReport.technical_skill) || 0)
                                          ? 'text-yellow-500 fill-yellow-500'
                                          : 'text-gray-300'
                                      }`}
                                    />
                                  ))}
                                  <span className="ml-0.5 sm:ml-1 text-[10px] sm:text-xs font-black text-gray-900">
                                    {Number(latestReport.technical_skill) || 0}/5
                                  </span>
                                </div>
                              </div>
                              <div className="bg-white p-2 sm:p-3 rounded-lg border-2 border-gray-300 shadow-sm">
                                <p className="text-[10px] sm:text-xs font-bold text-gray-900 mb-1">FIT</p>
                                <div className="flex flex-wrap items-center gap-0.5 sm:gap-1">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`h-3 w-3 sm:h-4 sm:w-4 ${
                                        i < (Number(latestReport.fitness) || 0)
                                          ? 'text-yellow-500 fill-yellow-500'
                                          : 'text-gray-300'
                                      }`}
                                    />
                                  ))}
                                  <span className="ml-0.5 sm:ml-1 text-[10px] sm:text-xs font-black text-gray-900">
                                    {Number(latestReport.fitness) || 0}/5
                                  </span>
                                </div>
                              </div>
                              <div className="bg-white p-2 sm:p-3 rounded-lg border-2 border-gray-300 shadow-sm">
                                <p className="text-[10px] sm:text-xs font-bold text-gray-900 mb-1">TM</p>
                                <div className="flex flex-wrap items-center gap-0.5 sm:gap-1">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`h-3 w-3 sm:h-4 sm:w-4 ${
                                        i < (Number(latestReport.teamwork) || 0)
                                          ? 'text-yellow-500 fill-yellow-500'
                                          : 'text-gray-300'
                                      }`}
                                    />
                                  ))}
                                  <span className="ml-0.5 sm:ml-1 text-[10px] sm:text-xs font-black text-gray-900">
                                    {Number(latestReport.teamwork) || 0}/5
                                  </span>
                                </div>
                              </div>
                              <div className="bg-white p-2 sm:p-3 rounded-lg border-2 border-gray-300 shadow-sm">
                                <p className="text-[10px] sm:text-xs font-bold text-gray-900 mb-1">DIS</p>
                                <div className="flex flex-wrap items-center gap-0.5 sm:gap-1">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`h-3 w-3 sm:h-4 sm:w-4 ${
                                        i < (Number(latestReport.discipline) || 0)
                                          ? 'text-yellow-500 fill-yellow-500'
                                          : 'text-gray-300'
                                      }`}
                                    />
                                  ))}
                                  <span className="ml-0.5 sm:ml-1 text-[10px] sm:text-xs font-black text-gray-900">
                                    {Number(latestReport.discipline) || 0}/5
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {latestReport.coach_note && (
                              <div className="bg-gray-50 p-2 sm:p-3 rounded-lg border border-gray-200 mb-3 sm:mb-0">
                                <p className="text-[10px] sm:text-xs font-semibold text-gray-700 mb-1">Coach's Note</p>
                                <p className="text-xs sm:text-sm text-gray-800 italic leading-relaxed">"{latestReport.coach_note}"</p>
                              </div>
                            )}
                            
                            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t-2 border-gray-400">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] sm:text-xs font-bold text-gray-900">Overall Rating</p>
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                  <div className="flex items-center gap-0.5 sm:gap-1">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                      <Star
                                        key={i}
                                        className={`h-4 w-4 sm:h-5 sm:w-5 ${
                                          i < Math.round(averageRating)
                                            ? 'text-yellow-500 fill-yellow-500'
                                            : 'text-gray-300'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-base sm:text-lg font-black text-gray-900">
                                    {averageRating.toFixed(1)}/5
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Past Reports List - Mobile Responsive */}
                      {sortedReports.length > 1 && (
                        <div className="bg-white border-2 border-gray-200 rounded-xl p-3 sm:p-4 max-h-48 sm:max-h-64 overflow-y-auto">
                          <p className="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wider mb-2 sm:mb-3">
                            📚 Past Reports ({sortedReports.length - 1})
                          </p>
                          <div className="space-y-2">
                            {sortedReports.slice(1).map((report: any, index: number) => {
                              const reportAvg = (
                                (Number(report.technical_skill || 0) +
                                 Number(report.fitness || 0) +
                                 Number(report.teamwork || 0) +
                                 Number(report.discipline || 0)) / 4
                              );
                              
                              return (
                                <div
                                  key={index}
                                  className="p-2 sm:p-3 bg-gray-50 border border-gray-300 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-1">
                                      <p className="text-xs sm:text-sm font-bold text-gray-900">
                                        {report.date ? new Date(report.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date N/A'}
                                      </p>
                                      {report.milestone_label && (
                                        <span className="text-[10px] sm:text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                                          {report.milestone_label}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {Array.from({ length: 5 }).map((_, i) => (
                                        <Star
                                          key={i}
                                          className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${
                                            i < Math.round(reportAvg)
                                              ? 'text-yellow-500 fill-yellow-500'
                                              : 'text-gray-300'
                                          }`}
                                        />
                                      ))}
                                      <span className="ml-1 text-xs sm:text-sm font-bold text-gray-900">
                                        {reportAvg.toFixed(1)}/5
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Quick Actions */}
              {canEdit && (
                <div className="p-5 bg-white border-2 border-gray-200 rounded-2xl">
                  <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-4">
                    ⚡ Quick Actions
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Renew Subscription */}
                    <button
                      onClick={() => {
                        // Pre-fill with current plan
                        setSubscriptionPlan(studentRecord.subscription_plan || lead.subscription_plan || '');
                        
                        // Smart Date Suggestion: Set start date to one day after current end date
                        if (studentRecord.subscription_end_date) {
                          const endDate = new Date(studentRecord.subscription_end_date);
                          endDate.setDate(endDate.getDate() + 1); // Add one day
                          const nextDay = endDate.toISOString().split('T')[0];
                          setSubscriptionStartDate(nextDay);
                        } else {
                          // If no end date, use today
                          setSubscriptionStartDate(new Date().toISOString().split('T')[0]);
                        }
                        
                        // Scroll to renewal section
                        setTimeout(() => {
                          document.getElementById('renewal-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 100);
                      }}
                      className="flex items-center justify-center gap-2 p-4 bg-green-50 border-2 border-green-200 rounded-xl hover:bg-green-100 transition-colors"
                    >
                      <RefreshCw className="w-5 h-5 text-green-600" />
                      <span className="font-semibold text-green-800">Renew Subscription</span>
                    </button>

                    {/* Add Internal Note */}
                    <button
                      onClick={() => {
                        // Focus on comment input
                        const commentInput = document.querySelector('textarea[placeholder*="comment"], textarea[placeholder*="note"]') as HTMLTextAreaElement;
                        if (commentInput) {
                          commentInput.focus();
                          commentInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        } else {
                          // If no comment input visible, show a prompt
                          const note = prompt('Enter internal note:');
                          if (note && note.trim()) {
                            updateLeadMutation.mutate({
                              leadId: lead.id,
                              update: {
                                status: lead.status as LeadStatus,
                                comment: note.trim(),
                              },
                            });
                            toast.success('Note added');
                          }
                        }
                      }}
                      className="flex items-center justify-center gap-2 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
                    >
                      <FileText className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold text-blue-800">Add Note</span>
                    </button>

                    {/* Scroll to Progress Hub */}
                    <button
                      onClick={() => {
                        // Scroll to the Progress Hub section
                        setTimeout(() => {
                          const progressHub = document.querySelector('[data-section="progress-hub"]');
                          if (progressHub) {
                            progressHub.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }, 100);
                      }}
                      className="flex items-center justify-center gap-2 p-4 bg-purple-50 border-2 border-purple-200 rounded-xl hover:bg-purple-100 transition-colors"
                    >
                      <BarChart3 className="w-5 h-5 text-purple-600" />
                      <span className="font-semibold text-purple-800">View Development History</span>
                    </button>

                    {/* Send Renewal Link */}
                    {lead.public_token && !studentRecord?.in_grace_period && (
                      <button
                        onClick={() => {
                          if (!lead.phone) {
                            toast.error('Phone number is required to send renewal link');
                            return;
                          }
                          const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                          const renewUrl = `${baseUrl}/renew/${lead.public_token}`;
                          const message = `Hi! ${lead.player_name}'s subscription is ending soon. Please confirm your renewal intent: ${renewUrl}`;
                          
                          const cleanPhone = lead.phone.replace(/\D/g, '');
                          const encodedMessage = encodeURIComponent(message);
                          window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
                          toast.success('Renewal link sent via WhatsApp!');
                        }}
                        className="flex items-center justify-center gap-2 p-4 bg-orange-50 border-2 border-orange-200 rounded-xl hover:bg-orange-100 transition-colors"
                      >
                        <span className="text-2xl">📱</span>
                        <span className="font-semibold text-orange-800">Send Renewal Link</span>
                      </button>
                    )}

                    {/* Send Milestone Congrats */}
                    {milestoneData && milestoneData.current_milestone && [10, 25, 50, 100].includes(milestoneData.current_milestone) && lead.phone && (
                      <button
                        onClick={() => {
                          if (!lead.phone) {
                            toast.error('Phone number is required to send milestone congratulations');
                            return;
                          }
                          
                          const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                          const leadUrl = `${baseUrl}/leads/${lead.id}`;
                          
                          // Get parent name from email or use default
                          const parentName = lead.email ? lead.email.split('@')[0] : 'Parent';
                          const playerName = lead.player_name;
                          const milestone = milestoneData.current_milestone;
                          
                          // Determine ordinal suffix
                          const ordinalSuffix = (n: number) => {
                            const s = ["th", "st", "nd", "rd"];
                            const v = n % 100;
                            return n + (s[(v - 20) % 10] || s[v] || s[0]);
                          };
                          
                          const message = `Hi ${parentName}, amazing news! ${playerName} has completed his ${ordinalSuffix(milestone)} session at TOFA! ⚽ We are so proud of his commitment and progress. Check out his latest skill report here: ${leadUrl}`;
                          
                          const cleanPhone = lead.phone.replace(/\D/g, '');
                          const encodedMessage = encodeURIComponent(message);
                          window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
                          toast.success('Milestone congratulations sent via WhatsApp! 🎉');
                        }}
                        className="flex items-center justify-center gap-2 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-xl hover:bg-yellow-100 transition-colors"
                      >
                        <Trophy className="w-5 h-5 text-yellow-600" />
                        <span className="font-semibold text-yellow-800">📱 Send Milestone Congrats</span>
                      </button>
                    )}

                    {/* Grace Period Nudges */}
                    {studentRecord?.in_grace_period && (
                      <>
                        {(!studentRecord.grace_nudge_count || studentRecord.grace_nudge_count === 0) && (
                          <button
                            onClick={async () => {
                              if (!lead.phone || !studentRecord) {
                                toast.error('Phone number is required');
                                return;
                              }
                              
                              try {
                                // Increment grace_nudge_count
                                await studentsAPI.sendGraceNudge(studentRecord.id);
                                
                                // Generate WhatsApp message for Nudge 1
                                const playerName = studentRecord.lead_player_name || lead.player_name;
                                const message = `Hi! ${playerName}'s subscription expired today. We've activated a 4-day grace period!`;
                                
                                const cleanPhone = lead.phone.replace(/\D/g, '');
                                const encodedMessage = encodeURIComponent(message);
                                window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
                                
                                toast.success('Grace Nudge 1 sent!');
                                
                                // Refresh student data
                                queryClient.invalidateQueries({ queryKey: ['students'] });
                                queryClient.invalidateQueries({ queryKey: ['leads'] });
                              } catch (error: any) {
                                console.error('Error sending grace nudge:', error);
                                toast.error(error.response?.data?.detail || 'Failed to send grace nudge');
                              }
                            }}
                            className="flex items-center justify-center gap-2 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl hover:bg-yellow-100 transition-colors"
                          >
                            <MessageCircle className="w-5 h-5 text-yellow-600" />
                            <span className="font-semibold text-yellow-800">💬 Send Grace Nudge 1</span>
                          </button>
                        )}
                        
                        {studentRecord.grace_nudge_count === 1 && (
                          <button
                            onClick={async () => {
                              if (!lead.phone || !studentRecord) {
                                toast.error('Phone number is required');
                                return;
                              }
                              
                              try {
                                // Increment grace_nudge_count
                                await studentsAPI.sendGraceNudge(studentRecord.id);
                                
                                // Generate WhatsApp message for Nudge 2
                                const playerName = studentRecord.lead_player_name || lead.player_name;
                                const message = `Hi! Last day of grace period! Settle the invoice today to keep ${playerName} on the roster.`;
                                
                                const cleanPhone = lead.phone.replace(/\D/g, '');
                                const encodedMessage = encodeURIComponent(message);
                                window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
                                
                                toast.success('Final Grace Nudge sent!');
                                
                                // Refresh student data
                                queryClient.invalidateQueries({ queryKey: ['students'] });
                                queryClient.invalidateQueries({ queryKey: ['leads'] });
                              } catch (error: any) {
                                console.error('Error sending grace nudge:', error);
                                toast.error(error.response?.data?.detail || 'Failed to send grace nudge');
                              }
                            }}
                            className="flex items-center justify-center gap-2 p-4 bg-red-50 border-2 border-red-200 rounded-xl hover:bg-red-100 transition-colors"
                          >
                            <MessageCircle className="w-5 h-5 text-red-600" />
                            <span className="font-semibold text-red-800">⚠️ Send Final Grace Nudge</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Update Subscription Section */}
              {canEdit && (
                <div id="renewal-section" className="space-y-4 p-5 bg-green-50 border-2 border-green-200 rounded-2xl">
                  <h4 className="text-sm font-black text-green-800 uppercase tracking-widest mb-4">
                    🔄 Update Subscription
                  </h4>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-700 uppercase tracking-widest">
                      Subscription Plan <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={subscriptionPlan || studentRecord.subscription_plan || ''}
                      onChange={(e) => setSubscriptionPlan(e.target.value)}
                      className="w-full p-3 bg-white border border-green-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="">Select Plan...</option>
                      {SUBSCRIPTION_PLANS.map(plan => (
                        <option key={plan.value} value={plan.value}>
                          {plan.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-700 uppercase tracking-widest">
                      Subscription Start Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={subscriptionStartDate || studentRecord.subscription_start_date || ''}
                      onChange={(e) => setSubscriptionStartDate(e.target.value)}
                      className="w-full p-3 bg-white border border-green-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  {subscriptionEndDate && (
                    <div className="p-3 bg-white border border-green-200 rounded-xl">
                      <p className="text-xs font-semibold text-gray-600 mb-1">End Date (Auto-calculated)</p>
                      <p className="text-sm font-bold text-gray-900">{formatDate(subscriptionEndDate)}</p>
                    </div>
                  )}

                  <button
                    onClick={async () => {
                      const plan = subscriptionPlan || studentRecord.subscription_plan;
                      const startDate = subscriptionStartDate || studentRecord.subscription_start_date;
                      
                      if (!plan || !startDate) {
                        toast.error('Please select plan and start date');
                        return;
                      }
                      
                      try {
                        await updateStudentMutation.mutateAsync({
                          studentId: studentRecord.id,
                          data: {
                            subscription_plan: plan,
                            subscription_start_date: startDate,
                            subscription_end_date: subscriptionEndDate || undefined,
                          },
                        });
                        queryClient.invalidateQueries({ queryKey: ['students'] });
                        queryClient.invalidateQueries({ queryKey: ['leads'] });
                        toast.success('Subscription updated successfully! 🎉');
                      } catch (error) {
                        // Error handled in mutation
                      }
                    }}
                    disabled={updateStudentMutation.isPending}
                    className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {updateStudentMutation.isPending ? 'Updating...' : '🔄 Update Subscription'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Off-Ramps Section (for all steps 1-4) */}
          {showGuidedWorkflow && (
            <div className="border-t pt-6 space-y-4">
              <button
                onClick={() => setShowOffRamps(!showOffRamps)}
                disabled={!canEdit || pendingApproval}
                className="w-full py-3 bg-red-50 border-2 border-red-200 text-red-700 font-semibold rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>🚩</span>
                <span>Lead is not joining</span>
              </button>

              {showOffRamps && (
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl space-y-4">
                  <p className="text-sm font-bold text-red-900">Move Lead Out of Pipeline</p>
                  
                  <div className={`grid gap-3 ${studentRecord ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    <button
                      onClick={() => setOffRampStatus('Nurture')}
                      className={`p-3 rounded-lg border-2 font-medium transition-colors ${
                        offRampStatus === 'Nurture'
                          ? 'bg-yellow-100 border-yellow-400 text-yellow-900'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      💛 Move to Nurture
                    </button>
                    <button
                      onClick={() => setOffRampStatus('Dead/Not Interested')}
                      className={`p-3 rounded-lg border-2 font-medium transition-colors ${
                        offRampStatus === 'Dead/Not Interested'
                          ? 'bg-red-100 border-red-400 text-red-900'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      ❌ Mark as Dead
                    </button>
                    {/* Show "On Break" option only if lead has a student record */}
                    {studentRecord && (
                      <button
                        onClick={() => setOffRampStatus('On Break')}
                        className={`p-3 rounded-lg border-2 font-medium transition-colors ${
                          offRampStatus === 'On Break'
                            ? 'bg-sky-100 border-sky-400 text-sky-900'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        ⏸️ Move to On Break
                      </button>
                    )}
                  </div>

                  {offRampStatus && (
                    <div className="space-y-3">
                      {offRampStatus === 'Nurture' && (
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-gray-700">Next Follow-up Date (Optional)</label>
                          <input
                            type="date"
                            value={nextDate}
                            onChange={(e) => setNextDate(e.target.value)}
                            className="w-full p-2 bg-white border border-gray-200 rounded-lg"
                          />
                        </div>
                      )}
                      {offRampStatus === 'On Break' && (
                        <>
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-700">
                              Reason for Break <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={breakReason}
                              onChange={(e) => setBreakReason(e.target.value)}
                              className="w-full p-2 bg-white border border-gray-200 rounded-lg"
                            >
                              <option value="">Select reason...</option>
                              <option value="Exams">Exams</option>
                              <option value="Injury">Injury</option>
                              <option value="Holidays">Holidays</option>
                              <option value="Personal">Personal</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-700">
                              Expected Return Date <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="date"
                              value={breakReturnDate}
                              onChange={(e) => setBreakReturnDate(e.target.value)}
                              min={new Date().toISOString().split('T')[0]}
                              className="w-full p-2 bg-white border border-gray-200 rounded-lg"
                            />
                          </div>
                        </>
                      )}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-700">
                          {offRampStatus === 'Dead/Not Interested' ? 'Reason for Loss *' : offRampStatus === 'On Break' ? 'Additional Notes (Optional)' : 'Note *'}
                        </label>
                        <textarea
                          value={offRampNote}
                          onChange={(e) => setOffRampNote(e.target.value)}
                          placeholder={offRampStatus === 'Dead/Not Interested' ? 'Explain why the lead is not interested...' : offRampStatus === 'On Break' ? 'Add any additional notes about the break...' : 'Add a note about nurturing this lead...'}
                          rows={3}
                          className="w-full p-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleOffRamp}
                          disabled={
                            updateLeadMutation.isPending ||
                            (offRampStatus === 'On Break' 
                              ? (!breakReason.trim() || !breakReturnDate)
                              : !offRampNote.trim())
                          }
                          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {updateLeadMutation.isPending ? 'Processing...' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => {
                            setShowOffRamps(false);
                            setOffRampStatus(null);
                            setOffRampNote('');
                            setBreakReason('');
                            setBreakReturnDate('');
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Activity Feed */}
          <div className="border-t pt-6">
            <ActivityFeed leadId={lead.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
