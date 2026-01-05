'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuth } from '@/context/AuthContext';
import { useCoachBatches } from '@/hooks/useBatches';
import { useLeads } from '@/hooks/useLeads';
import type { Lead, LeadStatus, Batch } from '@/types';
import { LeadUpdateModal } from '@/components/leads/LeadUpdateModal';

interface ActionQueueProps {
  selectedDate: string;
  taskQueue: {
    overdue: Lead[];
    due_today: Lead[];
    upcoming: Lead[];
  } | undefined;
  isLoading: boolean;
  onUpdate: (leadId: number, update: { status?: LeadStatus; next_date?: string | null }) => Promise<void>;
  filterType?: 'overdue' | 'unscheduled' | 'skill_reports' | 'hot_trials' | 'reschedule' | 'post_trial_no_response' | 'renewals' | null;
}

export function ActionQueue({
  selectedDate,
  taskQueue,
  isLoading,
  onUpdate,
  filterType,
}: ActionQueueProps) {
  const { user } = useAuth();
  const router = useRouter();
  const isSales = user?.role === 'team_lead' || user?.role === 'regular_user';
  const isCoach = user?.role === 'coach';
  const [selectedLeadForUpdate, setSelectedLeadForUpdate] = useState<Lead | null>(null);

  // For coaches, fetch batches and leads
  const { data: coachBatchesData } = useCoachBatches();
  const coachBatches = coachBatchesData?.batches || [];
  const { data: leadsResponse } = useLeads({ limit: 1000 });
  const allLeads = leadsResponse?.leads || [];

  const selectedDateObj = new Date(selectedDate);
  const isToday = useMemo(() => {
    const today = new Date();
    return (
      selectedDateObj.getDate() === today.getDate() &&
      selectedDateObj.getMonth() === today.getMonth() &&
      selectedDateObj.getFullYear() === today.getFullYear()
    );
  }, [selectedDate]);

  // Sales view: Categorize tasks for the selected date
  const categorizedTasks = useMemo(() => {
    if (!taskQueue) return { overdue: [], scheduled: [], trials: [] };

    const allRelevantTasks: Lead[] = [];
    
    if (isToday) {
      allRelevantTasks.push(...taskQueue.overdue);
    }
    
    taskQueue.due_today.forEach(lead => {
      if (!lead.next_followup_date) return;
      const leadDate = new Date(lead.next_followup_date).toISOString().split('T')[0];
      if (leadDate === selectedDate) {
        allRelevantTasks.push(lead);
      }
    });
    
    taskQueue.upcoming.forEach(lead => {
      if (!lead.next_followup_date) return;
      const leadDate = new Date(lead.next_followup_date).toISOString().split('T')[0];
      if (leadDate === selectedDate) {
        allRelevantTasks.push(lead);
      }
    });

    // Filter out Nurture and Dead leads from Action Queue
    const filteredOverdue = isToday 
      ? taskQueue.overdue.filter(
          lead => lead.status !== 'Nurture' && lead.status !== 'Dead/Not Interested'
        )
      : [];
    const filteredTasks = allRelevantTasks.filter(
      lead => lead.status !== 'Nurture' && lead.status !== 'Dead/Not Interested'
    );
    const overdue = filteredOverdue;
    const trials = filteredTasks.filter(lead => lead.status === 'Trial Scheduled');
    const scheduled = filteredTasks.filter(lead => lead.status !== 'Trial Scheduled');

    // Apply filter if specified
    if (filterType === 'overdue') {
      return { overdue, scheduled: [], trials: [] };
    } else if (filterType === 'unscheduled') {
      // Filter for pending trials: leads with status 'New' or 'Called'
      const unscheduled = allRelevantTasks.filter(lead => lead.status === 'New' || lead.status === 'Called');
      return { overdue: [], scheduled: unscheduled, trials: [] };
    } else if (filterType === 'hot_trials') {
      // Filter for hot trials: Trial Attended with last_updated within last 24 hours
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const hotTrials = allLeads.filter(lead => {
        if (lead.status !== 'Trial Attended') return false;
        if (!lead.last_updated) return false;
        const lastUpdated = new Date(lead.last_updated);
        return lastUpdated >= last24h;
      });
      return { overdue: [], scheduled: [], trials: hotTrials };
    } else if (filterType === 'reschedule') {
      // Filter for reschedule: Trial Scheduled leads that were marked Absent
      // Since we don't have attendance data in the frontend, we filter by:
      // - Status is Trial Scheduled
      // - next_followup_date is set (likely tomorrow at 10 AM from backend logic)
      const rescheduleLeads = allLeads.filter(lead => {
        if (lead.status !== 'Trial Scheduled') return false;
        if (!lead.next_followup_date) return false;
        // Check if next_followup_date is tomorrow at 10 AM (approximate check)
        const followupDate = new Date(lead.next_followup_date);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);
        const isTomorrow10AM = followupDate.getDate() === tomorrow.getDate() &&
                               followupDate.getMonth() === tomorrow.getMonth() &&
                               followupDate.getFullYear() === tomorrow.getFullYear() &&
                               followupDate.getHours() === 10;
        return isTomorrow10AM;
      });
      return { overdue: [], scheduled: [], trials: rescheduleLeads };
    } else if (filterType === 'post_trial_no_response') {
      // Filter for post-trial no response: Trial Attended with last_updated > 24 hours ago and not Joined
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const postTrialNoResponse = allLeads.filter(lead => {
        if (lead.status !== 'Trial Attended') return false;
        if (lead.status === 'Joined') return false; // Explicitly exclude Joined
        if (!lead.last_updated) return false;
        const lastUpdated = new Date(lead.last_updated);
        return lastUpdated < last24h; // Older than 24 hours
      });
      return { overdue: [], scheduled: postTrialNoResponse, trials: [] };
    } else if (filterType === 'renewals') {
      // Filter for renewals: Joined leads with subscription_end_date within next 7 days
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const renewals = allLeads.filter(lead => {
        if (lead.status !== 'Joined') return false;
        if (!lead.subscription_end_date) return false;
        const endDate = new Date(lead.subscription_end_date);
        endDate.setHours(0, 0, 0, 0);
        return endDate >= now && endDate <= sevenDaysFromNow;
      });
      return { overdue: [], scheduled: renewals, trials: [] };
    }

    return { overdue, scheduled, trials };
  }, [taskQueue, selectedDate, isToday, filterType, allLeads]);

  // Coach view: Get batches scheduled for selected date
  const scheduledBatchesForDate = useMemo(() => {
    if (!isCoach || !coachBatches.length) return [];

    const dayOfWeek = selectedDateObj.getDay(); // 0 = Sunday, 6 = Saturday
    const dayFlags = {
      0: 'is_sun',
      1: 'is_mon',
      2: 'is_tue',
      3: 'is_wed',
      4: 'is_thu',
      5: 'is_fri',
      6: 'is_sat',
    };
    const dayFlag = dayFlags[dayOfWeek as keyof typeof dayFlags];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return coachBatches.filter(batch => {
      // Check if batch matches the day of week
      if (!batch[dayFlag as keyof Batch]) return false;
      
      // Check if batch has started (start_date must be <= selected date)
      if (batch.start_date) {
        const startDate = new Date(batch.start_date);
        startDate.setHours(0, 0, 0, 0);
        if (selectedDateObj < startDate) return false;
      }
      
      // Check if batch has ended (end_date must be >= selected date, or null for ongoing)
      if (batch.end_date) {
        const endDate = new Date(batch.end_date);
        endDate.setHours(0, 0, 0, 0);
        if (selectedDateObj > endDate) return false;
      }
      
      return true;
    });
  }, [coachBatches, selectedDate, isCoach, selectedDateObj]);

  // Coach view: Get trial arrivals for selected date
  const trialArrivals = useMemo(() => {
    if (!isCoach || !scheduledBatchesForDate.length) return [];

    const batchIds = scheduledBatchesForDate.map(b => b.id);
    return allLeads.filter(lead => {
      if (lead.status !== 'Trial Scheduled') return false;
      if (!lead.trial_batch_id || !batchIds.includes(lead.trial_batch_id)) return false;
      
      // Check if date matches (either next_followup_date or created today)
      if (lead.next_followup_date) {
        const leadDate = new Date(lead.next_followup_date).toISOString().split('T')[0];
        return leadDate === selectedDate;
      }
      
      // If no follow-up date, check if created on selected date
      if (lead.created_time) {
        const createdDate = new Date(lead.created_time).toISOString().split('T')[0];
        return createdDate === selectedDate;
      }
      
      return false;
    });
  }, [allLeads, scheduledBatchesForDate, selectedDate, isCoach]);

  const generateWhatsAppLink = (phone: string, playerName: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent(`Hi! This is regarding ${playerName}'s enrollment at TOFA Academy.`);
    return `https://wa.me/${cleanPhone}?text=${message}`;
  };

  const handleBatchClick = (batchId: number) => {
    router.push(`/check-in?batchId=${batchId}`);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Coach View
  if (isCoach) {
    const totalItems = scheduledBatchesForDate.length + trialArrivals.length;

    return (
      <>
        <div className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col">
          <div className="mb-4 pb-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {format(selectedDateObj, 'EEEE, MMMM d, yyyy')}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {totalItems} item{totalItems !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Batches Section */}
            {scheduledBatchesForDate.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-emerald-700 mb-2">
                  📅 Scheduled Batches ({scheduledBatchesForDate.length})
                </h3>
                <div className="space-y-2">
                  {scheduledBatchesForDate.map((batch) => (
                    <div
                      key={batch.id}
                      onClick={() => handleBatchClick(batch.id)}
                      className="bg-emerald-50 rounded-lg p-3 border border-emerald-200 hover:border-emerald-400 hover:shadow-sm transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 text-sm">{batch.name}</h4>
                          <p className="text-xs text-gray-600 mt-1">
                            {batch.age_category} • {batch.start_time ? format(new Date(`2000-01-01T${batch.start_time}`), 'h:mm a') : 'Time TBD'}
                          </p>
                        </div>
                        <CheckCircle className="h-5 w-5 text-emerald-600" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trial Arrivals Section */}
            {trialArrivals.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-emerald-700 mb-2">
                  🎯 Trial Arrivals ({trialArrivals.length})
                </h3>
                <div className="space-y-2">
                  {trialArrivals.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onCall={() => {
                        if (lead.phone) {
                          window.open(generateWhatsAppLink(lead.phone, lead.player_name), '_blank');
                        }
                      }}
                      onUpdate={() => setSelectedLeadForUpdate(lead)}
                    />
                  ))}
                </div>
              </div>
            )}

            {totalItems === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📅</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No sessions today</h3>
                <p className="text-sm text-gray-600">Enjoy your day off!</p>
              </div>
            )}
          </div>
        </div>

        <LeadUpdateModal
          lead={selectedLeadForUpdate}
          isOpen={!!selectedLeadForUpdate}
          onClose={() => setSelectedLeadForUpdate(null)}
        />
      </>
    );
  }

  // Sales View
  const totalTasks = categorizedTasks.overdue.length + categorizedTasks.scheduled.length + categorizedTasks.trials.length;

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col">
        <div className="mb-4 pb-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {format(selectedDateObj, 'EEEE, MMMM d, yyyy')}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {totalTasks} task{totalTasks !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          {categorizedTasks.overdue.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-red-700 mb-2">
                🔴 Overdue ({categorizedTasks.overdue.length})
              </h3>
              <div className="space-y-2">
                {categorizedTasks.overdue.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onCall={() => {
                      if (lead.phone) {
                        window.open(generateWhatsAppLink(lead.phone, lead.player_name), '_blank');
                      }
                    }}
                    onUpdate={() => setSelectedLeadForUpdate(lead)}
                    filterType={filterType || undefined}
                  />
                ))}
              </div>
            </div>
          )}

          {categorizedTasks.trials.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-purple-700 mb-2">
                🎯 Trials ({categorizedTasks.trials.length})
              </h3>
              <div className="space-y-2">
                {categorizedTasks.trials.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onCall={() => {
                      if (lead.phone) {
                        window.open(generateWhatsAppLink(lead.phone, lead.player_name), '_blank');
                      }
                    }}
                    onUpdate={() => setSelectedLeadForUpdate(lead)}
                    filterType={filterType || undefined}
                  />
                ))}
              </div>
            </div>
          )}

          {categorizedTasks.scheduled.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-blue-700 mb-2">
                📅 Scheduled ({categorizedTasks.scheduled.length})
              </h3>
              <div className="space-y-2">
                {categorizedTasks.scheduled.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onCall={() => {
                      if (lead.phone) {
                        window.open(generateWhatsAppLink(lead.phone, lead.player_name), '_blank');
                      }
                    }}
                    onUpdate={() => setSelectedLeadForUpdate(lead)}
                  />
                ))}
              </div>
            </div>
          )}

          {totalTasks === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📅</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No tasks for this day</h3>
              <p className="text-sm text-gray-600">Great time to hunt for new leads!</p>
            </div>
          )}
        </div>
      </div>

        <LeadUpdateModal
          lead={selectedLeadForUpdate}
          isOpen={!!selectedLeadForUpdate}
          onClose={() => setSelectedLeadForUpdate(null)}
        />
    </>
  );
}

interface LeadCardProps {
  lead: Lead;
  onCall?: () => void; // Made optional since we're not using it anymore
  onUpdate: () => void;
}

function LeadCard({ lead, onCall, onUpdate, filterType }: LeadCardProps & { filterType?: string }) {
  const hasPreferences = lead.preferred_batch_id || lead.preferred_call_time;
  
  // Calculate days remaining for renewals filter
  let daysRemaining: number | null = null;
  if (filterType === 'renewals' && lead.subscription_end_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(lead.subscription_end_date);
    endDate.setHours(0, 0, 0, 0);
    const diffTime = endDate.getTime() - today.getTime();
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  return (
    <div 
      onClick={onUpdate}
      className={`rounded-lg p-3 border transition-all cursor-pointer ${hasPreferences ? 'bg-green-50 border-green-300 hover:border-green-400' : 'bg-gray-50 border-gray-200 hover:border-blue-300'} hover:shadow-sm`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="font-semibold text-gray-900 text-sm truncate">
              {lead.player_name}
            </h4>
            <StatusBadge status={lead.status as LeadStatus} />
            {hasPreferences && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                ✅ Info Received
              </span>
            )}
            {filterType === 'renewals' && daysRemaining !== null && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                daysRemaining <= 3 
                  ? 'bg-red-100 text-red-800 border border-red-300' 
                  : 'bg-purple-100 text-purple-800 border border-purple-300'
              }`}>
                {daysRemaining <= 0 ? 'Expired' : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left`}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600">
            {lead.player_age_category || 'Age N/A'}
          </p>
          {filterType === 'renewals' && lead.subscription_plan && lead.subscription_end_date && (
            <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded text-xs">
              <div className="font-semibold text-purple-800 mb-1">
                📅 Plan: {lead.subscription_plan}
              </div>
              <div className="text-purple-700">
                Expires: {format(new Date(lead.subscription_end_date), 'MMM d, yyyy')}
              </div>
            </div>
          )}
          {lead.preferred_call_time && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
              <span className="font-semibold text-blue-800">📞 Preferred Call Time:</span>
              <span className="ml-1 text-blue-700">{lead.preferred_call_time}</span>
            </div>
          )}
          {/* Coach's Tip: Show coach_trial_feedback if available */}
          {lead.extra_data && (lead.extra_data as any).coach_trial_feedback && 
           Array.isArray((lead.extra_data as any).coach_trial_feedback) && 
           (lead.extra_data as any).coach_trial_feedback.length > 0 && (
            <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded text-xs">
              <span className="font-semibold text-purple-800">💡 Coach's Tip:</span>
              <span className="ml-1 text-purple-700">
                {(lead.extra_data as any).coach_trial_feedback[(lead.extra_data as any).coach_trial_feedback.length - 1]?.note || ''}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

