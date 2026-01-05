'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, MessageCircle } from 'lucide-react';
import type { Lead, LeadStatus } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LeadScore } from '@/components/ui/LeadScore';
import { CommentInput } from '@/components/forms/CommentInput';
import { ActivityFeed } from '@/components/leads/ActivityFeed';
import { useAuth } from '@/context/AuthContext';
import { useBatches } from '@/hooks/useBatches';
import { useCenters } from '@/hooks/useCenters';
import { useUpdateLead } from '@/hooks/useLeads';
import { useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/utils';

interface LeadUpdateModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onJoined?: (leadId: number, playerName: string) => void;
}

const STATUS_OPTIONS: LeadStatus[] = [
  'New',
  'Called',
  'Trial Scheduled',
  'Trial Attended',
  'Joined',
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

export function LeadUpdateModal({ lead, isOpen, onClose, onJoined }: LeadUpdateModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const updateLeadMutation = useUpdateLead();
  const { data: batchesData } = useBatches();
  const { data: centersData } = useCenters();
  
  const allBatches = batchesData || [];
  const allCenters = centersData || [];
  
  // Form state
  const [status, setStatus] = useState<LeadStatus>('New');
  const [nextDate, setNextDate] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [trialBatchId, setTrialBatchId] = useState<number | null>(null);
  const [studentBatchIds, setStudentBatchIds] = useState<number[]>([]);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string>('');
  const [subscriptionStartDate, setSubscriptionStartDate] = useState<string>('');
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<string>('');

  // Initialize form when lead changes
  useEffect(() => {
    if (lead) {
      setStatus(lead.status as LeadStatus);
      setNextDate(lead.next_followup_date ? new Date(lead.next_followup_date).toISOString().split('T')[0] : '');
      setComment('');
      setTrialBatchId(lead.trial_batch_id || null);
      // student_batch_ids may not be in Lead type yet, so handle as empty array for now
      setStudentBatchIds([]);
      setSubscriptionPlan(lead.subscription_plan || '');
      setSubscriptionStartDate(lead.subscription_start_date || '');
      setSubscriptionEndDate(lead.subscription_end_date || '');
    }
  }, [lead]);

  // Auto-calculate subscription end date when plan or start date changes
  useEffect(() => {
    if (status === 'Joined' && subscriptionPlan && subscriptionStartDate) {
      const selectedPlan = SUBSCRIPTION_PLANS.find(p => p.value === subscriptionPlan);
      if (selectedPlan) {
        const calculatedEndDate = calculateSubscriptionEndDate(subscriptionStartDate, selectedPlan.months);
        setSubscriptionEndDate(calculatedEndDate);
      }
    }
  }, [status, subscriptionPlan, subscriptionStartDate]);

  // Set default subscription start date to today when status changes to Joined
  useEffect(() => {
    if (status === 'Joined' && !subscriptionStartDate) {
      setSubscriptionStartDate(new Date().toISOString().split('T')[0]);
    }
  }, [status, subscriptionStartDate]);

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

  // Filter batches by center - only show ACTIVE batches
  const availableBatches = lead ? allBatches.filter(b => 
    b.center_id === lead.center_id && b.is_active === true
  ) : [];
  const trialBatches = availableBatches.filter(b => b.age_category === lead?.player_age_category);
  const studentBatches = availableBatches.filter(b => b.age_category === lead?.player_age_category);

  // Generate WhatsApp message with preference link
  const whatsappMessage = useMemo(() => {
    if (!lead?.public_token) return '';
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const prefUrl = `${baseUrl}/pref/${lead.public_token}`;
    return `Hey! We are following up on your interest for ${lead.player_name} to join TOFA Academy

Please click the link to check our preferred class Schedule and also please mention your preferred time for a quick call to discuss further

${prefUrl}`;
  }, [lead?.public_token, lead?.player_name]);

  if (!isOpen || !lead) return null;

  const handleOpenWhatsApp = () => {
    if (!lead.phone || !whatsappMessage.trim()) return;
    const cleanPhone = lead.phone.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(whatsappMessage);
    window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
  };

  // Validation
  const validateForm = (): string | null => {
    if (status === 'Joined') {
      if (!subscriptionPlan) {
        return 'Subscription plan is required when status is "Joined"';
      }
      if (studentBatchIds.length === 0) {
        return 'At least one batch must be selected when status is "Joined"';
      }
    }
    if (status === 'Nurture' && (!nextDate || !comment.trim())) {
      return 'Next follow-up date and comment are required when status is "Nurture"';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!lead) return;
    
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const oldStatus = lead.status;
    
    try {
      await updateLeadMutation.mutateAsync({
        leadId: lead.id,
        update: {
          status,
          next_date: nextDate || null,
          comment: comment.trim() || null,
          trial_batch_id: trialBatchId || undefined,
          student_batch_ids: status === 'Joined' ? studentBatchIds : undefined,
          subscription_plan: status === 'Joined' ? subscriptionPlan || undefined : undefined,
          subscription_start_date: status === 'Joined' && subscriptionStartDate ? subscriptionStartDate : undefined,
          subscription_end_date: status === 'Joined' && subscriptionEndDate ? subscriptionEndDate : undefined,
        },
      });

      // Confetti for Joined status
      if (oldStatus !== 'Joined' && status === 'Joined') {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        if (onJoined) {
          onJoined(lead.id, lead.player_name);
        }
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['command-center'] });
      
      onClose();
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  const centerName = lead ? allCenters.find(c => c.id === lead.center_id)?.display_name || 'N/A' : 'N/A';
  const isFormValid = validateForm() === null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-[32px] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-8 border-b flex justify-between items-center bg-gray-50/50">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                {lead.player_name}
              </h2>
              <StatusBadge status={lead.status as LeadStatus} />
            </div>
            <div className="flex items-center gap-3">
              <LeadScore score={lead.score || 0} />
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
                {isCoach ? '🔒 Hidden' : (lead.phone || 'N/A')}
              </p>
            </div>
            <div className="bg-gray-50 p-5 rounded-2xl border">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Center</p>
              <p className="font-bold text-gray-900">{centerName}</p>
            </div>
            {lead.email && (
              <div className="bg-gray-50 p-5 rounded-2xl border col-span-2">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Email</p>
                <p className="font-bold text-gray-900">{lead.email}</p>
              </div>
            )}
          </div>

          {/* WhatsApp Button */}
          {!isCoach && lead.phone && lead.public_token && (
            <button
              onClick={handleOpenWhatsApp}
              className="w-full py-3 bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-600 flex items-center justify-center gap-2 transition-all"
            >
              <MessageCircle className="h-5 w-5" />
              💬 Send Smart Nudge via WhatsApp
            </button>
          )}

          {/* Coach Trial Feedback */}
          {coachTrialFeedback && (
            <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-2xl">
              <p className="text-xs font-bold text-purple-800 uppercase tracking-widest mb-2">💡 Coach's Tip</p>
              <p className="text-sm text-purple-900">{coachTrialFeedback.note || ''}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Status */}
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">
                Update Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus)}
                disabled={!canEdit}
                className="w-full p-3 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {/* Trial Batch Selection (shown when status is NOT Joined) */}
            {status !== 'Joined' && (
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">
                  Trial/Demo Batch (For demo class)
                </label>
                <select
                  value={trialBatchId || ''}
                  onChange={(e) => {
                    const id = Number(e.target.value) || null;
                    setTrialBatchId(id);
                  }}
                  disabled={!canEdit}
                  className="w-full p-3 bg-white border border-gray-200 rounded-2xl font-medium outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select Timing/Batch...</option>
                  {trialBatches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.age_category})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Subscription Section (shown when status IS Joined) */}
            {status === 'Joined' && (
              <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Subscription Details</h3>
                
                {/* Subscription Plan */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">
                    Subscription Plan *
                  </label>
                  <select
                    value={subscriptionPlan}
                    onChange={(e) => setSubscriptionPlan(e.target.value)}
                    disabled={!canEdit}
                    className="w-full p-3 bg-white border border-gray-200 rounded-2xl font-medium outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Select Plan...</option>
                    {SUBSCRIPTION_PLANS.map(plan => (
                      <option key={plan.value} value={plan.value}>
                        {plan.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subscription Start Date */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">
                    Subscription Start Date *
                  </label>
                  <input
                    type="date"
                    value={subscriptionStartDate}
                    onChange={(e) => setSubscriptionStartDate(e.target.value)}
                    disabled={!canEdit}
                    className="w-full p-3 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Subscription End Date (read-only, auto-calculated) */}
                {subscriptionEndDate && (
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">
                      Subscription End Date
                    </label>
                    <input
                      type="date"
                      value={subscriptionEndDate}
                      readOnly
                      className="w-full p-3 bg-gray-100 border border-gray-200 rounded-2xl font-medium cursor-not-allowed text-gray-600"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Student Batches Multi-Select (shown when status IS Joined) */}
            {status === 'Joined' && (
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">
                  Student Classes Batches (After they join as student) *
                </label>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-2xl p-4 bg-white">
                  {studentBatches.length === 0 ? (
                    <p className="text-sm text-gray-500">No active batches available for this center and age category.</p>
                  ) : (
                    studentBatches.map(batch => (
                      <label
                        key={batch.id}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                      >
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
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:cursor-not-allowed"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">{batch.name}</span>
                          <span className="text-xs text-gray-500 ml-2">({batch.age_category})</span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
                {studentBatchIds.length > 0 && (
                  <p className="text-xs text-gray-500">
                    {studentBatchIds.length} batch{studentBatchIds.length !== 1 ? 'es' : ''} selected
                  </p>
                )}
              </div>
            )}

            {/* Next Follow-up Date */}
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">
                Next Follow-up Date {status === 'Nurture' && '*'}
              </label>
              <input
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                disabled={!canEdit}
                className="w-full p-3 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            {/* Comment/Notes */}
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">
                Daily Log / Internal Note {status === 'Nurture' && '*'}
              </label>
              <CommentInput
                value={comment}
                onChange={setComment}
                placeholder="Use @ to tag a team lead..."
              />
            </div>

            {/* Activity Feed (Condensed) */}
            <div className="pt-4 border-t">
              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Lifecycle Log</h4>
              <div className="max-h-48 overflow-y-auto">
                <ActivityFeed leadId={lead.id} />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex gap-4 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-4 font-black text-gray-400 hover:text-gray-600 tracking-widest uppercase text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateLeadMutation.isPending || !canEdit || !isFormValid}
                className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed tracking-widest uppercase text-xs transition-all"
              >
                {updateLeadMutation.isPending ? 'Syncing...' : 'Confirm Update'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
