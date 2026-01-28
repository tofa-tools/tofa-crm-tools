'use client';

import { useMemo } from 'react';
import { useLeads } from '@/hooks/useLeads';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Lead, LeadStatus } from '@tofa/core';

interface UnscheduledInboxProps {
  filterType?: 'overdue' | 'unscheduled' | 'skill_reports' | 'hot_trials' | 'reschedule' | 'post_trial_no_response' | null;
  onLeadClick?: (leadId: number) => void;
}

export function UnscheduledInbox({ filterType, onLeadClick }: UnscheduledInboxProps) {
  const { data: leadsResponse } = useLeads({ limit: 1000 });
  const allLeads = leadsResponse?.leads || [];

  // Filter for unscheduled leads: status 'New' or 'Called' with no next_followup_date
  const unscheduledLeads = useMemo(() => {
    return allLeads.filter(lead => {
      if (lead.status !== 'New' && lead.status !== 'Called') return false;
      if (lead.next_followup_date) return false; // Has a follow-up date, so it's scheduled
      // Note: Status is already filtered to 'New' or 'Called', so Dead/Nurture checks are redundant but kept for clarity
      return true;
    });
  }, [allLeads]);

  if (unscheduledLeads.length === 0) {
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-2">✅</div>
        <p className="text-xs text-gray-600">All leads scheduled!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {unscheduledLeads.slice(0, 10).map((lead) => (
        <div
          key={lead.id}
          onClick={() => onLeadClick?.(lead.id)}
          className="p-2 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">
                {lead.player_name}
              </p>
              <p className="text-xs text-gray-600">
                {lead.player_age_category || 'Age N/A'}
              </p>
            </div>
            <StatusBadge status={lead.status as LeadStatus} />
          </div>
        </div>
      ))}
      {unscheduledLeads.length > 10 && (
        <p className="text-xs text-gray-500 text-center pt-2">
          +{unscheduledLeads.length - 10} more
        </p>
      )}
    </div>
  );
}

