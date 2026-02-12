'use client';

import { useRouter } from 'next/navigation';

interface SalesMetrics {
  overdue?: number;
  reschedule_count?: number;
  hot_trials_count?: number;
  expiring_soon_count?: number;
  unscheduled?: number;
  post_trial_no_response_count?: number;
  staging_leads_count?: number;
  nudge_failures_count?: number;
}

interface ActionGridProps {
  analyticsData?: SalesMetrics | null;
}

export function ActionGrid({ analyticsData }: ActionGridProps) {
  const router = useRouter();

  const backlogTotal = (analyticsData?.overdue ?? 0) + (analyticsData?.reschedule_count ?? 0);
  const revenueTotal = (analyticsData?.hot_trials_count ?? 0) + (analyticsData?.expiring_soon_count ?? 0);
  const pipelineTotal = (analyticsData?.unscheduled ?? 0) + (analyticsData?.post_trial_no_response_count ?? 0);
  const fieldCapturesCount = analyticsData?.staging_leads_count ?? 0;
  const nudgeFailuresCount = analyticsData?.nudge_failures_count ?? 0;

  const cardBase =
    'group relative rounded-2xl p-8 min-h-[200px] flex flex-col justify-between cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl border-2';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {/* Card A: BACKLOG RESCUE (Emergency) */}
      <div
        onClick={() => router.push('/leads?filter=overdue')}
        className={`${cardBase} bg-gradient-to-br from-tofa-navy to-tofa-navy-900 border-red-500/50 hover:border-red-400`}
      >
        <div className="flex items-start justify-between">
          <span className="text-4xl">🚨</span>
          <span className="text-5xl font-black text-tofa-gold">{backlogTotal}</span>
        </div>
        <div>
          <h3 className="text-lg font-bold uppercase tracking-wider text-tofa-gold">Backlog Rescue</h3>
          <p className="text-sm text-gray-300 mt-1">
            {(analyticsData?.overdue ?? 0)} Overdue • {(analyticsData?.reschedule_count ?? 0)} Reschedule
          </p>
        </div>
      </div>

      {/* Card B: CLOSING DESK (Revenue) */}
      <div
        onClick={() => router.push('/students?filter=renewals')}
        className={`${cardBase} bg-gradient-to-br from-tofa-navy to-tofa-navy-900 border-tofa-gold/50 hover:border-tofa-gold`}
      >
        <div className="flex items-start justify-between">
          <span className="text-4xl font-black text-tofa-gold">₹</span>
          <span className="text-5xl font-black text-tofa-gold">{revenueTotal}</span>
        </div>
        <div>
          <h3 className="text-lg font-bold uppercase tracking-wider text-tofa-gold">Ready to Enroll</h3>
          <p className="text-sm text-gray-300 mt-1">
            {(analyticsData?.hot_trials_count ?? 0)} Hot Trials • {(analyticsData?.expiring_soon_count ?? 0)} Renewals
          </p>
        </div>
      </div>

      {/* Card C: ACTIVE PROSPECTS (Growth) */}
      <div
        onClick={() => router.push('/leads?filter=new')}
        className={`${cardBase} bg-gradient-to-br from-tofa-navy to-tofa-navy-900 border-blue-500/50 hover:border-blue-400`}
      >
        <div className="flex items-start justify-between">
          <span className="text-4xl">📊</span>
          <span className="text-5xl font-black text-tofa-gold">{pipelineTotal}</span>
        </div>
        <div>
          <h3 className="text-lg font-bold uppercase tracking-wider text-tofa-gold">Active Prospects</h3>
          <p className="text-sm text-gray-300 mt-1">
            {(analyticsData?.unscheduled ?? 0)} New Leads • {(analyticsData?.post_trial_no_response_count ?? 0)} Pending Trials
          </p>
        </div>
      </div>

      {/* Card D: FIELD CAPTURES (Staging) */}
      <div
        onClick={() => router.push('/staging')}
        className={`${cardBase} bg-gradient-to-br from-tofa-navy to-tofa-navy-900 border-brand-accent/50 hover:border-brand-accent ${fieldCapturesCount > 0 ? 'ring-2 ring-brand-accent animate-pulse' : ''}`}
      >
        <div className="flex items-start justify-between">
          <span className="text-4xl">📥</span>
          <span className="text-5xl font-black text-tofa-gold">{fieldCapturesCount}</span>
        </div>
        <div>
          <h3 className="text-lg font-bold uppercase tracking-wider text-tofa-gold">Field Captures</h3>
          <p className="text-sm text-gray-300 mt-1">
            Captured by coaches • Ready to promote
          </p>
        </div>
      </div>

      {/* Card E: NUDGE FAILURES (Preference link not clicked in 48h) */}
      <div
        onClick={() => router.push('/leads?filter=nudge_failures')}
        className={`${cardBase} bg-gradient-to-br from-tofa-navy to-tofa-navy-900 border-amber-500/50 hover:border-amber-400 ${nudgeFailuresCount > 0 ? 'ring-2 ring-amber-400' : ''}`}
      >
        <div className="flex items-start justify-between">
          <span className="text-4xl">⚠️</span>
          <span className="text-5xl font-black text-tofa-gold">{nudgeFailuresCount}</span>
        </div>
        <div>
          <h3 className="text-lg font-bold uppercase tracking-wider text-tofa-gold">Nudge Failures</h3>
          <p className="text-sm text-gray-300 mt-1">
            Preference link not clicked in 48h • Re-send or call
          </p>
        </div>
      </div>
    </div>
  );
}
