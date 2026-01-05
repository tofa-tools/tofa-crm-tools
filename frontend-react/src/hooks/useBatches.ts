import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { batchesAPI } from '@/lib/api';
import type { Batch, BatchCreate } from '@/types';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';

/**
 * Hook to fetch batches, optionally filtered by center
 */
export function useBatches(centerId?: number) {
  return useQuery({
    queryKey: ['batches', centerId],
    queryFn: () => batchesAPI.getBatches(centerId ? { center_id: centerId } : undefined),
  });
}

/**
 * Hook to create a new batch (team leads only)
 */
export function useCreateBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BatchCreate) => batchesAPI.createBatch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      toast.success('Batch created successfully!');
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to create batch';
      toast.error(`Failed to create batch: ${errorMessage}`);
    },
  });
}

/**
 * Hook to assign coaches to a batch (team leads only)
 */
export function useAssignCoachToBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, coachIds }: { batchId: number; coachIds: number[] }) =>
      batchesAPI.assignCoach(batchId, coachIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['batches', 'my-batches'] });
      toast.success('Coaches assigned to batch successfully!');
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to assign coaches';
      toast.error(`Failed to assign coaches: ${errorMessage}`);
    },
  });
}

/**
 * Hook to update a batch (team leads only)
 */
export function useUpdateBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, data }: { batchId: number; data: Partial<BatchCreate> }) =>
      batchesAPI.updateBatch(batchId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['batches', 'my-batches'] });
      toast.success('Batch updated successfully!');
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to update batch';
      toast.error(`Failed to update batch: ${errorMessage}`);
    },
  });
}

/**
 * Hook to delete a batch (team leads only)
 */
export function useDeleteBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (batchId: number) => batchesAPI.deleteBatch(batchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['batches', 'my-batches'] });
      toast.success('Batch deleted successfully!');
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to delete batch';
      toast.error(`Failed to delete batch: ${errorMessage}`);
    },
  });
}

/**
 * Hook to fetch batches assigned to the current coach
 * Only fetches if the current user is a coach
 */
export function useCoachBatches() {
  const { user } = useAuth();
  const isCoach = user?.role === 'coach';
  
  return useQuery({
    queryKey: ['batches', 'my-batches'],
    queryFn: () => batchesAPI.getMyBatches(),
    enabled: isCoach, // Only fetch if user is a coach
  });
}

