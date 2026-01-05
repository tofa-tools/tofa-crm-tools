'use client';

import React, { useMemo } from 'react';
import { format } from 'date-fns';

interface CalendarHeatmapProps {
  year: number;
  month: number;
  calendarData: Record<string, {
    total: number;
    high_priority: number;
    trials: number;
    calls: number;
  }>;
  selectedDate: string | null;
  onDateSelect: (date: string) => void;
  onMonthChange: (direction: 'prev' | 'next') => void;
}

export function CalendarHeatmap({
  year,
  month,
  calendarData,
  selectedDate,
  onDateSelect,
  onMonthChange,
}: CalendarHeatmapProps) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday

  const weeks = useMemo(() => {
    const weeksArray: Date[][] = [];
    let currentDate = new Date(startDate);

    while (currentDate <= monthEnd || weeksArray.length < 6) {
      const week: Date[] = [];
      // Strictly 7 days per week (Sun-Sat)
      for (let i = 0; i < 7; i++) {
        week.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      // Ensure we only add weeks with exactly 7 days
      if (week.length === 7) {
        weeksArray.push(week);
      }
      if (currentDate > monthEnd && weeksArray.length >= 6) break;
    }

    return weeksArray;
  }, [monthStart, monthEnd, startDate]);

  const getWorkloadColor = (dateKey: string): string => {
    const data = calendarData[dateKey];
    if (!data || data.total === 0) return 'bg-gray-50 text-gray-400'; // No tasks

    const { total } = data;

    // Heatmap logic based on total tasks
    if (total >= 10) {
      return 'bg-red-500 text-white'; // Red: 10+ tasks
    } else if (total >= 4) {
      return 'bg-yellow-400 text-gray-900'; // Yellow: 4-10 tasks
    } else if (total >= 1) {
      return 'bg-green-200 text-gray-900'; // Pale Green: 1-3 tasks
    }

    return 'bg-gray-50 text-gray-400';
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

  const isSelected = (date: Date): boolean => {
    if (!selectedDate) return false;
    const dateKey = format(date, 'yyyy-MM-dd');
    return dateKey === selectedDate;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => onMonthChange('prev')}
          className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← Previous
        </button>
        <h2 className="text-lg font-semibold text-gray-900">
          {format(monthStart, 'MMMM yyyy')}
        </h2>
        <button
          onClick={() => onMonthChange('next')}
          className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Next →
        </button>
      </div>

      {/* Calendar Grid - Strictly 7 days per week */}
      <div className="grid grid-cols-7 gap-px bg-gray-200">
        {/* Day Headers - 7 days only */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].slice(0, 7).map((day) => (
          <div
            key={day}
            className="bg-gray-100 p-2 text-center text-xs font-semibold text-gray-700"
          >
            {day}
          </div>
        ))}

        {/* Calendar Days - 7 days per week */}
        {weeks.map((week, weekIndex) => (
          <React.Fragment key={weekIndex}>
            {week.slice(0, 7).map((date, dayIndex) => {
              const dateKey = format(date, 'yyyy-MM-dd');
              const data = calendarData[dateKey] || {
                total: 0,
                high_priority: 0,
                trials: 0,
                calls: 0,
              };
              const colorClass = getWorkloadColor(dateKey);
              const inCurrentMonth = isCurrentMonth(date);
              const isTodayDate = isToday(date);
              const isSelectedDate = isSelected(date);

              return (
                <button
                  key={dayIndex}
                  onClick={() => onDateSelect(dateKey)}
                  className={`min-h-[60px] p-2 border-r border-b border-gray-200 text-left transition-all hover:ring-2 hover:ring-indigo-400 ${
                    colorClass
                  } ${!inCurrentMonth ? 'opacity-40' : ''} ${
                    isTodayDate ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                  } ${
                    isSelectedDate ? 'ring-2 ring-indigo-600 ring-offset-2 font-bold' : ''
                  }`}
                >
                  <div className="text-sm font-semibold mb-1">{date.getDate()}</div>
                  {data.total > 0 && (
                    <div className="text-xs">
                      <div className="font-medium">{data.total}</div>
                    </div>
                  )}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-50 border border-gray-200 rounded"></div>
            <span>None</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-200 rounded"></div>
            <span>1-3</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-400 rounded"></div>
            <span>4-10</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>10+</span>
          </div>
        </div>
      </div>
    </div>
  );
}

