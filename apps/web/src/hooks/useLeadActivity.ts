import { useQuery } from '@tanstack/react-query';
import { leadsAPI } from '@/lib/api';

export function useLeadActivity(leadId: number | null, limit?: number) {
  return useQuery({
    queryKey: ['lead-activity', leadId, limit],
    queryFn: () => {
      if (!leadId) throw new Error('Lead ID is required');
      return leadsAPI.getLeadActivity(leadId, limit);
    },
    enabled: !!leadId, // Only fetch when leadId is provided
  });
}

