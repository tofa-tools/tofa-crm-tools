'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Lead, LeadStatus } from '@tofa/core';
import { brandConfig, generateWhatsAppLink } from '@tofa/core';
import { QuickUpdateModal } from './QuickUpdateModal';

interface DailyAgendaProps {
  selectedDate: string;
  taskQueue: {
    overdue: Lead[];
    due_today: Lead[];
    upcoming: Lead[];
  } | undefined;
  isLoading: boolean;
  onUpdate: (leadId: number, update: { status?: LeadStatus; next_date?: string | null }) => Promise<void>;
}

export function DailyAgenda({
  selectedDate,
  taskQueue,
  isLoading,
  onUpdate,
}: DailyAgendaProps) {
  const [selectedLeadForUpdate, setSelectedLeadForUpdate] = useState<Lead | null>(null);

  const selectedDateObj = new Date(selectedDate);
  const isToday = useMemo(() => {
    const today = new Date();
    return (
      selectedDateObj.getDate() === today.getDate() &&
      selectedDateObj.getMonth() === today.getMonth() &&
      selectedDateObj.getFullYear() === today.getFullYear()
    );
  }, [selectedDate]);

  // Categorize tasks for the selected date
  const categorizedTasks = useMemo(() => {
    if (!taskQueue) return { overdue: [], scheduled: [], trials: [] };

    // Filter all tasks to match the selected date
    const allRelevantTasks: Lead[] = [];
    
    // Add overdue tasks only if selected date is today
    if (isToday) {
      allRelevantTasks.push(...taskQueue.overdue);
    }
    
    // Filter due_today tasks that match selected date
    taskQueue.due_today.forEach(lead => {
      if (!lead.next_followup_date) return;
      const leadDate = new Date(lead.next_followup_date).toISOString().split('T')[0];
      if (leadDate === selectedDate) {
        allRelevantTasks.push(lead);
      }
    });
    
    // Filter upcoming tasks that match selected date
    taskQueue.upcoming.forEach(lead => {
      if (!lead.next_followup_date) return;
      const leadDate = new Date(lead.next_followup_date).toISOString().split('T')[0];
      if (leadDate === selectedDate) {
        allRelevantTasks.push(lead);
      }
    });

    // Separate into categories
    const overdue = isToday ? taskQueue.overdue.filter(lead => {
      // Overdue tasks are already filtered correctly by backend
      return true;
    }) : [];
    
    const trials = allRelevantTasks.filter(lead => lead.status === 'Trial Scheduled');
    const scheduled = allRelevantTasks.filter(lead => lead.status !== 'Trial Scheduled');

    return { overdue, scheduled, trials };
  }, [taskQueue, selectedDate, isToday]);

  const generateWhatsAppLinkForLead = (phone: string, playerName: string) => {
    return generateWhatsAppLink(phone, brandConfig.messages.enrollmentInquiry, {
      playerName: playerName,
      academyName: brandConfig.name,
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Loading agenda...</p>
        </div>
      </div>
    );
  }

  const totalTasks = categorizedTasks.overdue.length + categorizedTasks.scheduled.length + categorizedTasks.trials.length;

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col">
        {/* Header */}
        <div className="mb-4 pb-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {format(selectedDateObj, 'EEEE, MMMM d, yyyy')}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {totalTasks} task{totalTasks !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Tasks List */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Overdue Section */}
          {categorizedTasks.overdue.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-red-700 mb-2">
                🔴 Overdue ({categorizedTasks.overdue.length})
              </h3>
              <div className="space-y-2">
                {categorizedTasks.overdue.map((lead) => (
                  <AgendaCard
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

          {/* Trials Section */}
          {categorizedTasks.trials.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-purple-700 mb-2">
                🎯 Trials ({categorizedTasks.trials.length})
              </h3>
              <div className="space-y-2">
                {categorizedTasks.trials.map((lead) => (
                  <AgendaCard
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

          {/* Scheduled Section */}
          {categorizedTasks.scheduled.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-blue-700 mb-2">
                📅 Scheduled ({categorizedTasks.scheduled.length})
              </h3>
              <div className="space-y-2">
                {categorizedTasks.scheduled.map((lead) => (
                  <AgendaCard
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

          {/* Empty State */}
          {totalTasks === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📅</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No tasks for this day
              </h3>
              <p className="text-sm text-gray-600">
                Great time to hunt for new leads!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Update Modal */}
      {selectedLeadForUpdate && (
        <QuickUpdateModal
          lead={selectedLeadForUpdate}
          isOpen={!!selectedLeadForUpdate}
          onClose={() => setSelectedLeadForUpdate(null)}
          onUpdate={async (leadId, update) => {
            await onUpdate(leadId, update);
            setSelectedLeadForUpdate(null);
          }}
          onSendMessage={(phone, playerName) => {
            window.open(generateWhatsAppLinkForLead(phone, playerName), '_blank');
          }}
        />
      )}
    </>
  );
}

interface AgendaCardProps {
  lead: Lead;
  onCall: () => void;
  onUpdate: () => void;
}

function AgendaCard({ lead, onCall, onUpdate }: AgendaCardProps) {
  return (
    <div 
      onClick={onUpdate}
      className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-900 text-sm truncate">
              {lead.player_name}
            </h4>
            <StatusBadge status={lead.status as LeadStatus} />
          </div>
          <p className="text-xs text-gray-600">
            {lead.player_age_category || 'Age N/A'}
          </p>
        </div>
      </div>
    </div>
  );
}

