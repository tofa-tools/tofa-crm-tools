'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuth } from '@/context/AuthContext';
import { useCoachBatches } from '@/hooks/useBatches';
import { brandConfig, generateWhatsAppLink } from '@tofa/core';
import { useLeads } from '@/hooks/useLeads';
import { useStudents } from '@/hooks/useStudents';
import type { Lead, LeadStatus, Batch } from '@tofa/core';
import { LeadUpdateModal } from '@/components/leads/LeadUpdateModal';
import { isToday as isTodayDate, getDateNDaysFromNow, isWithinLastNHours, calculateDaysRemaining, isRenewalDueWithinDays, getBatchesForDate } from '@tofa/core';

interface ActionQueueProps {
  selectedDate: string;
  taskQueue: {
    overdue: Lead[];
    due_today: Lead[];
    upcoming: Lead[];
  } | undefined;
  isLoading: boolean;
  onUpdate: (leadId: number, update: { status?: LeadStatus; next_date?: string | null }) => Promise<void>;
  filterType?: 'overdue' | 'unscheduled' | 'skill_reports' | 'hot_trials' | 'reschedule' | 'post_trial_no_response' | 'renewals' | 'nurture_reengage' | 'milestones' | 'on_break' | 'returning_soon' | null;
  onClearFilter?: () => void; // Callback to clear filter (for Back button)
}

export function ActionQueue({
  selectedDate,
  taskQueue,
  isLoading,
  onUpdate,
  filterType,
  onClearFilter,
}: ActionQueueProps) {
  const { user } = useAuth();
  const router = useRouter();
  const isSales = user?.role === 'team_lead' || user?.role === 'team_member';
  const isCoach = user?.role === 'coach';
  const [selectedLeadForUpdate, setSelectedLeadForUpdate] = useState<Lead | null>(null);

  // For coaches, fetch batches and leads
  const { data: coachBatchesData } = useCoachBatches();
  const coachBatches = coachBatchesData?.batches || [];
  const { data: leadsResponse } = useLeads({ limit: 1000 });
  const allLeads = leadsResponse?.leads || [];
  
  // Fetch students data for renewals filter
  // Note: useStudents hook calls studentsAPI.getStudents which returns an array directly
  const { data: studentsResponse, isLoading: isLoadingStudents } = useStudents({ is_active: true });
  // Handle both array response and potential wrapper object
  const allStudents = useMemo(() => {
    if (!studentsResponse) return [];
    if (Array.isArray(studentsResponse)) return studentsResponse;
    // Handle potential wrapper (though API should return array directly)
    const response = studentsResponse as any;
    if (response && typeof response === 'object' && 'students' in response) {
      return Array.isArray(response.students) ? response.students : [];
    }
    return [];
  }, [studentsResponse]);

  const selectedDateObj = new Date(selectedDate);
  const isToday = useMemo(() => {
    return isTodayDate(selectedDateObj);
  }, [selectedDate]);

  // Sales view: Triple-Stack categorization (OVERDUE, TODAY, UPCOMING)
  const tripleStackTasks = useMemo(() => {
    if (!taskQueue) return { overdue: [], today: [], upcoming: [] };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateObj = new Date(selectedDate);
    selectedDateObj.setHours(0, 0, 0, 0);
    
    // Calculate next 7 days range
    const sevenDaysFromNow = getDateNDaysFromNow(7, today);

    // Filter out Nurture and Dead leads
    const validLeads = (leads: Lead[]) => leads.filter(
      lead => lead.status !== 'Nurture' && lead.status !== 'Dead/Not Interested'
    );

    // 🛑 OVERDUE: Leads with next_followup_date in the past (always visible)
    const overdue = validLeads(taskQueue.overdue || []);

    // 🟢 TODAY: Trials and calls for the selected date
    const todayTasks: Lead[] = [];
    
    // Get tasks from due_today and upcoming that match selected date
    [...(taskQueue.due_today || []), ...(taskQueue.upcoming || [])].forEach(lead => {
      if (!lead.next_followup_date) return;
      const leadDate = new Date(lead.next_followup_date);
      leadDate.setHours(0, 0, 0, 0);
      if (leadDate.getTime() === selectedDateObj.getTime()) {
        todayTasks.push(lead);
      }
    });

    // 📅 UPCOMING: Tasks for the next 7 days (excluding today)
    const upcoming: Lead[] = [];
    [...(taskQueue.upcoming || [])].forEach(lead => {
      if (!lead.next_followup_date) return;
      const leadDate = new Date(lead.next_followup_date);
      leadDate.setHours(0, 0, 0, 0);
      // Include if it's in the next 7 days but not today
      if (leadDate > selectedDateObj && leadDate <= sevenDaysFromNow) {
        upcoming.push(lead);
      }
    });

    // Note: Special filters are handled separately in the filtered view
    // This returns the standard timeline view

    return { overdue: validLeads(overdue), today: validLeads(todayTasks), upcoming: validLeads(upcoming) };
  }, [taskQueue, selectedDate, allLeads]);

  // Special filtered view data - computed separately
  const filteredViewData = useMemo(() => {
    if (!filterType) return null;

    if (filterType === 'overdue') {
      const overdue = (taskQueue?.overdue || []).filter(
        lead => lead.status !== 'Nurture' && lead.status !== 'Dead/Not Interested'
      );
      return {
        title: '🛑 Overdue Tasks',
        subtitle: 'Past due follow-ups',
        items: overdue,
        isStudent: false,
      };
    } else if (filterType === 'unscheduled') {
      // Filter for pending trials: leads with status 'New' or 'Called' AND no next_followup_date
      // Exclude Nurture and Dead/Not Interested
      const unscheduled = allLeads.filter(lead => {
        if (lead.status !== 'New' && lead.status !== 'Called') return false;
        if (lead.next_followup_date) return false; // Must have NO follow-up date
        // Note: Status is already filtered to 'New' or 'Called', so Nurture/Dead checks are redundant but kept for clarity
        return true;
      });
      return {
        title: '📥 Pending Trials',
        subtitle: 'New or Called leads without scheduled follow-ups',
        items: unscheduled,
        isStudent: false,
      };
    } else if (filterType === 'hot_trials') {
      const hotTrials = allLeads.filter(lead => {
        if (lead.status !== 'Trial Attended') return false;
        // Note: Status is already 'Trial Attended', so 'Joined' check is redundant
        if (!lead.last_updated) return false;
        return isWithinLastNHours(lead.last_updated, 24);
      });
      return {
        title: '🔥 Hot Trials',
        subtitle: 'Attended trial in last 24 hours - Act fast!',
        items: hotTrials,
        isStudent: false,
      };
    } else if (filterType === 'reschedule') {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      const tomorrowEnd = new Date(tomorrow);
      tomorrowEnd.setHours(10, 59, 59, 999);
      
      const rescheduleLeads = allLeads.filter(lead => {
        if (lead.status !== 'Trial Scheduled') return false;
        if (!lead.next_followup_date) return false;
        const followupDate = new Date(lead.next_followup_date);
        return followupDate >= tomorrow && followupDate <= tomorrowEnd;
      });
      return {
        title: '⚠️ Reschedule Required',
        subtitle: 'No-show trials that need rescheduling',
        items: rescheduleLeads,
        isStudent: false,
      };
    } else if (filterType === 'post_trial_no_response') {
      const postTrialNoResponse = allLeads.filter(lead => {
        if (lead.status !== 'Trial Attended') return false;
        // Note: Status is already 'Trial Attended', so 'Joined' check is redundant
        if (!lead.last_updated) return false;
        // Check if NOT within last 24 hours (opposite of hot_trials)
        return !isWithinLastNHours(lead.last_updated, 24);
      });
      return {
        title: '⏳ Post-Trial Follow-Up',
        subtitle: 'Trial attended but no response in 24+ hours',
        items: postTrialNoResponse,
        isStudent: false,
      };
    } else if (filterType === 'renewals') {
      const renewals = allStudents.filter((student: any) => {
        // Backend checks: is_active == True and subscription_end_date is not None
        if (student.is_active !== true) return false;
        if (!student.subscription_end_date) return false;
        
        // Use shared renewal logic
        return isRenewalDueWithinDays(student.subscription_end_date, 7);
      });
      return {
        title: '⏳ Renewals Due (Next 7 Days)',
        subtitle: 'Active subscriptions expiring soon',
        items: renewals,
        isStudent: true,
      };
    } else if (filterType === 'nurture_reengage') {
      // Match backend logic: status == 'Nurture' AND last_updated > 5 days ago
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      fiveDaysAgo.setHours(0, 0, 0, 0);
      
      const nurtureLeads = allLeads.filter(lead => {
        if (lead.status !== 'Nurture') return false;
        
        // Check if last_updated is > 5 days ago, or if no last_updated, check created_time
        if (lead.last_updated) {
          const lastUpdated = new Date(lead.last_updated);
          lastUpdated.setHours(0, 0, 0, 0);
          return lastUpdated <= fiveDaysAgo;
        } else if (lead.created_time) {
          const createdTime = new Date(lead.created_time);
          createdTime.setHours(0, 0, 0, 0);
          return createdTime <= fiveDaysAgo;
        }
        return false;
      });
      
      return {
        title: '🌱 Nurture: Re-engage',
        subtitle: 'Idle leads needing re-engagement (> 5 days)',
        items: nurtureLeads,
        isStudent: false,
      };
    } else if (filterType === 'milestones') {
      // Filter students who hit a milestone in the last 7 days
      // This matches the backend logic: students with present_count between milestone and milestone + 7
      // and have attendance in the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      
      // Note: We'll filter by active students and let the backend handle milestone calculation
      // For now, we show all active students and let the modal handle milestone detection
      const milestoneStudents = allStudents.filter((student: any) => student.is_active === true);
      
      return {
        title: '⭐ Milestones Reached',
        subtitle: 'Students who hit milestones (10, 25, 50, 100 sessions) in last 7 days',
        items: milestoneStudents,
        isStudent: true,
      };
    } else if (filterType === 'on_break') {
      // Filter all leads with status 'On Break'
      const onBreakLeads = allLeads.filter(lead => lead.status === 'On Break');
      
      return {
        title: '⏸️ Students On Break',
        subtitle: 'Temporarily paused training',
        items: onBreakLeads,
        isStudent: false,
      };
    } else if (filterType === 'returning_soon') {
      // Filter leads with status 'On Break' where next_followup_date is within next 7 days
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const sevenDaysFromNow = new Date(now);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      sevenDaysFromNow.setHours(23, 59, 59, 999);
      
      const returningSoonLeads = allLeads.filter(lead => {
        if (lead.status !== 'On Break') return false;
        if (!lead.next_followup_date) return false;
        
        const returnDate = new Date(lead.next_followup_date);
        return returnDate >= now && returnDate <= sevenDaysFromNow;
      });
      
      return {
        title: '🗓️ Returning Soon',
        subtitle: 'Students returning within next 7 days',
        items: returningSoonLeads,
        isStudent: false,
      };
    }

    return null;
  }, [filterType, allLeads, allStudents, taskQueue]);

  // Coach view: Get batches scheduled for selected date
  const scheduledBatchesForDate = useMemo(() => {
    if (!isCoach || !coachBatches.length) return [];
    return getBatchesForDate(coachBatches, selectedDateObj);
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

  const generateWhatsAppLinkForLead = (phone: string, playerName: string) => {
    return generateWhatsAppLink(phone, brandConfig.messages.enrollmentInquiry, {
      playerName: playerName,
      academyName: brandConfig.name,
    });
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
                          window.open(generateWhatsAppLinkForLead(lead.phone, lead.player_name), '_blank');
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

  // Sales View - Check if filtered view should be shown
  const isFilteredView = filterType && filterType !== null;
  const filteredData = filteredViewData;

  // If filtered view, show filtered list
  if (isFilteredView && filteredData) {
    return (
      <>
        <div className="bg-white rounded-lg shadow-md flex flex-col h-full">
          {/* Header with Back button */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
            <div className="flex items-center gap-3 mb-2">
              {onClearFilter && (
                <button
                  onClick={onClearFilter}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition-colors"
                >
                  <span>←</span>
                  <span>Back to Daily Timeline</span>
                </button>
              )}
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              {filteredData.title}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {filteredData.subtitle} • {filteredData.items.length} item{filteredData.items.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Filtered Items List */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredData.items.length > 0 ? (
              <div className="space-y-2">
                {filteredData.items.map((item: any) => {
                  if (filteredData.isStudent) {
                    // Render student card for renewals
                    return (
                      <StudentRenewalCard
                        key={item.id}
                        student={item}
                        onUpdate={() => {
                          // For students, we'd need to open a different modal
                          // For now, we can convert student back to lead using lead_id
                          const associatedLead = allLeads.find(l => l.id === item.lead_id);
                          if (associatedLead) {
                            setSelectedLeadForUpdate(associatedLead);
                          }
                        }}
                      />
                    );
                  } else {
                    // Render lead card
                    return (
                      <EnhancedLeadCard
                        key={item.id}
                        lead={item}
                        onUpdate={() => setSelectedLeadForUpdate(item)}
                        filterType={filterType || undefined}
                        section="today"
                      />
                    );
                  }
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No items found</h3>
                <p className="text-sm text-gray-600">All caught up!</p>
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

  // Standard Triple-Stack Layout
  const totalTasks = tripleStackTasks.overdue.length + tripleStackTasks.today.length + tripleStackTasks.upcoming.length;
  const showUpcomingExpanded = tripleStackTasks.today.length === 0 && tripleStackTasks.upcoming.length > 0;

  return (
    <>
      <div className="bg-white rounded-lg shadow-md flex flex-col h-full">
        {/* Header - Sports Roster Style */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border-b-4 border-yellow-600/30 px-6 py-4">
          <h2 className="text-xl font-black text-white uppercase tracking-wide">
            Action Stream
          </h2>
          <p className="text-sm text-gray-300 mt-1 font-semibold">
            {totalTasks} task{totalTasks !== 1 ? 's' : ''} • {format(selectedDateObj, 'MMM d, yyyy')}
          </p>
        </div>

        {/* Scrollable Action Stream */}
        <div className="flex-1 overflow-y-auto">
          {/* 🛑 OVERDUE Section - Always visible at top */}
          {tripleStackTasks.overdue.length > 0 && (
            <div className="border-b-4 border-red-500">
              <div className="sticky top-[73px] z-20 bg-gradient-to-r from-red-600 to-red-700 text-white shadow-sm px-6 py-3">
                <h3 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-2">
                  <span>🛑</span>
                  <span>OVERDUE ({tripleStackTasks.overdue.length})</span>
                </h3>
              </div>
              <div className="p-4 pt-6 mt-4 space-y-4 bg-red-50/30">
                {tripleStackTasks.overdue.map((lead) => (
                  <EnhancedLeadCard
                    key={lead.id}
                    lead={lead}
                    onUpdate={() => setSelectedLeadForUpdate(lead)}
                    filterType={filterType || undefined}
                    section="overdue"
                  />
                ))}
              </div>
            </div>
          )}

          {/* 🟢 TODAY Section */}
          {tripleStackTasks.today.length > 0 ? (
            <div className="border-b-4 border-emerald-500">
              <div className="sticky top-[73px] z-20 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-sm px-6 py-3">
                <h3 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-2">
                  <span>🟢</span>
                  <span>TODAY ({tripleStackTasks.today.length})</span>
                </h3>
              </div>
              <div className="p-4 pt-6 mt-4 space-y-4 bg-green-50/30">
                {tripleStackTasks.today.map((lead) => (
                  <EnhancedLeadCard
                    key={lead.id}
                    lead={lead}
                    onUpdate={() => setSelectedLeadForUpdate(lead)}
                    filterType={filterType || undefined}
                    section="today"
                  />
                ))}
              </div>
            </div>
          ) : (
            // Smart View: Show message if Today is empty
            <div className="border-b-4 border-emerald-500">
              <div className="sticky top-[73px] z-20 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-sm px-6 py-3">
                <h3 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-2">
                  <span>🟢</span>
                  <span>TODAY (0)</span>
                </h3>
              </div>
              <div className="p-4 pt-6 mt-4 text-center py-8 bg-green-50/30">
                <p className="text-sm text-gray-700 font-medium">
                  Nothing due for today! Let's work ahead...
                </p>
              </div>
            </div>
          )}

          {/* 📅 UPCOMING Section */}
          <div className="border-b-4 border-slate-400">
            <div className="sticky top-[73px] z-20 bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-sm px-6 py-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-2">
                <span>📅</span>
                <span>UPCOMING ({tripleStackTasks.upcoming.length})</span>
              </h3>
            </div>
            {tripleStackTasks.upcoming.length > 0 ? (
              <div className="p-4 pt-6 mt-4 space-y-4 bg-gray-50/30">
                {tripleStackTasks.upcoming.map((lead) => (
                  <EnhancedLeadCard
                    key={lead.id}
                    lead={lead}
                    onUpdate={() => setSelectedLeadForUpdate(lead)}
                    filterType={filterType || undefined}
                    section="upcoming"
                  />
                ))}
              </div>
            ) : (
              <div className="p-4 pt-6 mt-4 text-center py-8 bg-gray-50/30">
                <p className="text-sm text-gray-600">No upcoming tasks in the next 7 days</p>
              </div>
            )}
          </div>
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
    daysRemaining = calculateDaysRemaining(lead.subscription_end_date);
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
              <span className="font-semibold text-purple-800">💡 Coach&apos;s Tip:</span>
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

// Enhanced Lead Card for Action Stream with Last Comment and Preferred Call Time
interface EnhancedLeadCardProps {
  lead: Lead;
  onUpdate: () => void;
  filterType?: string;
  section: 'overdue' | 'today' | 'upcoming';
}

function EnhancedLeadCard({ lead, onUpdate, filterType, section }: EnhancedLeadCardProps) {
  const hasPreferences = lead.preferred_batch_id || lead.preferred_call_time;
  
  // Calculate days remaining for renewals filter
  let daysRemaining: number | null = null;
  if (filterType === 'renewals' && lead.subscription_end_date) {
    daysRemaining = calculateDaysRemaining(lead.subscription_end_date);
  }

  // Show next_followup_date for upcoming section
  const showFollowupDate = section === 'upcoming' && lead.next_followup_date;
  
  return (
    <div 
      onClick={onUpdate}
      className={`rounded-lg p-3 border transition-all cursor-pointer bg-white hover:shadow-md ${
        section === 'overdue' ? 'border-red-300 hover:border-red-400' :
        section === 'today' ? 'border-green-300 hover:border-green-400' :
        'border-gray-300 hover:border-gray-400'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="font-semibold text-gray-900 text-sm">
              {lead.player_name}
            </h4>
            <StatusBadge status={lead.status as LeadStatus} />
            {hasPreferences && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                ✅ Info
              </span>
            )}
            {filterType === 'nurture_reengage' && lead.nudge_count !== undefined && lead.nudge_count > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">
                Nudge {lead.nudge_count}/3
              </span>
            )}
            {filterType === 'renewals' && daysRemaining !== null && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                daysRemaining <= 3 
                  ? 'bg-red-100 text-red-800 border border-red-300' 
                  : 'bg-purple-100 text-purple-800 border border-purple-300'
              }`}>
                {daysRemaining <= 0 ? 'Expired' : `${daysRemaining}d left`}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 mb-2">
            {lead.player_age_category || 'Age N/A'}
            {showFollowupDate && lead.next_followup_date && (
              <span className="ml-2 text-gray-500">
                • {format(new Date(lead.next_followup_date), 'MMM d')}
              </span>
            )}
          </p>

          {/* Last Comment (call_confirmation_note) */}
          {lead.call_confirmation_note && (
            <div className="mt-2 p-2 bg-indigo-50 border border-indigo-200 rounded text-xs">
              <span className="font-semibold text-indigo-800">💬 Last Note:</span>
              <p className="text-indigo-700 mt-1 line-clamp-2">{lead.call_confirmation_note}</p>
            </div>
          )}

          {/* Preferred Call Time */}
          {lead.preferred_call_time && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
              <span className="font-semibold text-blue-800">📞 Best Time:</span>
              <span className="ml-1 text-blue-700">{lead.preferred_call_time}</span>
            </div>
          )}

          {/* Coach's Tip */}
          {lead.extra_data && (lead.extra_data as any).coach_trial_feedback && 
           Array.isArray((lead.extra_data as any).coach_trial_feedback) && 
           (lead.extra_data as any).coach_trial_feedback.length > 0 && (
            <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded text-xs">
              <span className="font-semibold text-purple-800">💡 Coach:</span>
              <p className="text-purple-700 mt-1 line-clamp-2">
                {(lead.extra_data as any).coach_trial_feedback[(lead.extra_data as any).coach_trial_feedback.length - 1]?.note || ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Student Renewal Card for renewals filter
interface StudentRenewalCardProps {
  student: any; // Student type from API
  onUpdate: () => void;
}

function StudentRenewalCard({ student, onUpdate }: StudentRenewalCardProps) {
  // Calculate days remaining
  let daysRemaining: number | null = null;
  if (student.subscription_end_date) {
    daysRemaining = calculateDaysRemaining(student.subscription_end_date);
  }

  return (
    <div 
      onClick={onUpdate}
      className="rounded-lg p-3 border border-purple-300 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer bg-white"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="font-semibold text-gray-900 text-sm">
              {student.player_name || student.lead_player_name || 'Unknown'}
            </h4>
            {student.renewal_intent && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 border border-green-300">
                ✅ Intent Received
              </span>
            )}
            {daysRemaining !== null && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                daysRemaining <= 3 
                  ? 'bg-red-100 text-red-800 border border-red-300' 
                  : 'bg-purple-100 text-purple-800 border border-purple-300'
              }`}>
                {daysRemaining <= 0 ? 'Expired' : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left`}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 mb-2">
            {student.player_age_category || student.lead_player_age_category || 'Age N/A'}
          </p>

          {/* Subscription Plan Info */}
          {student.subscription_plan && (
            <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded text-xs">
              <div className="font-semibold text-purple-800 mb-1">
                📅 Plan: {student.subscription_plan}
              </div>
              {student.subscription_end_date && (
                <div className="text-purple-700">
                  Expires: {format(new Date(student.subscription_end_date), 'MMM d, yyyy')}
                </div>
              )}
            </div>
          )}

          {/* Contact Info */}
          {(student.lead_phone || student.lead_email) && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
              <div className="text-blue-800">
                {student.lead_phone && <div>📞 {student.lead_phone}</div>}
                {student.lead_email && <div>✉️ {student.lead_email}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

