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
  nurture_reengage_count?: number;
  milestones_count?: number;
  on_break_count?: number;
  returning_soon_count?: number;
  staging_leads_count?: number;
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
  onStagingClick?: () => void;
}

export function MetricCards({ salesMetrics, coachMetrics, onMetricClick, onStagingClick }: MetricCardsProps) {
  const { user } = useAuth();
  const isSales = user?.role === 'team_lead' || user?.role === 'team_member';
  const isCoach = user?.role === 'coach';

  if (isSales && salesMetrics) {
    // Calculate Action Pillars
    const emergencyTotal = (salesMetrics.overdue || 0) + (salesMetrics.reschedule_count || 0);
    const revenueTotal = (salesMetrics.hot_trials_count || 0) + (salesMetrics.expiring_soon_count || 0);
    const pipelineTotal = (salesMetrics.unscheduled || 0) + (salesMetrics.post_trial_no_response_count || 0);
    const retentionTotal = (salesMetrics.milestones_count || 0) + (salesMetrics.on_break_count || 0);

    return (
      <div className="space-y-6">
        {/* Staging Leads Card */}
        {salesMetrics.staging_leads_count !== undefined && salesMetrics.staging_leads_count > 0 && (
          <MetricCard
            title="📥 New Field Leads"
            value={salesMetrics.staging_leads_count}
            delta="Captured by coaches - Ready to promote"
            icon="📥"
            className="border-l-4 border-brand-accent cursor-pointer hover:shadow-xl transition-all bg-gradient-to-r from-brand-accent/10 to-transparent"
            onClick={onStagingClick}
          />
        )}
        
        {/* Action Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Pillar 1: Emergency */}
          <MetricCard
            title="🚨 Emergency"
            value={emergencyTotal}
            delta={`${salesMetrics.overdue || 0} Overdue • ${salesMetrics.reschedule_count || 0} Reschedule`}
            icon="🚨"
            className="border-l-4 border-red-500 cursor-pointer hover:shadow-xl transition-all"
            onClick={() => onMetricClick?.('overdue')}
          />
          
          {/* Pillar 2: Revenue */}
          <MetricCard
            title="💰 Revenue"
            value={revenueTotal}
            delta={`${salesMetrics.hot_trials_count || 0} Hot Trials • ${salesMetrics.expiring_soon_count || 0} Renewals`}
            icon="💰"
            className="border-l-4 border-emerald-500 cursor-pointer hover:shadow-xl transition-all"
            onClick={() => onMetricClick?.('hot_trials')}
          />
          
          {/* Pillar 3: Pipeline */}
          <MetricCard
            title="📊 Pipeline"
            value={pipelineTotal}
            delta={`${salesMetrics.unscheduled || 0} New Leads • ${salesMetrics.post_trial_no_response_count || 0} Pending Trials`}
            icon="📊"
            className="border-l-4 border-blue-500 cursor-pointer hover:shadow-xl transition-all"
            onClick={() => onMetricClick?.('unscheduled')}
          />
          
          {/* Pillar 4: Retention */}
          <MetricCard
            title="⭐ Retention"
            value={retentionTotal}
            delta={`${salesMetrics.milestones_count || 0} Milestones • ${salesMetrics.on_break_count || 0} On Break`}
            icon="⭐"
            className="border-l-4 border-amber-500 cursor-pointer hover:shadow-xl transition-all"
            onClick={() => onMetricClick?.('milestones')}
          />
        </div>
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

