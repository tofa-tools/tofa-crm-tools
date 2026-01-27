import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsAPI, type LeadsResponse } from '@/lib/api';
import type { Lead, LeadUpdate } from '@tofa/core';
import toast from 'react-hot-toast';

interface UseLeadsParams {
  limit?: number;
  offset?: number;
  status?: string;
  search?: string;
  sort_by?: string;
  next_follow_up_date?: string;
  filter?: string; // Special filter: "at-risk"
  loss_reason?: string; // Filter by loss_reason
}

export function useLeads(params?: UseLeadsParams) {
  return useQuery<LeadsResponse>({ // Added explicit generic here
    queryKey: ['leads', params],
    queryFn: () => leadsAPI.getMyLeads(params),
    placeholderData: (previousData) => previousData,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });
}
/**
 * Prefetch the next page of leads
 */
export function usePrefetchNextPage(params?: UseLeadsParams, limit: number = 50) {
  const queryClient = useQueryClient();
  
  return (currentOffset: number) => {
    const nextParams = { ...params, offset: currentOffset + limit, limit };
    queryClient.prefetchQuery({
      queryKey: ['leads', nextParams],
      queryFn: () => leadsAPI.getMyLeads(nextParams),
    });
  };
}

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, update }: { leadId: number; update: LeadUpdate }) =>
      leadsAPI.updateLead(leadId, update),
    // Optimistic update - invalidates all leads queries which will refetch
    onSuccess: (data, variables) => {
      // Invalidate all leads queries to refetch with updated data
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      // Note: Special toast for "Joined" status is handled in the component
      // to allow for confetti timing. Only show standard toast for other statuses.
      if (variables.update.status !== 'Joined') {
        toast.success('Lead updated successfully!');
      }
    },
    onError: (error: any) => {
      // Check for specific error types
      const errorMessage = error?.response?.data?.detail || error?.message || '';
      if (errorMessage.includes('CAPACITY_REACHED')) {
        toast.error('⚠️ This batch is full. Please choose another time or contact the Team Lead.');
      } else if (errorMessage.includes('BATCH_REQUIRED')) {
        toast.error('⚠️ A permanent batch must be assigned before setting status to Joined.');
      } else {
        toast.error('Update failed. Please check your connection and try again.');
      }
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


