'use client';

import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { useCalendarMonth } from '@/hooks/useCalendar';
import { cn } from '@/lib/utils';

interface MiniCalendarProps {
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  selectedDate: string | null;
  onDateSelect: (date: string | null) => void;
}

export function MiniCalendar({
  currentMonth,
  onMonthChange,
  selectedDate,
  onDateSelect,
}: MiniCalendarProps) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + 1;
  
  const { data: calendarData = {} } = useCalendarMonth(year, month);

  // Calculate calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Start from Sunday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const navigateMonth = (direction: 'prev' | 'next') => {
    onMonthChange(direction === 'next' ? addMonths(currentMonth, 1) : subMonths(currentMonth, 1));
  };

  const handleDateClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    onDateSelect(selectedDate === dateStr ? null : dateStr);
  };

  const getDateHeatmapIndicator = (date: Date): 'high' | 'medium' | 'low' | 'none' => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const data = calendarData[dateKey];
    
    if (!data || data.total === 0) return 'none';
    if (data.total > 10 || data.high_priority > 3) return 'high';
    if (data.total > 5 || data.high_priority > 0) return 'medium';
    return 'low';
  };

  const isToday = (date: Date) => isSameDay(date, new Date());
  const isSelected = (date: Date) => selectedDate && isSameDay(date, new Date(selectedDate));
  const isCurrentMonth = (date: Date) => isSameMonth(date, currentMonth);

  return (
    <div className="w-full">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          aria-label="Previous month"
        >
          <span className="text-sm">←</span>
        </button>
        <h3 className="text-sm font-semibold text-gray-900">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <button
          onClick={() => navigateMonth('next')}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          aria-label="Next month"
        >
          <span className="text-sm">→</span>
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-xs font-medium text-gray-500 text-center py-1">
            {day[0]}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          const heatmapLevel = getDateHeatmapIndicator(day);
          const dateIsToday = isToday(day);
          const dateIsSelected = isSelected(day);
          const dateInCurrentMonth = isCurrentMonth(day);

          return (
            <button
              key={index}
              onClick={() => handleDateClick(day)}
              className={cn(
                'relative aspect-square p-1 text-xs rounded transition-colors',
                'hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500',
                !dateInCurrentMonth && 'text-gray-300',
                dateInCurrentMonth && 'text-gray-900',
                dateIsToday && 'font-bold bg-blue-50',
                dateIsSelected && 'bg-indigo-600 text-white font-semibold'
              )}
            >
              <span>{format(day, 'd')}</span>
              {/* Heatmap Indicator */}
              {heatmapLevel !== 'none' && dateInCurrentMonth && (
                <div
                  className={cn(
                    'absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full',
                    heatmapLevel === 'high' && 'bg-red-500',
                    heatmapLevel === 'medium' && 'bg-yellow-500',
                    heatmapLevel === 'low' && 'bg-green-500'
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-center gap-3 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span>Light</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500"></div>
          <span>Heavy</span>
        </div>
      </div>
    </div>
  );
}

