import { useQuery } from '@tanstack/react-query';
import { calendarAPI } from '@/lib/api';

export function useCalendarMonth(year: number, month: number, centerIds?: number[]) {
  return useQuery({
    queryKey: ['calendar', 'month', year, month, centerIds],
    queryFn: () => calendarAPI.getMonthView(year, month, centerIds),
    staleTime: 60 * 1000, // 1 minute
  });
}

