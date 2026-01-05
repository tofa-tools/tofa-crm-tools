'use client';

import { useState } from 'react';
import { MiniCalendar } from './MiniCalendar';
import { AgendaList } from './AgendaList';
import { useLeads } from '@/hooks/useLeads';

interface PlannerPaneProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string | null;
  onDateSelect: (date: string | null) => void;
  onLeadClick?: (leadId: number) => void;
}

export function PlannerPane({ isOpen, onClose, selectedDate, onDateSelect, onLeadClick }: PlannerPaneProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Fetch leads for the selected date
  const { data: leadsResponse } = useLeads(
    selectedDate
      ? {
          limit: 100, // Get up to 100 leads for the selected date
          offset: 0,
          next_follow_up_date: selectedDate,
        }
      : undefined
  );

  const selectedDateLeads = leadsResponse?.leads || [];

  return (
    <div
      className={`
        fixed right-0 top-0 h-screen bg-white border-l border-gray-200 shadow-xl z-40
        transition-all duration-300 ease-in-out
        ${isOpen ? 'w-full md:w-[30%] translate-x-0' : 'w-0 translate-x-full'}
        overflow-hidden
      `}
    >
      {isOpen && (
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-slate-50">
            <h2 className="text-lg font-semibold text-gray-900">📅 Planner</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              aria-label="Close planner"
            >
              <span className="text-xl">×</span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Mini Calendar */}
            <div className="p-4 border-b border-gray-200">
              <MiniCalendar
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
                selectedDate={selectedDate}
                onDateSelect={onDateSelect}
              />
            </div>

            {/* Daily Agenda */}
            <div className="p-4">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  {selectedDate
                    ? new Date(selectedDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'Select a date'}
                </h3>
                {selectedDate && (
                  <button
                    onClick={() => onDateSelect(null)}
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    Clear filter
                  </button>
                )}
              </div>
              <AgendaList leads={selectedDateLeads} selectedDate={selectedDate} onLeadClick={onLeadClick} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
