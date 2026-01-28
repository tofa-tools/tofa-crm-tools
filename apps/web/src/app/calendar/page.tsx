'use client';

import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { useCalendarMonth } from '@/hooks/useCalendar';
import { useCenters } from '@/hooks/useCenters';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';

export default function CalendarPage() {
  const { user } = useAuth();
  const { data: centers = [] } = useCenters();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCenters, setSelectedCenters] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // JavaScript months are 0-indexed

  // Filter centers for team leads (can view all), others see only their centers
  // Note: AuthUser doesn't include centers, so non-team-lead users see all centers for now
  // TODO: Add centers to AuthUser type or fetch user centers separately
  const availableCenters = user?.role === 'team_lead' 
    ? centers 
    : centers; // For now, show all centers if user.centers is not available

  const centerIdsToFetch = user?.role === 'team_lead' && selectedCenters.length > 0
    ? selectedCenters
    : undefined;

  const { data: calendarData = {}, isLoading } = useCalendarMonth(year, month, centerIdsToFetch);

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday

  const weeks = useMemo(() => {
    const weeksArray: Date[][] = [];
    let currentDate = new Date(startDate);

    while (currentDate <= monthEnd || weeksArray.length < 6) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeksArray.push(week);
      if (currentDate > monthEnd && weeksArray.length >= 6) break;
    }

    return weeksArray;
  }, [monthStart, monthEnd, startDate]);

  const getWorkloadColor = (dateKey: string): string => {
    const data = calendarData[dateKey];
    if (!data) return 'bg-gray-50'; // No tasks

    const { total, high_priority } = data;

    // Heatmap logic: more tasks = darker color, high priority = red tint
    if (high_priority > 5 || total > 15) {
      return 'bg-red-600 text-white'; // Critical overload
    } else if (high_priority > 3 || total > 10) {
      return 'bg-red-400 text-white'; // High load
    } else if (high_priority > 0 || total > 5) {
      return 'bg-yellow-400 text-gray-900'; // Medium load
    } else if (total > 0) {
      return 'bg-green-400 text-gray-900'; // Light load
    }

    return 'bg-gray-50 text-gray-500'; // No tasks
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(new Date(year, month - 1 + (direction === 'next' ? 1 : -1), 1));
  };

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === month - 1 && date.getFullYear() === year;
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading calendar...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title="CALENDAR VIEW"
        subtitle="Monthly workload overview and planning"
        actions={
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigateMonth('prev')}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ← Previous
            </button>
            <h2 className="text-xl font-semibold text-gray-900 min-w-[200px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
            <button
              onClick={() => navigateMonth('next')}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Next →
            </button>
          </div>
        }
      />
      <div className="p-8 space-y-6">
        {/* Filters */}
        {user?.role === 'team_lead' && availableCenters.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Filter by Center:</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCenters([])}
                className={`px-3 py-1 rounded-lg text-sm ${
                  selectedCenters.length === 0
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                All Centers
              </button>
              {availableCenters.map((center) => (
                <button
                  key={center.id}
                  onClick={() => {
                    if (selectedCenters.includes(center.id)) {
                      setSelectedCenters(selectedCenters.filter(id => id !== center.id));
                    } else {
                      setSelectedCenters([...selectedCenters, center.id]);
                    }
                  }}
                  className={`px-3 py-1 rounded-lg text-sm ${
                    selectedCenters.includes(center.id)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {center.display_name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Calendar Grid */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="grid grid-cols-7 gap-px bg-gray-200">
            {/* Day Headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="bg-gray-100 p-3 text-center text-sm font-semibold text-gray-700">
                {day}
              </div>
            ))}

            {/* Calendar Days */}
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex}>
                {week.map((date, dayIndex) => {
                  const dateKey = format(date, 'yyyy-MM-dd');
                  const data = calendarData[dateKey] || { total: 0, high_priority: 0, trials: 0, calls: 0 };
                  const colorClass = getWorkloadColor(dateKey);
                  const inCurrentMonth = isCurrentMonth(date);
                  const isTodayDate = isToday(date);

                  return (
                    <div
                      key={dayIndex}
                      className={`min-h-[100px] p-2 border-r border-b border-gray-200 ${colorClass} ${
                        !inCurrentMonth ? 'opacity-40' : ''
                      } ${isTodayDate ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                    >
                      <div className="font-semibold mb-1">{date.getDate()}</div>
                      {data.total > 0 && (
                        <div className="space-y-1 text-xs">
                          <div className="font-medium">
                            {data.total} task{data.total !== 1 ? 's' : ''}
                          </div>
                          {data.high_priority > 0 && (
                            <div className="opacity-90">🔥 {data.high_priority} priority</div>
                          )}
                          {data.trials > 0 && (
                            <div className="opacity-90">🎯 {data.trials} trial{data.trials !== 1 ? 's' : ''}</div>
                          )}
                          {data.calls > 0 && (
                            <div className="opacity-90">📞 {data.calls} call{data.calls !== 1 ? 's' : ''}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Workload Heatmap Legend:</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gray-50 border border-gray-200 rounded"></div>
              <span>No tasks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-400 rounded"></div>
              <span>Light (1-5 tasks)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-yellow-400 rounded"></div>
              <span>Medium (6-10 tasks)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-400 rounded"></div>
              <span>High (11-15 tasks)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-600 rounded"></div>
              <span>Critical (15+ tasks)</span>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

