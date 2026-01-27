import { useQuery } from '@tanstack/react-query';
import { userStatsAPI } from '@/lib/api';

export function useUserStreak() {
  return useQuery({
    queryKey: ['user-stats', 'streak'],
    queryFn: () => userStatsAPI.getStreak(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUserTodayStats(targetDate?: string) {
  return useQuery({
    queryKey: ['user-stats', 'today', targetDate],
    queryFn: () => userStatsAPI.getTodayStats(targetDate),
    staleTime: 30 * 1000, // 30 seconds
  });
}

