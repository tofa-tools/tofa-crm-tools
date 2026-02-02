import { useQuery } from '@tanstack/react-query';
import { tasksAPI } from '../lib/api';

export function useDailyQueue(targetDate?: string) {
  return useQuery({
    queryKey: ['tasks', 'daily-queue', targetDate],
    queryFn: () => tasksAPI.getDailyQueue(targetDate),
    staleTime: 30 * 1000,
  });
}
