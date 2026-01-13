'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { MetricCards } from '@/components/planner/MetricCards';
import { CalendarHeatmap } from '@/components/planner/CalendarHeatmap';
import { ActionQueue } from '@/components/planner/ActionQueue';
import { ExecutiveDashboard } from '@/components/planner/ExecutiveDashboard';
import { UnscheduledInbox } from '@/components/planner/UnscheduledInbox';
import { ExecutiveSidebar } from '@/components/planner/ExecutiveSidebar';
import Image from 'next/image';
import { useCalendarMonth } from '@/hooks/useCalendar';
import { useDailyQueue } from '@/hooks/useTasks';
import { useUpdateLead } from '@/hooks/useLeads';
import { useCommandCenterAnalytics } from '@/hooks/useAnalytics';
import { ReactivationBroadcastModal } from '@/components/leads/ReactivationBroadcastModal';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type { LeadStatus } from '@/types';

export default function CommandCenterPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isTeamLead = user?.role === 'team_lead';

  // Redirect coaches to their dashboard
  useEffect(() => {
    if (user?.role === 'coach') {
      router.push('/coach/dashboard');
    }
  }, [user, router]);
  
  if (user?.role === 'coach') {
    return null;
  }
  const [currentView, setCurrentView] = useState<'sales' | 'executive'>('sales');
  
  // Force sales view if user is not team_lead
  useEffect(() => {
    if (user?.role !== 'team_lead' && currentView === 'executive') {
      setCurrentView('sales');
    }
  }, [user?.role, currentView]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [filterType, setFilterType] = useState<'overdue' | 'unscheduled' | 'skill_reports' | 'hot_trials' | 'reschedule' | 'post_trial_no_response' | 'renewals' | 'nurture_reengage' | 'milestones' | 'on_break' | 'returning_soon' | null>(null);
  const [selectedReactivationBatch, setSelectedReactivationBatch] = useState<any>(null);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // Fetch calendar data
  const { data: calendarData = {}, refetch: refetchCalendar } = useCalendarMonth(year, month);

  // Fetch task queue for selected date
  const { data: taskQueue, isLoading: isLoadingQueue } = useDailyQueue(selectedDate);

  // Fetch command center analytics
  const { data: analyticsData } = useCommandCenterAnalytics(selectedDate);

  const updateLeadMutation = useUpdateLead();

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setFilterType(null); // Clear filter when date changes
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setCurrentDate(new Date(year, month - 1 + (direction === 'next' ? 1 : -1), 1));
  };

  const handleUpdate = async (
    leadId: number,
    update: { status?: LeadStatus; next_date?: string | null }
  ) => {
    if (!update.status) {
      return;
    }
    await updateLeadMutation.mutateAsync({
      leadId,
      update: {
        status: update.status,
        next_date: update.next_date,
      },
    });
    // Refetch calendar to update heatmap
    refetchCalendar();
    // Refetch task queue immediately
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    // Refetch analytics immediately
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
    // Refetch immediately for instant UI update
    await queryClient.refetchQueries({ queryKey: ['tasks', 'daily-queue', selectedDate] });
    await queryClient.refetchQueries({ queryKey: ['analytics', 'command-center', selectedDate] });
  };

  const handleMetricClick = (metricType: string) => {
    if (metricType === 'overdue' || metricType === 'unscheduled' || metricType === 'skill_reports' || metricType === 'hot_trials' || metricType === 'reschedule' || metricType === 'post_trial_no_response' || metricType === 'renewals' || metricType === 'nurture_reengage' || metricType === 'milestones' || metricType === 'on_break' || metricType === 'returning_soon') {
      setFilterType(metricType as 'overdue' | 'unscheduled' | 'skill_reports' | 'hot_trials' | 'reschedule' | 'post_trial_no_response' | 'renewals' | 'nurture_reengage' | 'milestones' | 'on_break' | 'returning_soon');
    }
  };

  return (
    <MainLayout>
      <div className="space-y-10 pb-8">
        {/* Header with TOFA Branding */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-lg shadow-xl p-6">
          <div className="flex items-center gap-4">
            <Image
              src="/logo.png"
              alt="TOFA Logo"
              width={48}
              height={48}
              className="object-contain"
              priority
            />
            <div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight">Command Center</h1>
              <p className="text-gray-300 mt-1 font-medium">Your action-oriented hub</p>
            </div>
          </div>
        </div>

        {/* Tab Switcher (Team Lead only) */}
        {isTeamLead && (
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setCurrentView('sales')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  currentView === 'sales'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Sales View
              </button>
              <button
                onClick={() => setCurrentView('executive')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  currentView === 'executive'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Executive View
              </button>
            </nav>
          </div>
        )}

        {/* Sales View */}
        {currentView === 'sales' && (
          <>
            {/* New Batch Opportunity Alert */}
            {analyticsData?.new_batch_opportunities && analyticsData.new_batch_opportunities.length > 0 && (
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-500 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">✨</span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">New Batch Opportunity</h3>
                      <p className="text-sm text-gray-700">
                        {analyticsData.new_batch_opportunities.length} new batch{analyticsData.new_batch_opportunities.length !== 1 ? 'es' : ''} created in your centers
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {analyticsData.new_batch_opportunities.map((opp: any) => (
                    <div
                      key={opp.batch_id}
                      className="bg-white rounded-lg p-4 border border-yellow-200 hover:border-yellow-400 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedReactivationBatch(opp);
                        setShowBroadcastModal(true);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{opp.batch_name}</p>
                          <p className="text-sm text-gray-600">{opp.center_name} • {opp.age_category}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-yellow-600">{opp.reactivation_count}</p>
                          <p className="text-xs text-gray-600">leads match</p>
                        </div>
                      </div>
                      <p className="text-xs text-yellow-700 mt-2 italic">Click to view and send WhatsApp messages</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Top Section: Metric Cards Row (Full Width) */}
            <div className="mt-8">
              <MetricCards
                salesMetrics={analyticsData}
                coachMetrics={analyticsData}
                onMetricClick={handleMetricClick}
              />
            </div>

            {/* Main Section: Two-Column Grid (Action Stream + Context Sidebar) */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-10">
              {/* Left Column: Action Stream (75% = 3/4 cols) */}
              <div className="lg:col-span-3">
                <ActionQueue
                  selectedDate={selectedDate}
                  taskQueue={taskQueue}
                  isLoading={isLoadingQueue}
                  onUpdate={handleUpdate}
                  filterType={filterType}
                  onClearFilter={() => setFilterType(null)}
                />
              </div>

              {/* Right Column: Context Sidebar (25% = 1/4 cols) */}
              <div className="lg:col-span-1 space-y-6">
                {/* Mini Calendar Navigator Widget */}
                <div className="bg-white rounded-lg shadow-md p-4">
                  <CalendarHeatmap
                    year={year}
                    month={month}
                    calendarData={calendarData}
                    selectedDate={selectedDate}
                    onDateSelect={handleDateSelect}
                    onMonthChange={handleMonthChange}
                    compact={true}
                  />
                </div>

                {/* Executive Intelligence Sidebar */}
                <ExecutiveSidebar />

                {/* Unscheduled Inbox */}
                <div className="bg-white rounded-lg shadow-md p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span>📥</span>
                    <span>Unscheduled Pipeline</span>
                  </h3>
                  <UnscheduledInbox filterType={filterType} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Executive View (Team Lead only) */}
        {isTeamLead && currentView === 'executive' && (
          <ExecutiveDashboard executiveData={analyticsData?.executive_data} />
        )}

        {/* Reactivation Broadcast Modal */}
        {showBroadcastModal && selectedReactivationBatch && (
          <ReactivationBroadcastModal
            isOpen={showBroadcastModal}
            onClose={() => {
              setShowBroadcastModal(false);
              setSelectedReactivationBatch(null);
            }}
            batchId={selectedReactivationBatch.batch_id}
            batchName={selectedReactivationBatch.batch_name}
            centerName={selectedReactivationBatch.center_name}
            ageCategory={selectedReactivationBatch.age_category}
            batchSchedule="Monday-Friday"  // Would need actual batch schedule from batch data
            batchTime="4:00 PM - 6:00 PM"  // Would need actual batch time from batch data
          />
        )}
      </div>
    </MainLayout>
  );
}

