import { useQuery } from '@tanstack/react-query';
import { studentsAPI } from '@/lib/api';

interface UseStudentsParams {
  is_active?: boolean;
  center_id?: number;
}

export function useStudents(params?: UseStudentsParams) {
  return useQuery({
    queryKey: ['students', params],
    queryFn: () => studentsAPI.getStudents(params),
  });
}

