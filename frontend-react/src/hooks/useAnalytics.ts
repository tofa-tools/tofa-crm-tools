import { useQuery } from '@tanstack/react-query';
import { analyticsAPI } from '@/lib/api';

export function useConversionRates() {
  return useQuery({
    queryKey: ['analytics', 'conversion-rates'],
    queryFn: () => analyticsAPI.getConversionRates(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useTimeToContact() {
  return useQuery({
    queryKey: ['analytics', 'time-to-contact'],
    queryFn: () => analyticsAPI.getTimeToContact(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAbandonedCount() {
  return useQuery({
    queryKey: ['analytics', 'abandoned-count'],
    queryFn: () => analyticsAPI.getAbandonedCount(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useStatusDistribution() {
  return useQuery({
    queryKey: ['analytics', 'status-distribution'],
    queryFn: () => analyticsAPI.getStatusDistribution(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAtRiskCount() {
  return useQuery({
    queryKey: ['analytics', 'at-risk-count'],
    queryFn: () => analyticsAPI.getAtRiskCount(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useCommandCenterAnalytics(targetDate?: string) {
  return useQuery({
    queryKey: ['analytics', 'command-center', targetDate],
    queryFn: () => analyticsAPI.getCommandCenter(targetDate),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });
}

