import { useQuery } from '@tanstack/react-query';
import { leadsAPI } from '@/lib/api';

interface UseLeadsParams {
  limit?: number;
  offset?: number;
  status?: string;
  search?: string;
  sort_by?: string;
  next_follow_up_date?: string;
  filter?: string;
  loss_reason?: string;
}

export function useLeads(params?: UseLeadsParams) {
  return useQuery({
    queryKey: ['leads', params],
    queryFn: () => leadsAPI.getMyLeads(params),
  });
}

