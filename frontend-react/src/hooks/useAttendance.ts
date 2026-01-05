import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceAPI } from '@/lib/api';
import type { AttendanceCreate } from '@/types';
import toast from 'react-hot-toast';

/**
 * Hook to record attendance for a lead
 */
export function useRecordAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AttendanceCreate) => attendanceAPI.checkIn(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Attendance recorded successfully!');
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to record attendance';
      toast.error(`Failed to record attendance: ${errorMessage}`);
    },
  });
}

/**
 * Hook to fetch attendance history for a specific lead
 */
export function useLeadAttendanceHistory(leadId: number) {
  return useQuery({
    queryKey: ['attendance', 'history', leadId],
    queryFn: () => attendanceAPI.getHistory(leadId),
    enabled: !!leadId, // Only fetch if leadId is provided
  });
}

