import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsAPI } from '@/lib/api';
import toast from 'react-hot-toast';

interface UseStudentsParams {
  center_id?: number;
  is_active?: boolean;
}

export function useStudents(params?: UseStudentsParams) {
  return useQuery({
    queryKey: ['students', params],
    queryFn: () => studentsAPI.getStudents(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ studentId, data }: { studentId: number; data: any }) =>
      studentsAPI.updateStudent(studentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Student updated successfully!');
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error?.message || '';
      toast.error(errorMessage || 'Update failed. Please try again.');
    },
  });
}

