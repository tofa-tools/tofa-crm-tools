import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { centersAPI } from '@/lib/api';
import type { Center, CenterCreate } from '@/types';

export function useCenters() {
  return useQuery({
    queryKey: ['centers'],
    queryFn: () => centersAPI.getCenters(),
  });
}

export function useCreateCenter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (centerData: CenterCreate) => centersAPI.createCenter(centerData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['centers'] });
    },
  });
}

export function useUpdateCenter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ centerId, centerData }: { centerId: number; centerData: Partial<CenterCreate> }) =>
      centersAPI.updateCenter(centerId, centerData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['centers'] });
    },
  });
}


