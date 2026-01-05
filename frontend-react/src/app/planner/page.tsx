'use client';

import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { MetricCard } from '@/components/ui/MetricCard';
import { CalendarHeatmap } from '@/components/planner/CalendarHeatmap';
import { DailyAgenda } from '@/components/planner/DailyAgenda';
import { useCalendarMonth } from '@/hooks/useCalendar';
import { useDailyQueue, useDailyStats } from '@/hooks/useTasks';
import { useLeads } from '@/hooks/useLeads';
import { useUpdateLead } from '@/hooks/useLeads';
import { useAbandonedCount } from '@/hooks/useAnalytics';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import type { LeadStatus } from '@/types';

export default function PlannerPage() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // Fetch calendar data
  const { data: calendarData = {}, refetch: refetchCalendar } = useCalendarMonth(year, month);

  // Fetch task queue for selected date
  const { data: taskQueue, isLoading: isLoadingQueue } = useDailyQueue(selectedDate);

  // Fetch metrics
  const { data: leadsResponse } = useLeads({ limit: 1000 });
  const { data: abandonedData } = useAbandonedCount();
  const updateLeadMutation = useUpdateLead();

  // Calculate metrics
  const leadsData = leadsResponse?.leads || [];
  const totalLeads = leadsResponse?.total || 0;
  const newLeads = leadsData.filter((lead) => lead.status === 'New').length;
  
  // Trials Today: Count leads with status 'Trial Scheduled' and next_followup_date is today
  const today = new Date().toISOString().split('T')[0];
  const trialsToday = leadsData.filter((lead) => {
    if (lead.status !== 'Trial Scheduled') return false;
    if (!lead.next_followup_date) return false;
    const leadDate = new Date(lead.next_followup_date).toISOString().split('T')[0];
    return leadDate === today;
  }).length;

  const abandonedLeads = abandonedData?.abandoned_leads_count || 0;

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setCurrentDate(new Date(year, month - 1 + (direction === 'next' ? 1 : -1), 1));
  };

  const handleUpdate = async (
    leadId: number,
    update: { status?: LeadStatus; next_date?: string | null }
  ) => {
    if (!update.status) {
      // Status is required for the API
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
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📅 Unified Planner</h1>
          <p className="text-gray-600 mt-2">Your execution hub for leads and tasks</p>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Total Leads" value={totalLeads} icon="👥" />
          <MetricCard
            title="Trials Today"
            value={trialsToday}
            icon="📅"
          />
          <MetricCard
            title="New Leads"
            value={newLeads}
            icon="🆕"
          />
          <MetricCard
            title="Abandoned Leads"
            value={abandonedLeads}
            icon="👻"
            delta="Not touched in > 48h"
          />
        </div>

        {/* Split View: Calendar + Agenda */}
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

          {/* Right Side: Daily Agenda (40% = 2/5 cols) */}
          <div className="lg:col-span-2">
            <DailyAgenda
              selectedDate={selectedDate}
              taskQueue={taskQueue}
              isLoading={isLoadingQueue}
              onUpdate={handleUpdate}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

