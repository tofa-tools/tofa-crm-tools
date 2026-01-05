import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsAPI } from '@/lib/api';
import toast from 'react-hot-toast';

export function useBulkUpdateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadIds, newStatus }: { leadIds: number[]; newStatus: string }) =>
      leadsAPI.bulkUpdateStatus(leadIds, newStatus),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      if (data.errors && data.errors.length > 0) {
        toast.error(`Updated ${data.updated_count} leads. Some errors occurred.`);
      } else {
        toast.success(`Successfully updated ${data.updated_count} lead(s)!`);
      }
    },
    onError: () => {
      toast.error('Failed to update leads. Please try again.');
    },
  });
}

export function useBulkAssignCenter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadIds, centerId }: { leadIds: number[]; centerId: number }) =>
      leadsAPI.bulkAssignCenter(leadIds, centerId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      if (data.errors && data.errors.length > 0) {
        toast.error(`Updated ${data.updated_count} leads. Some errors occurred.`);
      } else {
        toast.success(`Successfully assigned ${data.updated_count} lead(s) to center!`);
      }
    },
    onError: () => {
      toast.error('Failed to assign leads. Please try again.');
    },
  });
}

