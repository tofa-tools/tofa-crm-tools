'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useDailyQueue, useDailyStats } from '@/hooks/useTasks';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { FreshnessIndicator } from '@/components/ui/FreshnessIndicator';
import { formatDateTime, formatDate } from '@/lib/utils';
import { useUpdateLead } from '@/hooks/useLeads';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { Lead, LeadStatus } from '@tofa/core';
import { useUserStreak, useUserTodayStats } from '@/hooks/useUserStats';
import { format } from 'date-fns';

export default function TasksPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const { data: taskQueue, isLoading, refetch } = useDailyQueue(selectedDate);
  const { data: dailyStats } = useDailyStats(selectedDate);
  const { data: streakData } = useUserStreak();
  const { data: todayStats } = useUserTodayStats(selectedDate);
  const updateLeadMutation = useUpdateLead();

  if (!user) {
    return null;
  }

  const handleQuickAction = async (lead: Lead, action: 'complete' | 'reschedule') => {
    if (action === 'complete') {
      // Mark as done - advance status or just update timestamp
      // For "Trial Scheduled", we might not want to change status, just mark as contacted
      try {
        // Simple completion: just update last_updated (will be done automatically by update_lead)
        // Or advance status if appropriate
        const newStatus = lead.status === 'New' ? 'Called' : lead.status;
        await updateLeadMutation.mutateAsync({
          leadId: lead.id,
          update: {
            status: newStatus,
            // Clear follow-up date to remove from queue
            next_date: null,
          },
        });
        toast.success('Task completed!');
        refetch();
      } catch (error) {
        toast.error('Failed to complete task');
      }
    } else if (action === 'reschedule') {
      // Navigate to leads page with this lead selected for rescheduling
      router.push(`/leads?selectedLeadId=${lead.id}`);
    }
  };

  const handleViewLead = (leadId: number) => {
    router.push(`/leads?leadId=${leadId}`);
  };

  const allTasks = [
    ...(taskQueue?.overdue || []).map(l => ({ ...l, category: 'overdue' as const })),
    ...(taskQueue?.due_today || []).map(l => ({ ...l, category: 'due_today' as const })),
    ...(taskQueue?.upcoming || []).map(l => ({ ...l, category: 'upcoming' as const })),
  ];

  // Calculate completion percentage based on today's activity
  const completedCount = todayStats?.tasks_completed || 0;
  const completionPercentage = dailyStats?.total_tasks 
    ? Math.round((completedCount / dailyStats.total_tasks) * 100) 
    : 0;
  
  // Show celebration when queue is empty
  const showCelebration = allTasks.length === 0 && completedCount > 0;

  if (isLoading) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your tasks...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title="DAILY TASK QUEUE"
        subtitle="Your prioritized list of follow-ups for today"
      />
      <div className="p-8 space-y-6">

        {/* Daily Stats Header */}
        {dailyStats && (
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-3xl font-bold">{dailyStats.total_tasks}</div>
                <div className="text-indigo-100 text-sm mt-1">Total Tasks</div>
              </div>
              <div>
                <div className="text-3xl font-bold">{dailyStats.high_priority}</div>
                <div className="text-indigo-100 text-sm mt-1">High Priority</div>
              </div>
              <div>
                <div className="text-3xl font-bold">{dailyStats.overdue_count}</div>
                <div className="text-indigo-100 text-sm mt-1">Overdue</div>
              </div>
            </div>

            {/* Progress Bar & Streaks */}
            <div className="mt-6 space-y-4">
              {dailyStats.total_tasks > 0 && (
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Completion Progress</span>
                    <span>{Math.min(completionPercentage, 100)}%</span>
                  </div>
                  <div className="w-full bg-indigo-400 bg-opacity-30 rounded-full h-3">
                    <div
                      className="bg-white rounded-full h-3 transition-all duration-300"
                      style={{ width: `${Math.min(completionPercentage, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Streak Display */}
              {streakData && streakData.current_streak > 0 && (
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🔥</span>
                    <div>
                      <div className="font-semibold">{streakData.current_streak} day streak!</div>
                      <div className="text-indigo-100 text-xs">
                        Best: {streakData.longest_streak} days
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Task Queue */}
        <div className="space-y-6">
          {/* Overdue Section */}
          {taskQueue?.overdue && taskQueue.overdue.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-red-700 mb-3 flex items-center gap-2">
                🔴 Overdue ({taskQueue.overdue.length})
              </h2>
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="divide-y divide-gray-200">
                  {taskQueue.overdue.map((lead) => (
                    <TaskItem
                      key={lead.id}
                      lead={lead}
                      category="overdue"
                      onView={() => handleViewLead(lead.id)}
                      onQuickAction={handleQuickAction}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Due Today Section */}
          {taskQueue?.due_today && taskQueue.due_today.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-orange-600 mb-3 flex items-center gap-2">
                ⏰ Due Today ({taskQueue.due_today.length})
              </h2>
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="divide-y divide-gray-200">
                  {taskQueue.due_today.map((lead) => (
                    <TaskItem
                      key={lead.id}
                      lead={lead}
                      category="due_today"
                      onView={() => handleViewLead(lead.id)}
                      onQuickAction={handleQuickAction}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Section */}
          {taskQueue?.upcoming && taskQueue.upcoming.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-blue-600 mb-3 flex items-center gap-2">
                📅 Upcoming ({taskQueue.upcoming.length})
              </h2>
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="divide-y divide-gray-200">
                  {taskQueue.upcoming.map((lead) => (
                    <TaskItem
                      key={lead.id}
                      lead={lead}
                      category="upcoming"
                      onView={() => handleViewLead(lead.id)}
                      onQuickAction={handleQuickAction}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Empty State / Celebration */}
          {allTasks.length === 0 && (
            <div className={`rounded-lg p-8 text-center ${
              showCelebration 
                ? 'bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 animate-pulse' 
                : 'bg-green-50 border border-green-200'
            }`}>
              <div className="text-6xl mb-4">{showCelebration ? '🎉✨🎊' : '🎉'}</div>
              <h3 className={`text-xl font-semibold mb-2 ${
                showCelebration ? 'text-white' : 'text-green-800'
              }`}>
                {showCelebration ? '🎯 Queue Cleared! Amazing Work! 🎯' : 'Queue Cleared!'}
              </h3>
              <p className={showCelebration ? 'text-white font-medium' : 'text-green-600'}>
                {showCelebration 
                  ? `You completed ${completedCount} task${completedCount !== 1 ? 's' : ''} today!`
                  : 'You have no tasks for today. Great job!'
                }
              </p>
              {streakData && streakData.current_streak > 0 && (
                <p className={`mt-3 font-semibold ${
                  showCelebration ? 'text-white' : 'text-green-700'
                }`}>
                  🔥 {streakData.current_streak} day streak!
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

interface TaskItemProps {
  lead: Lead;
  category: 'overdue' | 'due_today' | 'upcoming';
  onView: () => void;
  onQuickAction: (lead: Lead, action: 'complete' | 'reschedule') => void;
}

function TaskItem({ lead, category, onView, onQuickAction }: TaskItemProps) {
  const getFollowupDate = () => {
    if (!lead.next_followup_date) return null;
    return typeof lead.next_followup_date === 'string' 
      ? new Date(lead.next_followup_date) 
      : lead.next_followup_date;
  };

  const followupDate = getFollowupDate();
  const isTrial = lead.status === 'Trial Scheduled';
  const isHighPriority = category === 'overdue' || isTrial;

  return (
    <div
      className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
        isHighPriority ? 'bg-red-50 border-l-4 border-red-500' : ''
      }`}
      onClick={onView}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{lead.player_name}</h3>
            <StatusBadge status={lead.status as LeadStatus} />
            {isTrial && (
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-medium">
                🎯 Trial
              </span>
            )}
            <FreshnessIndicator lead={lead} />
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
            <div>
              <span className="font-medium">📞 Phone:</span> {lead.phone}
            </div>
            {lead.email && (
              <div>
                <span className="font-medium">📧 Email:</span> {lead.email}
              </div>
            )}
            {followupDate && (
              <div>
                <span className="font-medium">📅 Due:</span>{' '}
                {format(followupDate, 'MMM dd, yyyy')}
              </div>
            )}
            {lead.center?.display_name && (
              <div>
                <span className="font-medium">🏢 Center:</span> {lead.center.display_name}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuickAction(lead, 'complete');
            }}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            ✓ Complete
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuickAction(lead, 'reschedule');
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
          >
            📅 Reschedule
          </button>
        </div>
      </div>
    </div>
  );
}

