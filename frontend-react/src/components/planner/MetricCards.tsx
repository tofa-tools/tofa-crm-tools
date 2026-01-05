'use client';

import { MetricCard } from '@/components/ui/MetricCard';
import { useAuth } from '@/context/AuthContext';

interface SalesMetrics {
  today_progress: number;
  today_progress_count: number;
  today_total_due: number;
  unscheduled: number;
  overdue: number;
  trial_show_up_rate: number;
  trial_show_up_count: number;
  trial_total_scheduled: number;
  hot_trials_count?: number;
  reschedule_count?: number;
  post_trial_no_response_count?: number;
  expiring_soon_count?: number;
}

interface CoachMetrics {
  session_coverage: number;
  session_attendance_count: number;
  session_total_batches: number;
  new_arrivals: number;
  skill_report_backlog: number;
  capacity_warning: number;
}

interface MetricCardsProps {
  salesMetrics?: SalesMetrics;
  coachMetrics?: CoachMetrics;
  onMetricClick?: (metricType: string) => void;
}

export function MetricCards({ salesMetrics, coachMetrics, onMetricClick }: MetricCardsProps) {
  const { user } = useAuth();
  const isSales = user?.role === 'team_lead' || user?.role === 'regular_user';
  const isCoach = user?.role === 'coach';

  if (isSales && salesMetrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
        <MetricCard
          title="Today's Progress"
          value={`${salesMetrics.today_progress.toFixed(0)}%`}
          delta={`${salesMetrics.today_progress_count}/${salesMetrics.today_total_due} completed`}
          icon="📊"
          className="border-l-4 border-blue-500"
        />
        <MetricCard
          title="Pending Trials"
          value={salesMetrics.unscheduled}
          delta="Not yet booked for trial"
          icon="⏰"
          className="border-l-4 border-orange-500 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => onMetricClick?.('unscheduled')}
        />
        <MetricCard
          title="Overdue"
          value={salesMetrics.overdue}
          delta="Past due date"
          icon="🔴"
          className="border-l-4 border-red-500 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => onMetricClick?.('overdue')}
        />
        <MetricCard
          title="Trial Pulse"
          value={`${salesMetrics.trial_show_up_rate.toFixed(0)}%`}
          delta={`${salesMetrics.trial_show_up_count}/${salesMetrics.trial_total_scheduled} showed up`}
          icon={
            <div className="relative">
              <span className="text-4xl">📈</span>
              <span className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
            </div>
          }
          className="border-l-4 border-blue-500"
        />
        <MetricCard
          title="🔥 Hot: Trial Attended"
          value={salesMetrics.hot_trials_count || 0}
          delta="Attended in last 24h"
          icon="🔥"
          className="border-l-4 border-orange-500 border-2 animate-pulse cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => onMetricClick?.('hot_trials')}
        />
        <MetricCard
          title="⚠️ Reschedule: No-Shows"
          value={salesMetrics.reschedule_count || 0}
          delta="Missed trials to reschedule"
          icon="⚠️"
          className="border-l-4 border-yellow-500 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => onMetricClick?.('reschedule')}
        />
        <MetricCard
          title="⏳ Renewals (7 Days)"
          value={salesMetrics.expiring_soon_count || 0}
          delta="Subscriptions expiring soon"
          icon="⏳"
          className="border-l-4 border-purple-500 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => onMetricClick?.('renewals')}
        />
      </div>
    );
  }

  if (isCoach && coachMetrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Session Coverage"
          value={`${coachMetrics.session_coverage.toFixed(0)}%`}
          delta={`${coachMetrics.session_attendance_count}/${coachMetrics.session_total_batches} sessions`}
          icon={
            <div className="relative">
              <span className="text-4xl">✅</span>
              <span className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
            </div>
          }
          className="border-l-4 border-emerald-500"
        />
        <MetricCard
          title="New Arrivals"
          value={coachMetrics.new_arrivals}
          delta="Trial scheduled today"
          icon={
            <div className="relative">
              <span className="text-4xl">👋</span>
              <span className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
            </div>
          }
          className="border-l-4 border-emerald-500"
        />
        <MetricCard
          title="Skill Reports"
          value={coachMetrics.skill_report_backlog}
          delta="Pending (60+ days)"
          icon="📝"
          className="border-l-4 border-emerald-500 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => onMetricClick?.('skill_reports')}
        />
        <MetricCard
          title="Capacity"
          value={coachMetrics.capacity_warning}
          delta="Batches >90% full"
          icon="⚠️"
          className="border-l-4 border-yellow-500"
        />
      </div>
    );
  }

  return null;
}

