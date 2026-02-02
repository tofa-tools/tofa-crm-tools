import { useQuery } from '@tanstack/react-query';
import { analyticsAPI } from '../lib/api';

export function useCommandCenterAnalytics(targetDate?: string) {
  return useQuery({
    queryKey: ['analytics', 'command-center', targetDate],
    queryFn: () => analyticsAPI.getCommandCenter(targetDate),
    staleTime: 30 * 1000,
    refetchInterval: 30000,
  });
}
