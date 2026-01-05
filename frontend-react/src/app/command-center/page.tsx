'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { MetricCards } from '@/components/planner/MetricCards';
import { CalendarHeatmap } from '@/components/planner/CalendarHeatmap';
import { ActionQueue } from '@/components/planner/ActionQueue';
import { ExecutiveDashboard } from '@/components/planner/ExecutiveDashboard';
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
  const queryClient = useQueryClient();
  const isTeamLead = user?.role === 'team_lead';
  const [currentView, setCurrentView] = useState<'sales' | 'executive'>('sales');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [filterType, setFilterType] = useState<'overdue' | 'unscheduled' | 'skill_reports' | 'hot_trials' | 'reschedule' | 'post_trial_no_response' | null>(null);
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
    // Refetch task queue
    queryClient.invalidateQueries({ queryKey: ['tasks', 'daily-queue', selectedDate] });
    // Refetch analytics
    queryClient.invalidateQueries({ queryKey: ['analytics', 'command-center', selectedDate] });
  };

  const handleMetricClick = (metricType: string) => {
    if (metricType === 'overdue' || metricType === 'unscheduled' || metricType === 'skill_reports' || metricType === 'hot_trials' || metricType === 'reschedule' || metricType === 'post_trial_no_response') {
      setFilterType(metricType as 'overdue' | 'unscheduled' | 'skill_reports' | 'hot_trials' | 'reschedule' | 'post_trial_no_response');
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🚀 Command Center</h1>
          <p className="text-gray-600 mt-2">Your action-oriented hub</p>
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
            
            {/* Metric Cards Row */}
            <MetricCards
              salesMetrics={analyticsData}
              coachMetrics={analyticsData}
              onMetricClick={handleMetricClick}
            />

            {/* Split View: Calendar + Action Queue */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Left Side: Calendar Heatmap (60% = 3/5 cols) */}
              <div className="lg:col-span-3">
                <CalendarHeatmap
                  year={year}
                  month={month}
                  calendarData={calendarData}
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  onMonthChange={handleMonthChange}
                />
              </div>

              {/* Right Side: Action Queue (40% = 2/5 cols) */}
              <div className="lg:col-span-2">
                <ActionQueue
                  selectedDate={selectedDate}
                  taskQueue={taskQueue}
                  isLoading={isLoadingQueue}
                  onUpdate={handleUpdate}
                  filterType={filterType}
                />
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

