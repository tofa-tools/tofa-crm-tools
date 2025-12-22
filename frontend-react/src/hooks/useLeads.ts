import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsAPI } from '@/lib/api';
import type { Lead, LeadUpdate } from '@/types';

export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: () => leadsAPI.getMyLeads(),
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, update }: { leadId: number; update: LeadUpdate }) =>
      leadsAPI.updateLead(leadId, update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useUploadLeads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => leadsAPI.uploadLeads(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}


