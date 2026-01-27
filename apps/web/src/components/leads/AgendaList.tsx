'use client';

import { format } from 'date-fns';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Lead, LeadStatus } from '@tofa/core';

interface AgendaListProps {
  leads: Lead[];
  selectedDate: string | null;
  onLeadClick?: (leadId: number) => void;
}

export function AgendaList({ leads, selectedDate, onLeadClick }: AgendaListProps) {
  if (!selectedDate) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">Select a date to view scheduled leads</p>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No leads scheduled for this date</p>
      </div>
    );
  }

  // Separate overdue vs on-time
  const today = new Date();
  const selectedDateObj = new Date(selectedDate);
  const isPastDate = selectedDateObj < today && format(selectedDateObj, 'yyyy-MM-dd') !== format(today, 'yyyy-MM-dd');

  const overdueLeads = leads.filter((lead) => {
    if (!lead.next_followup_date) return false;
    const followupDate = typeof lead.next_followup_date === 'string'
      ? new Date(lead.next_followup_date)
      : lead.next_followup_date;
    const isOverdue = followupDate < today;
    const isActive = lead.status !== 'Joined' && lead.status !== 'Dead/Not Interested';
    return isOverdue && isActive;
  });

  const onTimeLeads = leads.filter((lead) => !overdueLeads.includes(lead));

  return (
    <div className="space-y-4">
      {overdueLeads.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
            🔴 Overdue ({overdueLeads.length})
          </h4>
          <div className="space-y-2">
            {overdueLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                isOverdue={true}
                onClick={() => onLeadClick?.(lead.id)}
              />
            ))}
          </div>
        </div>
      )}

      {onTimeLeads.length > 0 && (
        <div>
          {overdueLeads.length > 0 && (
            <h4 className="text-xs font-semibold text-gray-700 mb-2 mt-4">
              Scheduled ({onTimeLeads.length})
            </h4>
          )}
          <div className="space-y-2">
            {onTimeLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                isOverdue={false}
                onClick={() => onLeadClick?.(lead.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface LeadCardProps {
  lead: Lead;
  isOverdue: boolean;
  onClick?: () => void;
}

function LeadCard({ lead, isOverdue, onClick }: LeadCardProps) {
  const getFollowupTime = () => {
    if (!lead.next_followup_date) return null;
    const followupDate = typeof lead.next_followup_date === 'string'
      ? new Date(lead.next_followup_date)
      : lead.next_followup_date;
    return format(followupDate, 'h:mm a');
  };

  const followupTime = getFollowupTime();

  return (
    <div
      className={`
        p-3 rounded-lg border cursor-pointer transition-all
        ${isOverdue ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-sm'}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h5 className="font-semibold text-gray-900 text-sm truncate">{lead.player_name}</h5>
          {followupTime && (
            <p className="text-xs text-gray-500 mt-0.5">{followupTime}</p>
          )}
        </div>
        <StatusBadge status={lead.status as LeadStatus} />
      </div>

      {/* Phone */}
      <div className="text-xs text-gray-600 mb-1">
        📞 {lead.phone}
      </div>

      {/* Quick Action Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        className={`
          mt-2 w-full text-xs px-2 py-1 rounded transition-colors
          ${isOverdue
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }
        `}
      >
        {isOverdue ? 'Update Now' : 'View Details'}
      </button>
    </div>
  );
}

